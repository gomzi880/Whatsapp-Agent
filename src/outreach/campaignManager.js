/**
 * Outreach Campaign Manager & Conversation Intelligence Engine
 * 
 * Manages targeted lead outreach campaigns, personalized messaging,
 * pacing/throttling, intent classification, and real-time lead status synchronization.
 */

import db, {
  findLeadByPhoneOrJid,
  updateLeadStatus,
  recordLeadMessage,
  getEligibleLeadsForOutreach,
  createOutreachCampaign,
  updateOutreachCampaign,
  getOutreachCampaigns,
  getOutreachCampaignById
} from '../database/db.js';
import { isOutreachApproved } from '../knowledge/knowledgeService.js';
import { sendWhatsAppMessage, isWhatsAppConnected } from './outreachService.js';

// Active running campaigns controllers
const activeCampaignControllers = new Map();

/**
 * Generates an individualized introduction message for a gym prospect
 */
export function generatePersonalizedIntro(lead, customTemplate = null) {
  const gymName = lead.gymName || 'your fitness facility';
  const city = lead.city ? `in ${lead.city}` : '';
  const ownerName = lead.ownerName || lead.founderName;
  const category = (lead.gymCategory || 'gym').toLowerCase();

  const greeting = ownerName ? `Hello ${ownerName}!` : `Hello ${gymName} team!`;

  if (customTemplate && customTemplate.trim()) {
    return customTemplate
      .replace(/{ownerName}/g, ownerName || 'there')
      .replace(/{gymName}/g, gymName)
      .replace(/{city}/g, lead.city || '')
      .replace(/{category}/g, category);
  }

  return `${greeting} I came across ${gymName} ${city} and wanted to introduce GymStack.

GymStack is an all-in-one gym management platform that helps fitness businesses automate member attendance (biometrics & face scanners), collect fees on WhatsApp, manage trainers, and simplify daily operations.

We would love to show you how GymStack can simplify day-to-day management for ${gymName}.

Would you be open to seeing a quick 5-minute product walkthrough or testing our 30-day free trial?

(Reply 'stop' anytime if you prefer not to receive updates)`;
}

/**
 * Classifies the intent of an incoming prospect reply
 */
