/**
 * Unified CRM Profile & Omnichannel Timeline Synchronization (Phase 12)
 * 
 * Provides a single source of truth for each gym lead:
 * - Unified prospect profile (contact info, address, qualification score, lifecycle stage).
 * - Chronologically interleaved communication timeline across WhatsApp, Email, Meetings, and Feedback.
 * - Cross-channel opt-out synchronization: Opting out on WhatsApp immediately suppresses Email outreach and vice versa.
 */

import db, {
  getLeadById,
  updateLeadStatus,
  cancelPendingFollowUpsForLead,
  logAuditAction
} from '../database/db.js';

/**
 * Retrieves the complete unified CRM profile and chronological timeline for a lead
 * @param {number} leadId
 * @returns {object} { lead, timeline, summary }
 */
export function getUnifiedLeadProfile(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return null;

  // 1. WhatsApp Messages
  const waMessages = db.prepare(`
    SELECT id, senderRole, messageText, status, intent, createdAt, 'whatsapp' as channel
    FROM lead_messages
    WHERE leadId = ?
  `).all(leadId);

  // 2. Email Messages
  const emailMessages = db.prepare(`
    SELECT id, direction, subject, bodyText, bodyHtml, status, intent, hasAttachment, createdAt, 'email' as channel
    FROM lead_emails
    WHERE leadId = ?
  `).all(leadId);

  // 3. Demonstration Meetings
  const meetings = db.prepare(`
    SELECT id, meetingDate, startTime, timeZone, status, meetingLink, createdAt, 'meeting' as channel
    FROM meetings
    WHERE leadId = ?
  `).all(leadId);

  // 4. Feedback Surveys
  const feedbacks = db.prepare(`
    SELECT id, rating, feedbackCategory, sentiment, rawResponseText, purchaseInterest, createdAt, 'feedback' as channel
    FROM feedbacks
    WHERE leadId = ?
  `).all(leadId);

  // 5. Follow-Up Reminders
  const followUps = db.prepare(`
    SELECT id, scheduledDate, scheduledTime, channel, followUpType, status, attemptNumber, createdAt, 'follow_up' as eventType
    FROM follow_ups
    WHERE leadId = ?
  `).all(leadId);

  // 6. Free Trial Subscriptions
  const trials = db.prepare(`
    SELECT id, trialStartDate, trialEndDate, status, planTier, createdAt, 'trial' as eventType
    FROM free_trial_subscriptions
    WHERE leadId = ?
  `).all(leadId);

  // Combine and interleave all events into a unified chronological timeline
  const timeline = [];

  waMessages.forEach((m) => {
    timeline.push({
      id: `wa_${m.id}`,
      type: 'whatsapp_message',
      channel: 'whatsapp',
      direction: m.senderRole === 'system' || m.senderRole === 'assistant' ? 'outbound' : 'inbound',
      title: m.senderRole === 'assistant' ? 'AI Sales Reply' : (m.senderRole === 'system' ? 'Automated Outreach' : 'Prospect WhatsApp Message'),
      content: m.messageText,
      status: m.status,
      intent: m.intent,
      timestamp: m.createdAt
    });
  });

  emailMessages.forEach((e) => {
    timeline.push({
      id: `email_${e.id}`,
      type: 'email_message',
      channel: 'email',
      direction: e.direction === 'outbound' ? 'outbound' : 'inbound',
      title: `Email: ${e.subject}`,
      content: e.bodyText || e.subject,
      status: e.status,
      intent: e.intent,
      hasAttachment: Boolean(e.hasAttachment),
      timestamp: e.createdAt
    });
  });

  meetings.forEach((mtg) => {
    timeline.push({
      id: `mtg_${mtg.id}`,
      type: 'demonstration_meeting',
      channel: 'calendar',
      direction: 'event',
      title: `Demo Meeting (${mtg.status})`,
      content: `Scheduled on ${mtg.meetingDate} at ${mtg.startTime} (${mtg.timeZone}). Meet Link: ${mtg.meetingLink || 'Pending confirmation'}`,
      status: mtg.status,
      timestamp: mtg.createdAt
    });
  });

  feedbacks.forEach((fb) => {
    timeline.push({
      id: `fb_${fb.id}`,
      type: 'feedback_survey',
      channel: 'survey',
      direction: 'inbound',
      title: `Feedback: ${fb.feedbackCategory} (${fb.sentiment})`,
      content: fb.rawResponseText || `Purchase Interest: ${fb.purchaseInterest}`,
      rating: fb.rating,
      timestamp: fb.createdAt
    });
  });

  followUps.forEach((fu) => {
    timeline.push({
      id: `fu_${fu.id}`,
      type: 'follow_up_scheduled',
      channel: fu.channel || 'whatsapp',
      direction: 'event',
      title: `Follow-Up: ${fu.followUpType} (${fu.status})`,
      content: `Scheduled for ${fu.scheduledDate} ${fu.scheduledTime || ''}`,
      status: fu.status,
      timestamp: fu.createdAt
    });
  });

  trials.forEach((tr) => {
    timeline.push({
      id: `tr_${tr.id}`,
      type: 'free_trial',
      channel: 'portal',
      direction: 'event',
      title: `30-Day Free Trial (${tr.status})`,
      content: `Plan: ${tr.planTier} | Active: ${tr.trialStartDate} to ${tr.trialEndDate}`,
      status: tr.status,
      timestamp: tr.createdAt
    });
  });

  // Sort descending (latest event first)
  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    lead,
    stats: {
      totalWhatsAppMessages: waMessages.length,
      totalEmails: emailMessages.length,
      totalMeetings: meetings.length,
      totalFeedbacks: feedbacks.length,
      totalFollowUps: followUps.length,
      totalTrials: trials.length,
      timelineEventsCount: timeline.length
    },
    timeline
  };
}

/**
 * Synchronizes opt-out across ALL communication channels
 * @param {number} leadId
 * @param {object} details { reason, sourceChannel }
 */
export function syncCrossChannelOptOut(leadId, details = {}) {
  const {
    reason = 'Customer requested opt-out / unsubscribe',
    sourceChannel = 'whatsapp',
    performedBy = 'OmnichannelCrm'
  } = details;

  const lead = getLeadById(leadId);
  if (!lead) return false;

  // 1. Advance lead to terminal status 'Unsubscribed'
  updateLeadStatus(leadId, 'Unsubscribed', `CROSS-CHANNEL OPT-OUT (${sourceChannel.toUpperCase()}): ${reason}`);

  // 2. Cancel all pending follow-ups across all channels
  const cancelledFollowUps = cancelPendingFollowUpsForLead(leadId);

  // 3. Log audit action
  logAuditAction({
    agentName: 'Omnichannel CRM Engine',
    actionType: 'CROSS_CHANNEL_OPT_OUT_SYNCED',
    targetEntity: 'leads',
    targetId: leadId,
    details: {
      gymName: lead.gymName,
      whatsapp: lead.whatsappNumber || lead.businessPhone,
      email: lead.businessEmail,
      sourceChannel,
      reason,
      cancelledFollowUps
    },
    performedBy
  });

  console.log(`🛡️ [Omnichannel CRM] Lead #${leadId} (${lead.gymName}) opted out via ${sourceChannel}. Suppressed across WhatsApp and Email.`);
  return true;
}
