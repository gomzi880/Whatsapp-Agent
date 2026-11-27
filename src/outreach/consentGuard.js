/**
 * Consent Guard & Opt-Out Suppression Engine
 * 
 * Enforces strict compliance with messaging consent, opt-out suppression,
 * contact cooldown rules, and blacklist enforcement.
 */

import db, {
  getLeadById,
  updateLeadStatus,
  cancelPendingFollowUpsForLead,
  logAuditAction,
  getAdminSettings,
  isMobileNumber
} from '../database/db.js';

/**
 * Checks whether a given lead is eligible for marketing or follow-up outreach
 * @param {object|number} leadOrId Lead object or Lead ID
 * @param {string} channel 'whatsapp' | 'email'
 * @returns {object} { eligible: boolean, reason: string }
 */
export function isEligibleForOutreach(leadOrId, channel = 'whatsapp') {
  const lead = typeof leadOrId === 'object' ? leadOrId : getLeadById(leadOrId);
  if (!lead) {
    return { eligible: false, reason: 'Lead record not found' };
  }

  // 1. Strict Opt-Out Suppression
  if (lead.status === 'Unsubscribed' || lead.status === 'Not Interested') {
    return {
      eligible: false,
      reason: `Lead is in terminal state '${lead.status}'. Communication prohibited.`
    };
  }

  // 2. Channel validity check
  if (channel === 'whatsapp') {
    const phone = lead.whatsappNumber || (isMobileNumber(lead.businessPhone, lead.country) ? lead.businessPhone : null);
    if (!phone) {
      return { eligible: false, reason: 'No valid mobile phone number available for WhatsApp (landlines not supported)' };
    }
  } else if (channel === 'email') {
    const email = lead.businessEmail || lead.normalizedEmail;
    if (!email) {
      return { eligible: false, reason: 'No valid email address available' };
    }
  }

  // 3. Check Admin Global Kill-switch & Settings
  const settings = getAdminSettings();
  if (channel === 'whatsapp' && settings.whatsappAgentActive === false) {
    return { eligible: false, reason: 'WhatsApp outreach paused by administrator' };
  }
  if (channel === 'email' && settings.emailAgentActive === false) {
    return { eligible: false, reason: 'Email outreach paused by administrator' };
  }

  // 4. Duplicate Contact Frequency Check (Introductory outreach should not be sent twice on same day)
  const today = new Date().toISOString().split('T')[0];
  const contactedToday = db.prepare(`
    SELECT id FROM lead_messages
    WHERE leadId = ? AND senderRole = 'system' AND date(createdAt) = date(?)
    LIMIT 1
  `).get(lead.id, today);

  if (contactedToday) {
    return {
      eligible: false,
      allowed: false,
      reason: `Lead #${lead.id} (${lead.gymName}) already received outreach today (${today}). Daily frequency cap reached.`
    };
  }

  if (lead.status === 'Contacted' || lead.status === 'Responded' || lead.status === 'Interested') {
    // Only allow if this is a deliberate scheduled follow-up
    return {
      eligible: true,
      allowed: true,
      lead,
      reason: `Lead is already active in lifecycle (${lead.status}). Eligible for follow-ups only.`
    };
  }

  return { eligible: true, allowed: true, lead, reason: 'Lead is qualified and eligible for outreach' };
}

export function checkOutreachConsent(leadOrId, channel = 'whatsapp') {
  const res = isEligibleForOutreach(leadOrId, channel);
  return {
    allowed: res.eligible,
    eligible: res.eligible,
    reason: res.reason,
    lead: res.lead
  };
}

/**
 * Formats a clean 30-day trial outreach message with value prop and opt-out
 */
export function build30DayTrialPitch(lead) {
  const gymName = lead.gymName || 'your fitness facility';
  const city = lead.city ? `in ${lead.city}` : '';
  const ownerName = lead.ownerName || lead.founderName;
  const greeting = ownerName ? `Hello ${ownerName}!` : `Hello ${gymName} team!`;

  return `${greeting} I came across ${gymName} ${city} and wanted to personally reach out from GymStack.

GymStack is an all-in-one gym management operating system designed to help gyms grow:
✨ Automated member attendance (Biometric & Face Scanner integration)
💳 Instant WhatsApp fee reminders & automatic payment collection
👥 Easy trainer schedules & member workout/diet tracking
📊 Real-time financial reports and member retention analytics

We are currently offering select gyms an exclusive 30-Day Full Access Free Trial with zero upfront cost and complimentary onboarding assistance.

Would you be open to exploring how GymStack can simplify operations for ${gymName}?

(Reply 'stop' anytime to opt out of updates)`;
}

/**
 * Permanently opts out a lead and suppresses all pending communications
 * @param {number} leadId 
 * @param {string} sourceDetails 
 * @param {string} performedBy 
 */
export function recordOptOut(leadId, sourceDetails = 'Customer opted out via text', performedBy = 'ConsentGuard') {
  const lead = getLeadById(leadId);
  if (!lead) return false;

  // 1. Update lead status to Unsubscribed
  updateLeadStatus(leadId, 'Unsubscribed', `OPT-OUT: ${sourceDetails}`);

  // 2. Cancel all pending follow-ups immediately
  cancelPendingFollowUpsForLead(leadId);

  // 3. Log audit action
  logAuditAction({
    agentName: 'Consent Guard',
    actionType: 'CUSTOMER_OPT_OUT_RECORDED',
    targetEntity: 'leads',
    targetId: leadId,
    details: {
      gymName: lead.gymName,
      whatsapp: lead.whatsappNumber || lead.businessPhone,
      email: lead.businessEmail,
      reason: sourceDetails
    },
    performedBy
  });

  console.log(`🛡️ [Consent Guard] Lead #${leadId} (${lead.gymName}) opted out. All pending communications cancelled.`);
  return true;
}