export function detectProspectIntent(text) {
  if (!text) return 'general_inquiry';
  const clean = text.toLowerCase().trim();

  // 1. Opt-out / Stop / Not interested
  if (
    /^(stop|unsubscribe|cancel|nahi|band karo|don't message|dont message|no thanks|not interested|remove me|mat bhejo)$/i.test(clean) ||
    /\b(stop|unsubscribe|opt[- ]?out|not interested|don't want|dont want|stop messaging|remove my number|remove me|never message|do not message|dont message)\b/i.test(clean)
  ) {
    return 'opt_out';
  }

  // 2. Demo or meeting request
  if (
    /demo|walkthrough|show me|presentation|zoom|google meet|schedule|call me|bat karni hai|meeting/i.test(clean)
  ) {
    return 'demo_requested';
  }

  // 3. Pricing & package inquiry
  if (
    /price|pricing|cost|charge|fees|rate|kitna|pack|starter|gold|diamond|expensive|budget|afford/i.test(clean)
  ) {
    return 'pricing';
  }

  // 4. Contact later / busy
  if (
    /later|busy|tomorrow|next week|bad me|baad me|kal bat|kal call|after 2 days|busy right now/i.test(clean)
  ) {
    return 'follow_up_later';
  }

  // 5. Already using competitor or other software
  if (
    /already use|already have|using other|dusra software|another app|already using/i.test(clean)
  ) {
    return 'already_using_other';
  }

  // 6. Positive interest
  if (
    /yes|interested|ha|haan|sure|tell me more|share details|send details|batao|kya hai/i.test(clean)
  ) {
    return 'interested';
  }

  return 'general_inquiry';
}

/**
 * Processes an incoming reply from a lead, updates status and records the interaction
 */
export async function processProspectReply(remoteJid, messageText) {
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  const lead = findLeadByPhoneOrJid(phone);
  const intent = detectProspectIntent(messageText);

  console.log(`🧠 [Conversation Intelligence] Contact: ${remoteJid} | Detected Intent: "${intent}" | Lead: ${lead ? lead.gymName : 'Unregistered'}`);

  let updatedStatus = null;
  let haltOutreach = false;
  let optOutAckMessage = null;

  if (lead) {
    // Determine appropriate lifecycle status update
    switch (intent) {
      case 'opt_out':
        updatedStatus = 'Unsubscribed';
        haltOutreach = true;
        optOutAckMessage = `Understood! I have removed ${lead.gymName} from our outreach list and won't message you again. Wishing you continued success!`;
        break;
      case 'demo_requested':
        updatedStatus = 'Meeting Requested';
        break;
      case 'interested':
        updatedStatus = 'Interested';
        break;
      case 'follow_up_later':
        updatedStatus = 'Follow-up Required';
        break;
      case 'pricing':
      case 'already_using_other':
      case 'general_inquiry':
      default:
        if (lead.status === 'New' || lead.status === 'Contacted') {
          updatedStatus = 'Responded';
        }
        break;
    }

    if (updatedStatus) {
      updateLeadStatus(lead.id, updatedStatus, `Prospect replied: "${messageText.slice(0, 50)}" [Intent: ${intent}]`);
      console.log(`📌 Lead #${lead.id} (${lead.gymName}) status advanced to -> "${updatedStatus}"`);
    }

    // Record incoming message in database
    recordLeadMessage({
      leadId: lead.id,
      remoteJid,
      senderRole: 'prospect',
      messageText,
      status: 'received',
      intent
    });

    // If opted out, send courteous acknowledgment immediately and do not generate sales pitch
    if (haltOutreach && optOutAckMessage) {
      try {
        await sendWhatsAppMessage(remoteJid, optOutAckMessage);
        recordLeadMessage({
          leadId: lead.id,
          remoteJid,
          senderRole: 'agent',
          messageText: optOutAckMessage,
          status: 'sent',
          intent: 'opt_out_ack'
        });
      } catch (err) {
        console.warn('Failed to send opt-out acknowledgment:', err.message);
      }
    }
  }

  // Handle Automatic Meeting Scheduling Workflow if intent is demo_requested or lead has active meeting
  let schedulingReply = null;
  let meeting = null;
  let feedbackResult = null;

  if (lead && (intent === 'demo_requested' || lead.status === 'Meeting Requested')) {
    try {
      const { processSchedulingTurn } = await import('../calendar/schedulingStateMachine.js');
      const schedulingResult = await processSchedulingTurn({
        lead,
        incomingText: messageText,
        channel: 'whatsapp',
        remoteJid
      });
      schedulingReply = schedulingResult.replyText;
      meeting = schedulingResult.meeting;
    } catch (err) {
      console.warn('Error in scheduling state machine:', err.message);
    }
  }

  // Handle Customer Feedback & Follow-Up ingestion
  if (lead && (lead.status === 'Demo Completed' || lead.status === 'Meeting Scheduled' || lead.status === 'Follow-up Required' || intent === 'feedback_response')) {
    try {
      const { processInboundFeedback } = await import('../feedback/feedbackService.js');
      feedbackResult = await processInboundFeedback({
        lead,
        responseText: messageText,
        channel: 'whatsapp'
      });
      if (feedbackResult?.classification?.isHighValue) {
        const { notifyAdminHighValueLead } = await import('../feedback/adminNotifier.js');
        notifyAdminHighValueLead(lead, feedbackResult.feedback).catch(err => {
          console.warn('Admin notification error:', err.message);
        });
      }
    } catch (fbErr) {
      console.warn('Feedback processing error in outreach:', fbErr.message);
    }
  }

  return { lead, intent, haltOutreach, schedulingReply, meeting, feedbackResult };
}

/**
 * Creates and stages an outreach campaign (starts in 'pending_approval')
 */
export function createCampaign({ name, targetCountry, targetCity, targetCategory, minLeadScore = 40, dailyLimit = 20, customIntroTemplate = null }) {
  return createOutreachCampaign({
    name,
    targetCountry,
    targetCity,
    targetCategory,
    minLeadScore,
    dailyLimit,
    customIntroTemplate
  });
}

/**
 * Approves an outreach campaign so it can be launched
 */
export function approveCampaign(campaignId) {
  const campaign = getOutreachCampaignById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  return updateOutreachCampaign(campaignId, { status: 'approved' });
}

/**
 * Starts execution of an approved outreach campaign
 */
export async function startCampaign(campaignId) {
  const campaign = getOutreachCampaignById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    throw new Error(`Campaign must be approved before starting. Current status: ${campaign.status}`);
  }

  if (!isOutreachApproved()) {
    throw new Error('Outreach safety guardrail: Administrator has not confirmed product knowledge. Please approve product knowledge first.');
  }

  if (!isWhatsAppConnected()) {
    throw new Error('WhatsApp is not currently connected. Please ensure index.js is running and authenticated.');
  }

  const controller = { status: 'running' };
  activeCampaignControllers.set(Number(campaignId), controller);

  updateOutreachCampaign(campaignId, {
    status: 'running',
    startedAt: campaign.startedAt || new Date().toISOString()
  });

  // Launch campaign execution loop in background
  executeCampaignLoop(campaignId).catch((err) => {
    console.error(`[Campaign #${campaignId} Fatal Error]:`, err.message);
    updateOutreachCampaign(campaignId, { status: 'stopped', errorMessage: err.message });
    activeCampaignControllers.delete(Number(campaignId));
  });

  return { success: true, campaignId, status: 'running' };
}

/**
 * Pause a running campaign
 */
export function pauseCampaign(campaignId) {
  const controller = activeCampaignControllers.get(Number(campaignId));
  if (controller && controller.status === 'running') {
    controller.status = 'paused';
    updateOutreachCampaign(campaignId, { status: 'paused' });
    return true;
  }
  return false;
}

/**
 * Resume a paused campaign
 */
export function resumeCampaign(campaignId) {
  const controller = activeCampaignControllers.get(Number(campaignId));
  if (controller && controller.status === 'paused') {
    controller.status = 'running';
    updateOutreachCampaign(campaignId, { status: 'running' });
    return true;
  }
  // If not in memory, start fresh from paused state
  return startCampaign(campaignId);
}

/**
 * Stop a campaign permanently
 */
export function stopCampaign(campaignId) {
  const controller = activeCampaignControllers.get(Number(campaignId));
  if (controller) {
    controller.status = 'stopped';
    activeCampaignControllers.delete(Number(campaignId));
  }
  updateOutreachCampaign(campaignId, {
    status: 'stopped',
    completedAt: new Date().toISOString()
  });
  return true;
}

/**
 * Sends a test personalized outreach message to an administrator's authorized phone number
 */
export async function sendTestOutreachMessage(testPhone, leadData = {}) {
  if (!testPhone) throw new Error('Test phone number is required');

  const mockLead = {
    gymName: leadData.gymName || 'PowerFit Health Club',
    city: leadData.city || 'Indore',
    country: leadData.country || 'India',
    ownerName: leadData.ownerName || 'Vikram',
    gymCategory: leadData.gymCategory || 'Fitness Centre',
    ...leadData
  };

  const messageText = generatePersonalizedIntro(mockLead, leadData.customIntroTemplate);

  console.log(`📤 Sending Test Outreach Message to ${testPhone}...`);
  const result = await sendWhatsAppMessage(testPhone, messageText);

  // Record test message
  recordLeadMessage({
    leadId: null,
    campaignId: null,
    remoteJid: testPhone.includes('@') ? testPhone : `${testPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`,
    senderRole: 'agent',
    messageText,
    status: 'sent',
    intent: 'test_outreach'
  });

  return { success: true, testPhone, messageText, result };
}

/**
 * Background loop that executes outreach with polite human pacing
 */
async function executeCampaignLoop(campaignId) {
  const controller = activeCampaignControllers.get(Number(campaignId));
  const campaign = getOutreachCampaignById(campaignId);
  if (!controller || !campaign) return;

  console.log(`🚀 [Campaign #${campaignId}]: Starting outreach to eligible leads...`);

  const eligibleLeads = getEligibleLeadsForOutreach({
    country: campaign.targetCountry,
    city: campaign.targetCity,
    category: campaign.targetCategory,
    minScore: campaign.minLeadScore,
    limit: campaign.dailyLimit || 20
  });

  console.log(`📋 [Campaign #${campaignId}]: Found ${eligibleLeads.length} eligible prospects.`);

  let sentCount = campaign.sentCount || 0;
  let deliveredCount = campaign.deliveredCount || 0;
  let failedCount = campaign.failedCount || 0;

  for (const lead of eligibleLeads) {
    // Check pause or stop signal
    if (controller.status === 'stopped') {
      console.log(`⏹️ [Campaign #${campaignId}]: Stopped by administrator.`);
      break;
    }

    while (controller.status === 'paused') {
      console.log(`⏸️ [Campaign #${campaignId}]: Campaign paused. Waiting for resume...`);
      await new Promise(r => setTimeout(r, 2000));
      if (controller.status === 'stopped') break;
    }

    if (controller.status === 'stopped') break;

    const jid = `${lead.normalizedPhone}@s.whatsapp.net`;
    const introText = generatePersonalizedIntro(lead, campaign.customIntroTemplate);

    try {
      console.log(`📨 [Campaign #${campaignId}]: Sending outreach to ${lead.gymName} (+${lead.normalizedPhone})...`);
      await sendWhatsAppMessage(jid, introText);

      sentCount++;
      deliveredCount++;

      // Advance lead status to 'Contacted'
      updateLeadStatus(lead.id, 'Contacted', `Sent outreach campaign #${campaignId} (${campaign.name})`);

      // Record message
      recordLeadMessage({
        leadId: lead.id,
        campaignId,
        remoteJid: jid,
        senderRole: 'agent',
        messageText: introText,
        status: 'sent',
        intent: 'outreach'
      });

      // Update campaign metrics
      updateOutreachCampaign(campaignId, { sentCount, deliveredCount });

      // Human safety pacing: Wait 15 to 30 seconds between outreach messages to simulate natural behavior
      const delaySeconds = Math.floor(Math.random() * 15) + 15;
      console.log(`⏳ Pacing: Waiting ${delaySeconds}s before next outreach send...`);
      await new Promise(r => setTimeout(r, delaySeconds * 1000));

    } catch (err) {
      console.error(`❌ [Campaign #${campaignId}]: Failed to send to ${lead.gymName}:`, err.message);
      failedCount++;
      recordLeadMessage({
        leadId: lead.id,
        campaignId,
        remoteJid: jid,
        senderRole: 'agent',
        messageText: introText,
        status: 'failed',
        intent: 'outreach',
        errorMessage: err.message
      });
      updateOutreachCampaign(campaignId, { failedCount });
    }
  }

  // Mark campaign completed
  updateOutreachCampaign(campaignId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  });

  activeCampaignControllers.delete(Number(campaignId));
  console.log(`✅ [Campaign #${campaignId}]: Completed! Total sent: ${sentCount}, Failed: ${failedCount}`);
}
