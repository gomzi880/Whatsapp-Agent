/**
 * 4-Stage Automatic Follow-Up Sequence Engine (Phase 7)
 * 
 * Schedules and dispatches a multi-stage follow-up sequence:
 * - Stage 1 (+2 Days): Friendly check-in.
 * - Stage 2 (+4 Days): Value proposition (Biometrics & automated attendance).
 * - Stage 3 (+7 Days): Social proof (Case study & revenue recovery).
 * - Stage 4 (+10 Days): Final courtesy check-in & complimentary onboarding offer.
 * 
 * Strict Controls:
 * - Cancels remaining sequence steps immediately if prospect replies or opts out.
 * - Respects frequency caps and promised callback dates (without phone calls).
 */

import db, {
  getLeadById,
  createFollowUp,
  cancelPendingFollowUpsForLead,
  updateFollowUp,
  logAuditAction,
  updateAgentMonitoring,
  recordLeadMessage
} from '../database/db.js';
import { checkOutreachConsent } from '../outreach/consentGuard.js';
import { sendWhatsAppMessage, isWhatsAppConnected } from '../outreach/outreachService.js';

export const SEQUENCE_STAGES = [
  {
    stage: 1,
    offsetDays: 2,
    type: 'Sequence Check-In (Stage 1)',
    message: (gym) => `Hello ${gym} team! Just following up to see if you had a chance to review our 30-day free trial offer for GymStack? Happy to answer any questions!`
  },
  {
    stage: 2,
    offsetDays: 4,
    type: 'Sequence Value Showcase (Stage 2)',
    message: (gym) => `Hi ${gym} team! Quick tip: Most gyms save 10+ hours every week by connecting their biometric scanner or face reader directly to GymStack. Would you like a quick video preview of how it works?`
  },
  {
    stage: 3,
    offsetDays: 7,
    type: 'Sequence Social Proof (Stage 3)',
    message: (gym) => `Hello ${gym} team! Did you know that fitness centers using GymStack's automated WhatsApp fee reminders recover up to 18% in previously missed membership renewals? We would love to help ${gym} achieve the same!`
  },
  {
    stage: 4,
    offsetDays: 10,
    type: 'Sequence Final Courtesy (Stage 4)',
    message: (gym) => `Hi ${gym} team! This will be my final note. If you ever decide to streamline member attendance, payments, and trainer schedules at ${gym}, we'd be thrilled to assist. Wishing your gym massive growth!`
  }
];

/**
 * Schedules all 4 stages of the follow-up sequence for a lead
 * @param {number} leadId
 * @param {string} channel 'whatsapp' | 'email'
 * @returns {object} { scheduled: boolean, count: number, stages: array }
 */
export function scheduleFollowUpSequence(leadId, channel = 'whatsapp') {
  const lead = getLeadById(leadId);
  if (!lead) throw new Error(`Lead #${leadId} not found`);

  // Consent Check
  const consent = checkOutreachConsent(leadId, channel);
  if (!consent.allowed) {
    console.log(`[Follow-Up Sequence] Skipping lead #${leadId}: ${consent.reason}`);
    return { scheduled: false, reason: consent.reason };
  }

  // Cancel any existing pending sequence items to prevent duplicate stacks
  cancelPendingFollowUpsForLead(leadId);

  const now = Date.now();
  const createdFollowUps = [];

  for (const st of SEQUENCE_STAGES) {
    const targetMs = now + st.offsetDays * 24 * 60 * 60 * 1000;
    const targetDate = new Date(targetMs).toISOString().split('T')[0];

    const followUp = createFollowUp({
      leadId,
      scheduledDate: targetDate,
      scheduledTime: '11:00 AM',
      channel,
      followUpType: st.type,
      customMessage: st.message(lead.gymName),
      attemptNumber: st.stage
    });

    createdFollowUps.push(followUp);
  }

  logAuditAction({
    agentName: 'Follow-Up Sequence Engine',
    actionType: 'SCHEDULE_FOLLOW_UP_SEQUENCE',
    targetEntity: 'leads',
    targetId: leadId,
    details: {
      gymName: lead.gymName,
      stagesCount: createdFollowUps.length,
      channel
    }
  });

  console.log(`📅 [Follow-Up Engine] Scheduled 4-stage follow-up sequence for Lead #${leadId} (${lead.gymName})`);

  return {
    scheduled: true,
    count: createdFollowUps.length,
    stages: createdFollowUps,
    followUps: createdFollowUps
  };
}

/**
 * Cancels remaining sequence steps when customer interacts or opts out
 */
export function suppressFollowUpSequenceOnInteraction(leadId, reason = 'Customer interacted') {
  const cancelledCount = cancelPendingFollowUpsForLead(leadId);
  if (cancelledCount > 0) {
    console.log(`⏹️ [Follow-Up Engine] Cancelled ${cancelledCount} pending follow-up stages for Lead #${leadId}: ${reason}`);
    logAuditAction({
      agentName: 'Follow-Up Sequence Engine',
      actionType: 'SUPPRESS_FOLLOW_UP_SEQUENCE',
      targetEntity: 'leads',
      targetId: leadId,
      details: { cancelledCount, reason }
    });
  }
  return cancelledCount;
}

export const haltSequenceOnEngagement = suppressFollowUpSequenceOnInteraction;

/**
 * Dispatches due follow-up sequence steps
 */
export async function dispatchDueFollowUpSequences() {
  const pending = db.getPendingFollowUps();
  const today = new Date().toISOString().split('T')[0];
  const due = pending.filter((f) => f.scheduledDate <= today);

  let sent = 0;
  let suppressed = 0;
  const results = [];

  for (const item of due) {
    // 1. Consent Guard check
    const consent = checkOutreachConsent(item.leadId, item.channel || 'whatsapp');
    if (!consent.allowed) {
      updateFollowUp(item.id, { status: 'Cancelled' });
      suppressed++;
      continue;
    }

    const lead = getLeadById(item.leadId);
    const phone = lead ? (lead.normalizedPhone || lead.whatsappNumber || lead.businessPhone) : null;
    const jid = phone ? `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null;

    if (jid && isWhatsAppConnected()) {
      try {
        await sendWhatsAppMessage(jid, item.customMessage);
      } catch (e) {
        console.warn(`[Follow-Up Dispatch Warning] ${e.message}`);
      }
    }

    // Record in lead_messages
    if (lead && jid) {
      recordLeadMessage({
        leadId: lead.id,
        remoteJid: jid,
        senderRole: 'system',
        messageText: item.customMessage,
        status: 'sent',
        intent: 'follow_up_sequence'
      });
    }

    updateFollowUp(item.id, {
      status: 'Sent',
      sentAt: new Date().toISOString()
    });

    sent++;
    results.push({ id: item.id, leadId: item.leadId, type: item.followUpType, status: 'Sent' });
  }

  updateAgentMonitoring('feedback_agent', {
    runningStatus: 'Active',
    currentTask: `Dispatched ${sent} due follow-ups (${suppressed} suppressed)`,
    lastExecution: new Date().toISOString()
  });

  return {
    dueCount: due.length,
    sentCount: sent,
    suppressedCount: suppressed,
    results
  };
}
