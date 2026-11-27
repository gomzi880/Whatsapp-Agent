/**
 * 30-Day Free Trial Conversion Tracker (Phase 6)
 * 
 * Manages the complete lifecycle of customer free trials:
 * - Enrollment in 30-day full access trial.
 * - Daily lifecycle milestone monitoring (Day 7, Day 14, Day 21, Day 28, Day 30).
 * - Milestone message generation with feature tips and usage recommendations.
 * - Expiry warnings with exclusive conversion offers.
 * - Conversion into paying customer with automated lifecycle updating and audit trails.
 */

import db, {
  createFreeTrialSubscription,
  getFreeTrialSubscriptions,
  updateFreeTrialSubscription,
  updateLeadStatus,
  logAuditAction,
  updateAgentMonitoring,
  getLeadById
} from '../database/db.js';

export const TRIAL_MILESTONES = {
  DAY_7: {
    day: 7,
    title: 'First Week Check-In: Biometrics & Attendance',
    message: (gym) => `Hello ${gym}! Hope your first week with GymStack has been smooth. Have you tried syncing your biometric scanner or testing the QR code check-in feature yet? Let us know if you need any setup assistance!`
  },
  DAY_14: {
    day: 14,
    title: 'Mid-Trial Check-In: WhatsApp Fee Reminders',
    message: (gym) => `Hello ${gym}! You are halfway through your 30-day GymStack trial. Gyms using our automated WhatsApp fee collection notice a 25% drop in delayed payments. Would you like a 5-minute walkthrough on setting up auto-reminders?`
  },
  DAY_21: {
    day: 21,
    title: 'Week 3 Review: Trainer Management & Member App',
    message: (gym) => `Hello ${gym}! Only 9 days remaining in your GymStack free trial. How is your team finding the trainer assignment and member workout tracking features? We're here to assist with any questions!`
  },
  DAY_28: {
    day: 28,
    title: 'Trial Expiry Warning & Special Conversion Offer',
    message: (gym) => `Hello ${gym}! Your GymStack 30-day free trial expires in 48 hours. To ensure uninterrupted access for your members and staff, upgrade today and receive a 20% early-bird discount on our Annual Plan! Reply YES to activate.`
  }
};

/**
 * Enrolls a lead in a 30-Day Free Trial
 */
export function enrollInFreeTrial({
  leadId,
  gymName,
  contactPhone = null,
  contactEmail = null,
  planTier = 'Standard',
  notes = ''
}) {
  return createFreeTrialSubscription({
    leadId,
    gymName,
    contactPhone,
    contactEmail,
    trialDurationDays: 30,
    planTier,
    notes
  });
}

/**
 * Calculates trial duration and days elapsed
 */
export function calculateTrialDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const now = new Date();

  const totalDurationDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

  return {
    totalDurationDays,
    daysElapsed,
    daysRemaining,
    isExpired: daysRemaining <= 0
  };
}

/**
 * Evaluates all active free trials and identifies due milestones or expirations
 */
export function checkAllTrialStatuses() {
  const activeTrials = getFreeTrialSubscriptions({ status: 'Active' });
  const results = {
    evaluatedCount: activeTrials.length,
    milestonesTriggered: [],
    expiredCount: 0,
    expiringSoonCount: 0
  };

  for (const trial of activeTrials) {
    const calc = calculateTrialDays(trial.trialStartDate, trial.trialEndDate);

    if (calc.isExpired) {
      updateFreeTrialSubscription(trial.id, { status: 'Expired' });
      updateLeadStatus(trial.leadId, 'Follow-up Required', '30-day trial expired without conversion');
      results.expiredCount++;
      continue;
    }

    if (calc.daysRemaining <= 3) {
      results.expiringSoonCount++;
    }

    // Determine milestone
    let milestone = null;
    if (calc.daysElapsed === 7) milestone = TRIAL_MILESTONES.DAY_7;
    else if (calc.daysElapsed === 14) milestone = TRIAL_MILESTONES.DAY_14;
    else if (calc.daysElapsed === 21) milestone = TRIAL_MILESTONES.DAY_21;
    else if (calc.daysElapsed === 28) milestone = TRIAL_MILESTONES.DAY_28;

    if (milestone) {
      results.milestonesTriggered.push({
        trialId: trial.id,
        leadId: trial.leadId,
        gymName: trial.gymName,
        milestone: milestone.title,
        message: milestone.message(trial.gymName)
      });
    }
  }

  updateAgentMonitoring('trial_tracker_agent', {
    runningStatus: 'Active',
    currentTask: `Evaluated ${activeTrials.length} active trials (${results.expiringSoonCount} expiring soon)`,
    lastExecution: new Date().toISOString()
  });

  return results;
}

/**
 * Converts a trial into a paying customer
 */
export function convertTrialToPaidCustomer({
  subscriptionId,
  planTier = 'Standard',
  billingCycle = 'Monthly',
  amount = 1999
}) {
  const trial = db.prepare('SELECT * FROM free_trial_subscriptions WHERE id = ?').get(subscriptionId);
  if (!trial) throw new Error(`Subscription #${subscriptionId} not found`);

  const now = new Date().toISOString();

  // 1. Update trial record
  updateFreeTrialSubscription(subscriptionId, {
    status: 'Converted',
    convertedToPaidAt: now,
    planTier,
    notes: `Converted to ${billingCycle} ${planTier} plan (Amount: ₹${amount})`
  });

  // 2. Advance lead status to Converted
  updateLeadStatus(trial.leadId, 'Converted', `Customer converted from 30-day trial to paid ${planTier} plan`);

  // 3. Log audit action
  logAuditAction({
    agentName: 'Trial Tracker Agent',
    actionType: 'TRIAL_CONVERTED_TO_PAID',
    targetEntity: 'free_trial_subscriptions',
    targetId: subscriptionId,
    details: {
      leadId: trial.leadId,
      gymName: trial.gymName,
      planTier,
      billingCycle,
      amount
    }
  });

  console.log(`🎉 [Trial Tracker] Lead #${trial.leadId} (${trial.gymName}) CONVERTED to paid ${planTier} customer!`);

  return {
    success: true,
    subscriptionId,
    leadId: trial.leadId,
    gymName: trial.gymName,
    status: 'Converted'
  };
}

/**
 * Aggregates trial conversion metrics
 */
export function getTrialDashboardStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM free_trial_subscriptions').get().count;
  const active = db.prepare("SELECT COUNT(*) as count FROM free_trial_subscriptions WHERE status = 'Active'").get().count;
  const converted = db.prepare("SELECT COUNT(*) as count FROM free_trial_subscriptions WHERE status = 'Converted'").get().count;
  const expired = db.prepare("SELECT COUNT(*) as count FROM free_trial_subscriptions WHERE status = 'Expired'").get().count;

  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return {
    totalTrials: total,
    activeTrials: active,
    convertedTrials: converted,
    expiredTrials: expired,
    conversionRatePercent: conversionRate
  };
}
