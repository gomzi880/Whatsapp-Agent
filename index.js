import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import { config } from './config.js';
import { generateHumanReply, clearMemory } from './ai.js';
import {
  recordLeadActivity,
  getDueFollowUps,
  markFollowUpSent,
  getFollowUpText,
} from './followup.js';
import { registerWhatsAppSocket } from './src/outreach/outreachService.js';
import { processProspectReply } from './src/outreach/campaignManager.js';
import { recordLeadMessage } from './src/database/db.js';

let stateBotEnabled = config.autoReplyEnabled;

// Persistent Human Takeover Store
const TAKEOVER_FILE = './takeover_chats.json';
const takeoverChats = new Set();

function loadTakeoverChats() {
  try {
    if (fs.existsSync(TAKEOVER_FILE)) {
      const arr = JSON.parse(fs.readFileSync(TAKEOVER_FILE, 'utf-8'));
      arr.forEach((jid) => takeoverChats.add(jid));
    }
  } catch (e) {
    console.error('Error loading takeover_chats.json:', e.message);
  }
}

function saveTakeoverChats() {
  try {
    fs.writeFileSync(
      TAKEOVER_FILE,
      JSON.stringify(Array.from(takeoverChats), null, 2),
      'utf-8'
    );
  } catch (e) {
    console.error('Error saving takeover_chats.json:', e.message);
  }
}

loadTakeoverChats();

// Sleep utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate human-like typing and reading delay
 * @param {string} text
 * @returns {number} Delay in milliseconds
 */
function calculateHumanDelay(text) {
  // Base reading/reaction delay
  const base =
    Math.random() * (config.maxTypingDelayMs - config.minTypingDelayMs) +
    config.minTypingDelayMs;
  // Extra delay based on response character count (approx typing speed)
  const typingSpeed = (text.length / 25) * 800;
  return Math.min(Math.floor(base + typingSpeed), 7000);
}

/**
 * Extract clean text from incoming message object
 */
