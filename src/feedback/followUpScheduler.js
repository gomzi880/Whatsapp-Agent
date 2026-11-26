import db, { getLeadById, queryLeads } from '../database/db.js';
import { generateFeedbackMessage } from './feedbackService.js';
import { notifyAdminHighValueLead } from './adminNotifier.js';

/**
 * Schedule a post-demo follow-up (default: 24h after demonstration)
 */
export function schedulePostDemoFollowUp({ leadId, meetingId = null, delayHours = 24, channel = 'whatsapp' }) {
  const lead = getLeadById(leadId);
  if (!lead) throw new Error(`Lead #${leadId} not found`);

  // Verify eligibility (opt-out check, limits)
  const eligibility = db.checkFollowUpEligibility(leadId);
  if (!eligibility.eligible) {
    console.log(`[FollowUpScheduler] Skipping follow-up schedule for lead #${leadId}: ${eligibility.reason}`);
    return { scheduled: false, reason: eligibility.reason };
  }

  const scheduledTimestamp = new Date(Date.now() + delayHours * 60 * 60 * 1000);
  const scheduledDate = scheduledTimestamp.toISOString().split('T')[0];
  const scheduledTime = scheduledTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const record = db.createFollowUp({
    leadId,
    meetingId,
    scheduledDate,
    scheduledTime,
    channel,
    followUpType: 'Demo Feedback',
    customMessage: `Follow-up on Gym Stack demonstration with 6 quick feedback questions.`
  });

  console.log(`[FollowUpScheduler] Scheduled post-demo feedback follow-up #${record.id} for lead #${leadId} at ${scheduledDate} ${scheduledTime}`);
  return { scheduled: true, followUp: record };
}

/**
 * Schedule a promised callback reminder without making phone calls.
 * This sets up a text/WhatsApp or email reminder for that promised date.
 */
export function schedulePromisedCallback({ leadId, callbackDate, customNote = '', channel = 'whatsapp' }) {
  const lead = getLeadById(leadId);
  if (!lead) throw new Error(`Lead #${leadId} not found`);

  // Check eligibility
  const eligibility = db.checkFollowUpEligibility(leadId);
  if (!eligibility.eligible) {
    return { scheduled: false, reason: eligibility.reason };
  }

  // Normalize date
  let targetDate = callbackDate;
  if (!targetDate || !targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // If text like "Monday" or relative, set 3 days out by default
    targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  const record = db.createFollowUp({
    leadId,
    scheduledDate: targetDate,
    scheduledTime: '11:00 AM',
    channel,
    followUpType: 'Promised Callback',
    customMessage: customNote || `Gentle text follow-up as promised on ${callbackDate}. (NO VOICE CALL - Text Outreach Only)`,
    promisedCallbackDate: callbackDate
  });

  console.log(`[FollowUpScheduler] Promised callback text reminder #${record.id} set for lead #${leadId} on ${targetDate}`);
  return { scheduled: true, followUp: record };
}

/**
 * Schedule a meeting reminder (24h or 2h before a scheduled meeting)
 */
export function scheduleMeetingReminder({ meetingId, leadId, meetingDate, meetingTime, channel = 'whatsapp' }) {
  const record = db.createFollowUp({
    leadId,
    meetingId,
    scheduledDate: meetingDate,
    scheduledTime: meetingTime || '09:00 AM',
    channel,
    followUpType: 'Meeting Reminder',
    customMessage: `Reminder: Gym Stack demonstration is scheduled today at ${meetingTime}.`
  });
  return record;
}

/**
 * Execute due pending follow-ups (scans for pending follow-ups scheduled for today or earlier)
 */
export async function executeDueFollowUps() {
  const pending = db.getPendingFollowUps();
  const results = {
    executed: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  const today = new Date().toISOString().split('T')[0];

  for (const item of pending) {
    if (item.scheduledDate > today) {
      // Future follow-up, do not send yet
      continue;
    }

    const lead = getLeadById(item.leadId);
    if (!lead) {
      db.updateFollowUp(item.id, { status: 'Failed' });
      results.errors++;
      continue;
    }

    // Enforce opt-out and frequency guardrails
    const eligibility = db.checkFollowUpEligibility(item.leadId);
    if (!eligibility.eligible) {
      console.log(`[FollowUpScheduler] Cancelling follow-up #${item.id} for lead #${item.leadId}: ${eligibility.reason}`);
      db.updateFollowUp(item.id, { status: 'Cancelled' });
      results.skipped++;
      results.details.push({ id: item.id, gymName: lead.gymName, status: 'Cancelled', reason: eligibility.reason });
      continue;
    }

    try {
      let sent = false;
      const channel = item.channel || (lead.whatsappNumber ? 'whatsapp' : 'email');

      if (channel === 'whatsapp' && lead.whatsappNumber) {
        // Send WhatsApp message
        try {
          const { campaignManager } = await import('../outreach/campaignManager.js');
          const msgObj = generateFeedbackMessage(lead, null, 'whatsapp');
          await campaignManager.sendWhatsAppMessage(lead.whatsappNumber, msgObj.text);
          sent = true;
        } catch (waErr) {
          console.warn(`[FollowUpScheduler] WhatsApp send failed for follow-up #${item.id}:`, waErr.message);
        }
      } else if (channel === 'email' && lead.email) {
        // Send Email
        try {
          const { emailSender } = await import('../email/emailSender.js');
          const msgObj = generateFeedbackMessage(lead, null, 'email');
          await emailSender.sendEmail({
            from: 'sales@gymstack.in',
            to: lead.email,
            subject: msgObj.subject,
            text: msgObj.text,
            html: msgObj.html
          });
          sent = true;
        } catch (mailErr) {
          console.warn(`[FollowUpScheduler] Email send failed for follow-up #${item.id}:`, mailErr.message);
        }
      }

      if (sent) {
        db.updateFollowUp(item.id, {
          status: 'Sent',
          sentAt: new Date().toISOString(),
          attemptNumber: (item.attemptNumber || 0) + 1
        });
        results.executed++;
        results.details.push({ id: item.id, gymName: lead.gymName, status: 'Sent', channel });
      } else {
        // Retry or mark pending
        db.updateFollowUp(item.id, {
          status: 'Failed'
        });
        results.errors++;
        results.details.push({ id: item.id, gymName: lead.gymName, status: 'Failed' });
      }
    } catch (err) {
      console.error(`[FollowUpScheduler] Error processing follow-up #${item.id}:`, err);
      results.errors++;
      results.details.push({ id: item.id, status: 'Error', error: err.message });
    }
  }

  return results;
}

/**
 * Identify leads who have not replied after receiving outreach or completing a demo
 */
export function identifyUnresponsiveLeads(daysThreshold = 3) {
  const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
  
  // Leads who were Contacted or Qualified before cutoff date, not unsubscribed or converted, and have no feedbacks logged
  const result = queryLeads({}, 1, 1000);
  const leads = result.leads || [];
  const unresponsive = leads.filter(l => {
    if (l.status === 'Unsubscribed' || l.status === 'Converted' || l.status === 'Interested') return false;
    if (l.status === 'Contacted' && l.updatedAt && l.updatedAt < cutoffDate) {
      const existingFeedbacks = db.getFeedbacks({ leadId: l.id });
      return existingFeedbacks.length === 0;
    }
    return false;
  });

  return unresponsive;
}

export default {
  schedulePostDemoFollowUp,
  schedulePromisedCallback,
  scheduleMeetingReminder,
  executeDueFollowUps,
  identifyUnresponsiveLeads
};
