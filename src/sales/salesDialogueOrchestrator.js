/**
 * Fully Autonomous Sales Dialogue Orchestrator (Phase 5)
 * 
 * Manages multilingual, consultative, objection-handling sales conversations:
 * - Detects pain points (uncollected fees, biometric attendance, trainer tracking).
 * - Delivers consultative objection handling (ROI calculation, competitor differentiation, 15-min setup).
 * - Drives prospects toward scheduling a live demonstration or enrolling in a 30-Day Free Trial.
 * - Detects high-value multi-branch prospects and alerts administrators.
 */

import { generateHumanReply } from '../../ai.js';
import db, {
  findLeadByPhoneOrJid,
  updateLeadStatus,
  recordLeadMessage,
  logAuditAction,
  updateAgentMonitoring
} from '../database/db.js';
import { isHighValueProspect, sendHighValueAdminAlert } from './adminAlertService.js';
import { detectProspectIntent } from '../outreach/campaignManager.js';

export const OBJECTION_SCRIPTS = {
  pricing: `GymStack is designed so that recovered uncollected fees pay for the entire software within the first 2-3 weeks! For example, gyms typically recover ₹15,000 to ₹40,000 per month just from automated WhatsApp expiry reminders and biometric access gating. We have flexible plans starting from ₹1,499/mo with zero setup fees. Would you like to test it out completely free with our 30-day full access trial?`,
  competitor: `Many existing gym apps are either complicated accounting software or charge extra per-SMS charges. GymStack is built WhatsApp-native with direct Biometric & Face Scanner integration, automated WhatsApp fee links, trainer commissions, and instant member workout cards all in one dashboard. Plus, you get a dedicated account manager to assist your team.`,
  complexity: `Not at all! GymStack is engineered for simplicity — our team sets up your gym, imports your existing member database from Excel or paper registers within 15 minutes, and trains your front desk staff for free. You don't need any technical skills to use it.`
};

/**
 * Orchestrates an autonomous consultative sales conversation
 * @param {object} params { remoteJid, messageText, channel }
 * @returns {Promise<object>} { replyText, intent, lead, highValueAlertSent }
 */
export async function orchestrateSalesDialogue({
  remoteJid,
  messageText,
  channel = 'whatsapp'
}) {
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  const lead = findLeadByPhoneOrJid(phone);
  const intent = detectProspectIntent(messageText);

  console.log(`💬 [Sales Dialogue] From: ${remoteJid} | Intent: ${intent} | Lead: ${lead ? lead.gymName : 'Unregistered'}`);

  // 1. High-Value / Enterprise Detection
  let highValueAlertSent = false;
  if (lead && isHighValueProspect(lead, { userMessage: messageText, intent })) {
    const alertRes = await sendHighValueAdminAlert(lead, {
      reason: `Multi-branch lead (${lead.branchesCount || 1} branches) or high-volume inquiry`,
      userMessage: messageText
    });
    highValueAlertSent = alertRes.alertSent;
  }

  // 2. Generate Consultative AI Reply
  // We call generateHumanReply from ai.js which leverages RAG + Gemini + Sales Manager persona
  let aiReplyText = null;
  try {
    const rawReply = await generateHumanReply(remoteJid, messageText);
    aiReplyText = typeof rawReply === 'object' && rawReply !== null
      ? (rawReply.text || String(rawReply))
      : String(rawReply || '');
  } catch (err) {
    console.warn('[Sales Dialogue AI Warning]:', err.message);
    // Intelligent rule-based fallback based on intent
    if (intent === 'pricing') {
      aiReplyText = OBJECTION_SCRIPTS.pricing;
    } else if (intent === 'already_using_other') {
      aiReplyText = OBJECTION_SCRIPTS.competitor;
    } else if (intent === 'demo_requested') {
      aiReplyText = `I would love to walk you through a quick 10-minute live demonstration of GymStack! What date and time works best for you? (We also activate your 30-day full access free trial immediately during the demo!)`;
    } else {
      aiReplyText = `Thank you for connecting with GymStack! GymStack helps gyms streamline biometric attendance, automate fee collections over WhatsApp, and boost member retention. Would you like to schedule a quick 5-minute demo or test our 30-day free trial?`;
    }
  }

  // 3. Lifecycle Status Advancement
  if (lead) {
    if (intent === 'demo_requested' && lead.status !== 'Meeting Requested' && lead.status !== 'Meeting Scheduled') {
      updateLeadStatus(lead.id, 'Meeting Requested', `Prospect requested demo: "${messageText.slice(0, 40)}"`);
    } else if (intent === 'interested' && lead.status !== 'Interested') {
      updateLeadStatus(lead.id, 'Interested', `Prospect expressed interest: "${messageText.slice(0, 40)}"`);
    } else if (intent === 'pricing' && lead.status === 'Contacted') {
      updateLeadStatus(lead.id, 'Responded', `Inquired about pricing plans`);
    }
  }

  // 4. Record outbound AI message in lead_messages
  if (lead) {
    recordLeadMessage({
      leadId: lead.id,
      remoteJid,
      senderRole: 'assistant',
      messageText: aiReplyText,
      status: 'sent',
      intent
    });
  }

  updateAgentMonitoring('sales_agent', {
    runningStatus: 'Active',
    currentTask: `Engaged in sales dialogue with ${lead ? lead.gymName : remoteJid}`,
    lastExecution: new Date().toISOString()
  });

  return {
    replyText: aiReplyText,
    intent,
    lead,
    highValueAlertSent
  };
}