function extractMessageText(msg) {
  const m = msg.message;
  if (!m) return null;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

/**
 * Check if a number is allowed by Whitelist/Blacklist
 */
function isAllowedContact(jid) {
  // Format jid: 123456789@s.whatsapp.net -> 123456789
  const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');

  if (config.blacklistNumbers.length > 0) {
    if (config.blacklistNumbers.some((b) => phone.includes(b))) {
      return false;
    }
  }

  if (config.whitelistNumbers.length > 0) {
    return config.whitelistNumbers.some((w) => phone.includes(w));
  }

  return true;
}

async function startWhatsAppBot() {
  console.log('----------------------------------------------------');
  console.log(`🤖 Starting WhatsApp Human Auto-Reply Agent (${config.yourName})`);
  console.log('----------------------------------------------------');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using Baileys version: ${version.join('.')} (Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Suppress internal debug logs for clean terminal
    printQRInTerminal: false,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  });

  // If phone number is configured, generate an 8-character Pairing Code
  if (!sock.authState.creds.registered && config.phoneNumber) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.phoneNumber);
        console.log('\n======================================================');
        console.log(`🔑 WHATSAPP PAIRING CODE: ${code}`);
        console.log('======================================================');
        console.log('1. Open WhatsApp on your phone.');
        console.log('2. Go to Settings (or 3 dots) > Linked Devices > Link a Device.');
        console.log('3. Tap "Link with phone number instead" at the bottom.');
        console.log(`4. Enter this code on your phone: ${code}\n`);
      } catch (err) {
        console.error('Failed to request pairing code:', err.message);
      }
    }, 4000);
  }

  // Handle QR code and Connection Updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !config.phoneNumber) {
      console.log('\n📲 Scan this QR code with WhatsApp (Linked Devices):\n');
      qrcode.generate(qr, { small: true });
      console.log('\nOpen WhatsApp > Settings / 3-dots > Linked Devices > Link a Device.\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`⚠️ Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(startWhatsAppBot, 3000);
      } else {
        console.log('❌ Logged out from WhatsApp. Delete ./auth_info_baileys and scan again.');
      }
    } else if (connection === 'open') {
      console.log('✅ Connected successfully to WhatsApp!');
      registerWhatsAppSocket(sock);
      console.log(`Auto-reply is currently: ${stateBotEnabled ? '🟢 ON' : '🔴 OFF'}`);
      console.log(`Ignoring group chats: ${config.ignoreGroups ? 'YES' : 'NO'}`);
      console.log(`Human Takeover active on: ${takeoverChats.size} chats`);
      console.log('Listening for incoming messages...\n');

      // ⏰ Background 24-Hour Smart Follow-Up Scheduler (Runs every 15 minutes)
      setInterval(async () => {
        try {
          const dueLeads = getDueFollowUps(24 * 60 * 60 * 1000);
          for (const lead of dueLeads) {
            // Skip if paused or taken over
            if (takeoverChats.has(lead.jid)) continue;

            console.log(`⏰ Sending 24-hour smart follow-up to ${lead.jid}...`);
            const followUpMsg = getFollowUpText();
            await sock.sendMessage(lead.jid, { text: followUpMsg });
            markFollowUpSent(lead.jid);
            await delay(3000); // Polite interval between messages
          }
        } catch (err) {
          console.error('Error in 24h follow-up scheduler:', err.message);
        }
      }, 15 * 60 * 1000);
    }
  });

  // Save auth credentials whenever updated
  sock.ev.on('creds.update', saveCreds);

  // Handle Incoming Messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignore messages without keys or status broadcast
      if (!msg.key || msg.key.remoteJid === 'status@broadcast') continue;

      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const text = extractMessageText(msg);

      if (!text) continue;

      // Owner Command Controls (Sent by you from your own WhatsApp)
      if (msg.key.fromMe) {
        const cmd = text.trim().toLowerCase();
        if (cmd === '#bot on') {
          stateBotEnabled = true;
          console.log('👉 Bot turned ON via command.');
          await sock.sendMessage(remoteJid, { text: '🟢 WhatsApp Agent is now ON.' });
          continue;
        } else if (cmd === '#bot off') {
          stateBotEnabled = false;
          console.log('👉 Bot turned OFF via command.');
          await sock.sendMessage(remoteJid, { text: '🔴 WhatsApp Agent is now OFF.' });
          continue;
        } else if (cmd === '#bot status') {
          await sock.sendMessage(remoteJid, {
            text: `ℹ️ Agent Status: ${stateBotEnabled ? '🟢 ON' : '🔴 OFF'}\nPersona: ${config.yourName}`,
          });
          continue;
        } else if (cmd === '#bot clear') {
          clearMemory(remoteJid);
          await sock.sendMessage(remoteJid, { text: '🧹 Chat memory cleared for this contact.' });
          continue;
        } else if (cmd === '#takeover') {
          takeoverChats.add(remoteJid);
          saveTakeoverChats();
          console.log(`✋ Human takeover activated for ${remoteJid}`);
          await sock.sendMessage(remoteJid, {
            text: '✋ Human takeover activated for this chat. AI auto-reply is PAUSED.\nSend `#resume` anytime to give control back to AI.',
          });
          continue;
        } else if (cmd === '#resume' || cmd === '#release') {
          takeoverChats.delete(remoteJid);
          saveTakeoverChats();
          console.log(`🤖 AI resumed for ${remoteJid}`);
          await sock.sendMessage(remoteJid, {
            text: '🤖 AI auto-reply RESUMED for this chat.',
          });
          continue;
        } else if (cmd.startsWith('#takeover ')) {
          const targetNum = cmd.replace('#takeover', '').trim().replace(/[^0-9]/g, '');
          if (targetNum) {
            const targetJid = `${targetNum}@s.whatsapp.net`;
            takeoverChats.add(targetJid);
            saveTakeoverChats();
            await sock.sendMessage(remoteJid, {
              text: `✋ Human takeover activated for +${targetNum}. AI will NOT reply to them.\nSend \`#resume ${targetNum}\` to resume.`,
            });
          }
          continue;
        } else if (cmd.startsWith('#resume ')) {
          const targetNum = cmd.replace('#resume', '').trim().replace(/[^0-9]/g, '');
          if (targetNum) {
            const targetJid = `${targetNum}@s.whatsapp.net`;
            takeoverChats.delete(targetJid);
            saveTakeoverChats();
            await sock.sendMessage(remoteJid, {
              text: `🤖 AI auto-reply RESUMED for +${targetNum}.`,
            });
          }
          continue;
        } else if (cmd === '#takeover list') {
          const list = Array.from(takeoverChats).join('\n') || 'None';
          await sock.sendMessage(remoteJid, {
            text: `📋 Currently Paused / Taken-Over Chats:\n${list}`,
          });
          continue;
        }
        // Don't auto-reply to messages you sent yourself
        // If sent manually from operator's phone to a contact (not a bot command), log it for timeline completeness
        if (!isGroup && !remoteJid.endsWith('@broadcast') && !text.startsWith('#')) {
          try {
            const lead = findLeadByPhoneOrJid(remoteJid);
            recordLeadMessage({
              leadId: lead ? lead.id : null,
              campaignId: null,
              remoteJid,
              senderRole: 'agent',
              messageText: text,
              status: 'sent',
              intent: 'manual_operator_reply'
            });
          } catch (e) {}
        }
        continue;
      }

      // Check if bot is disabled
      if (!stateBotEnabled) continue;

      // Group filter
      if (isGroup && config.ignoreGroups) continue;

      // Check if chat is currently in Human Takeover mode
      if (takeoverChats.has(remoteJid)) {
        console.log(`✋ Skipped incoming message from ${remoteJid} (Human Takeover is Active)`);
        try {
          recordLeadMessage({
            leadId: null,
            remoteJid,
            senderRole: 'prospect',
            messageText: text,
            status: 'received',
            intent: 'human_takeover'
          });
        } catch (e) {}
        continue;
      }

      // Record lead activity for 24-hour smart follow-up
      recordLeadActivity(remoteJid, text);

      // Whitelist / Blacklist check
      if (!isAllowedContact(remoteJid)) {
        console.log(`⏩ Skipped non-whitelisted or blacklisted contact: ${remoteJid}`);
        continue;
      }

      console.log(`\n📩 Incoming from ${remoteJid}: "${text}"`);

      // Immediately record incoming prospect message (Guaranteed write to database)
      try {
        const foundLead = findLeadByPhoneOrJid(remoteJid);
        const incomingIntent = detectProspectIntent(text);
        const recentCheck = db.prepare(`
          SELECT id FROM lead_messages
          WHERE remoteJid = ? AND senderRole = 'prospect' AND messageText = ? AND createdAt >= datetime('now', '-10 seconds')
          LIMIT 1
        `).get(remoteJid, text);
        if (!recentCheck) {
          recordLeadMessage({
            leadId: foundLead ? foundLead.id : null,
            campaignId: null,
            remoteJid,
            senderRole: 'prospect',
            messageText: text,
            status: 'received',
            intent: incomingIntent
          });
        }
      } catch (err) {
        console.warn('Direct message record notice:', err.message);
      }

      // Conversation Intelligence & Lead Status Synchronization
      let activeLead = null;
      try {
        const result = await processProspectReply(remoteJid, text);
        activeLead = result.lead;
        if (result.haltOutreach) {
          console.log(`🛑 Outreach halted for ${remoteJid} (Opt-out acknowledged).`);
          await sock.sendPresenceUpdate('paused', remoteJid);
          continue;
        }

        // If scheduling state machine produced an intelligent meeting scheduling response
        if (result.schedulingReply) {
          await sock.readMessages([msg.key]);
          await sock.sendPresenceUpdate('composing', remoteJid);
          const delayMs = calculateHumanDelay(result.schedulingReply);
          await delay(delayMs);
          await sock.sendMessage(remoteJid, { text: result.schedulingReply });
          console.log(`📅 Meeting Scheduler replied to ${remoteJid}: "${result.schedulingReply.slice(0, 80)}..."`);
          recordLeadMessage({
            leadId: activeLead ? activeLead.id : null,
            campaignId: null,
            remoteJid,
            senderRole: 'agent',
            messageText: result.schedulingReply,
            status: 'sent',
            intent: 'meeting_scheduling'
          });
          continue;
        }
      } catch (err) {
        console.warn('Error in conversation intelligence processing:', err.message);
      }

      try {
        // 1. Mark message as read (Blue tick)
        await sock.readMessages([msg.key]);

        // 2. Simulate human presence: "typing..."
        await sock.sendPresenceUpdate('composing', remoteJid);

        // 3. Generate human response via Gemini
        const reply = await generateHumanReply(remoteJid, text);
        if (!reply) {
          await sock.sendPresenceUpdate('paused', remoteJid);
          continue;
        }

        // 4. Calculate realistic human delay (reading + typing time)
        const replyText = typeof reply === 'object' ? reply.text : reply;
        const sendBrochure = typeof reply === 'object' ? reply.sendBrochurePdf : false;

        const delayMs = calculateHumanDelay(replyText);
        console.log(`⏳ Simulating human typing (${(delayMs / 1000).toFixed(1)}s)...`);
        await delay(delayMs);

        // 5. Send reply text
        await sock.sendMessage(remoteJid, { text: replyText });
        console.log(`💬 Replied to ${remoteJid}: "${replyText}"`);

        // Record agent reply in database
        recordLeadMessage({
          leadId: activeLead ? activeLead.id : null,
          campaignId: null,
          remoteJid,
          senderRole: 'agent',
          messageText: replyText,
          status: 'sent',
          intent: 'conversational_reply'
        });

        // 6. Send Brochure Image and/or PDF if requested
        if (sendBrochure) {
          if (fs.existsSync('./GymStack_Brochure.png')) {
            console.log(`🖼️ Sending GymStack Brochure Image to ${remoteJid}...`);
            await sock.sendMessage(remoteJid, {
              image: fs.readFileSync('./GymStack_Brochure.png'),
              caption: '🏋️‍♂️ GymStack - Complete Packages & Feature Overview\n\n• Starter Plan: ₹499/mo (Up to 150 members)\n• Gold Plan: ₹2,700/mo (Up to 500 members + App + Biometric)\n• Diamond Plan: ₹5,499/yr (Unlimited members)\n\n👉 30-Day Free Trial: https://gymstack.in/register\n📞 Contact: +91-8358826116',
            });
          }

          // If customer explicitly mentioned PDF/document, send PDF as well
          const wantsPdf = /pdf|document|file/.test(text.toLowerCase());
          if (wantsPdf && fs.existsSync('./GymStack_Brochure.pdf')) {
            console.log(`📄 Sending GymStack Brochure PDF to ${remoteJid}...`);
            await sock.sendMessage(remoteJid, {
              document: fs.readFileSync('./GymStack_Brochure.pdf'),
              mimetype: 'application/pdf',
              fileName: 'GymStack_Brochure.pdf',
              caption: 'GymStack - Complete Product & Packages Brochure 📄',
            });
          }
        }

        // 7. Stop typing presence
        await sock.sendPresenceUpdate('paused', remoteJid);
      } catch (err) {
        console.error(`❌ Failed to reply to ${remoteJid}:`, err.message);
        await sock.sendPresenceUpdate('paused', remoteJid);
      }
    }
  });
}

// Start bot
startWhatsAppBot().catch((err) => {
  console.error('Fatal initialization error:', err);
});
