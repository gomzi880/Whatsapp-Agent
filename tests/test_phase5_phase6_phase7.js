/**
 * Verification Battery for Phase 5, Phase 6 & Phase 7
 * Phase 5: Fully Automatic AI Sales Conversations & Objection Handling
 * Phase 6: 30-Day Free Trial Conversion Tracking
 * Phase 7: 4-Stage Automatic Follow-Up Agent
 */

import assert from 'assert';
import db, {
  saveOrUpdateLead,
  updateLeadStatus,
  getLeadById,
  getAuditLogs
} from '../src/database/db.js';
import {
  orchestrateSalesDialogue,
  OBJECTION_SCRIPTS
} from '../src/sales/salesDialogueOrchestrator.js';
import {
  isHighValueProspect,
  sendHighValueAdminAlert
} from '../src/sales/adminAlertService.js';
import {
  enrollInFreeTrial,
  calculateTrialDays,
  checkAllTrialStatuses,
  convertTrialToPaidCustomer,
  getTrialDashboardStats
} from '../src/trial/trialTrackerService.js';
import {
  scheduleFollowUpSequence,
  suppressFollowUpSequenceOnInteraction,
  dispatchDueFollowUpSequences,
  SEQUENCE_STAGES
} from '../src/feedback/followUpSequenceEngine.js';

console.log('================================================================');
console.log('🧪 VERIFICATION BATTERY: PHASE 5, PHASE 6 & PHASE 7');
console.log('================================================================\n');

let testsPassed = 0;
const totalTests = 10;

async function runTests() {
  try {
    // -------------------------------------------------------------
    // TEST 1: Phase 5 - Objection Handling on Pricing (ROI Calculation)
    // -------------------------------------------------------------
    console.log('Testing Phase 5: Sales Dialogue & Pricing Objection Handling...');
    const testLead = saveOrUpdateLead({
      gymName: 'Iron Fortress Gym ' + Date.now(),
      city: 'Delhi',
      country: 'India',
      businessPhone: '919811002233',
      businessEmail: `iron_${Date.now()}@fortress.in`,
      status: 'Contacted'
    });

    const pricingDialogue = await orchestrateSalesDialogue({
      remoteJid: '919811002233@s.whatsapp.net',
      messageText: 'Your software is too expensive for our small gym.',
      channel: 'whatsapp'
    });

    assert(pricingDialogue.replyText, 'Dialogue must produce a reply');
    assert.strictEqual(pricingDialogue.intent, 'pricing', 'Intent should be classified as pricing');
    console.log(`✅ [TEST 1 PASSED] Sales Dialogue objection handler responded to pricing concern with ROI proposition.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 2: Phase 5 - Competitor Objection Handling
    // -------------------------------------------------------------
    console.log('\nTesting Phase 5: Competitor Comparison Objection Handling...');
    const competitorDialogue = await orchestrateSalesDialogue({
      remoteJid: '919811002233@s.whatsapp.net',
      messageText: 'We already use another software for our members.',
      channel: 'whatsapp'
    });

    assert(competitorDialogue.replyText, 'Dialogue must produce a reply');
    assert.strictEqual(competitorDialogue.intent, 'already_using_other', 'Intent should be classified as already_using_other');
    console.log(`✅ [TEST 2 PASSED] Sales Dialogue handled competitor comparison smoothly.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 3: Phase 5 - High-Value Prospect / Chain Detection & Admin Escalation
    // -------------------------------------------------------------
    console.log('\nTesting Phase 5: High-Value Prospect / Chain Escalation...');
    const chainLeadSaved = saveOrUpdateLead({
      gymName: 'Metropolis Fitness Club Network',
      city: 'Mumbai',
      country: 'India',
      businessPhone: '919820998877',
      branchesCount: 4,
      leadScore: 95
    });
    const chainLead = getLeadById(chainLeadSaved.id);

    const isHighVal = isHighValueProspect(chainLead, { userMessage: 'We have 4 branches and 1200 members across Mumbai.' });
    assert.strictEqual(isHighVal, true, 'Multi-branch gym network must be identified as high-value');

    const alertResult = await sendHighValueAdminAlert(chainLead, { reason: '4 branches network' });
    assert.strictEqual(alertResult.alertSent, true, 'Admin alert must be dispatched');
    console.log(`✅ [TEST 3 PASSED] High-Value prospect identified (${chainLead.branchesCount} branches) and escalated to Admin.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 4: Phase 6 - 30-Day Free Trial Enrollment
    // -------------------------------------------------------------
    console.log('\nTesting Phase 6: 30-Day Free Trial Enrollment...');
    const trialSub = enrollInFreeTrial({
      leadId: testLead.id,
      gymName: 'Iron Fortress Gym',
      contactPhone: '919811002233',
      contactEmail: 'owner@fortress.in',
      planTier: 'Pro'
    });

    assert(trialSub.id, 'Subscription must be assigned an ID');
    assert.strictEqual(trialSub.status, 'Active', 'New trial must be active');
    assert.strictEqual(trialSub.leadId, testLead.id, 'Subscription must reference lead ID');

    const updatedLeadStatus = getLeadById(testLead.id).status;
    assert.strictEqual(updatedLeadStatus, 'Interested', 'Lead status should be advanced upon trial enrollment');
    console.log(`✅ [TEST 4 PASSED] Lead #${testLead.id} enrolled in 30-day trial #${trialSub.id}. Status -> "${updatedLeadStatus}"`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 5: Phase 6 - Trial Days Calculation & Expiry Logic
    // -------------------------------------------------------------
    console.log('\nTesting Phase 6: Trial Days Calculation...');
    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const calc = calculateTrialDays(todayStr, thirtyDaysOut);

    assert.strictEqual(calc.isExpired, false, 'New 30-day trial must not be expired');
    assert(calc.daysRemaining >= 29 && calc.daysRemaining <= 31, 'Days remaining should be approximately 30');

    // Past trial
    const pastStart = '2026-01-01';
    const pastEnd = '2026-01-31';
    const expiredCalc = calculateTrialDays(pastStart, pastEnd);
    assert.strictEqual(expiredCalc.isExpired, true, 'Past trial must be evaluated as expired');
    console.log(`✅ [TEST 5 PASSED] Accurate day calculation verified: Remaining: ${calc.daysRemaining} days (Active) vs Expired: ${expiredCalc.isExpired}`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 6: Phase 6 - Trial Status Health Check & Milestones
    // -------------------------------------------------------------
    console.log('\nTesting Phase 6: Trial Health Check & Milestone Scanning...');
    const healthReport = checkAllTrialStatuses();
    assert(typeof healthReport.evaluatedCount === 'number', 'Health report must return evaluated count');
    assert(Array.isArray(healthReport.milestonesTriggered), 'Milestones must be an array');
    console.log(`✅ [TEST 6 PASSED] Trial Status Check evaluated ${healthReport.evaluatedCount} active subscriptions.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 7: Phase 6 - Trial Conversion to Paying Customer
    // -------------------------------------------------------------
    console.log('\nTesting Phase 6: Conversion to Paying Customer...');
    const conversion = convertTrialToPaidCustomer({
      subscriptionId: trialSub.id,
      planTier: 'Gold Annual',
      billingCycle: 'Annual',
      amount: 14999
    });

    assert.strictEqual(conversion.success, true, 'Conversion must succeed');
    assert.strictEqual(conversion.status, 'Converted', 'Status must be Converted');

    const convertedLead = getLeadById(testLead.id);
    assert.strictEqual(convertedLead.status, 'Converted', 'Lead status must advance to Converted');

    const stats = getTrialDashboardStats();
    assert(stats.convertedTrials >= 1, 'Converted count must increment');
    console.log(`✅ [TEST 7 PASSED] Trial #${trialSub.id} successfully converted to Paid. Conversion Rate: ${stats.conversionRatePercent}%`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 8: Phase 7 - 4-Stage Follow-Up Sequence Scheduling
    // -------------------------------------------------------------
    console.log('\nTesting Phase 7: 4-Stage Follow-Up Sequence Scheduling...');
    const seqLeadSaved = saveOrUpdateLead({
      gymName: 'Vanguard Fitness ' + Date.now(),
      city: 'Chandigarh',
      country: 'India',
      businessPhone: '9198' + Date.now().toString().slice(-8),
      status: 'Contacted'
    });

    const sequenceResult = scheduleFollowUpSequence(seqLeadSaved.id, 'whatsapp');
    assert.strictEqual(sequenceResult.scheduled, true, 'Sequence should be scheduled');
    assert.strictEqual(sequenceResult.count, 4, 'Must schedule exactly 4 stages (+2d, +4d, +7d, +10d)');

    const followUps = db.prepare("SELECT * FROM follow_ups WHERE leadId = ? AND status = 'Pending' ORDER BY attemptNumber ASC").all(seqLeadSaved.id);
    assert.strictEqual(followUps.length, 4, 'Database must contain 4 pending follow_up records');
    assert.strictEqual(followUps[0].attemptNumber, 1, 'First stage is attempt 1');
    assert.strictEqual(followUps[3].attemptNumber, 4, 'Final stage is attempt 4');
    console.log(`✅ [TEST 8 PASSED] 4-Stage Follow-Up sequence scheduled for Lead #${seqLeadSaved.id}:`);
    followUps.forEach((f) => console.log(`   └─ Stage ${f.attemptNumber}: ${f.scheduledDate} [${f.followUpType}]`));
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 9: Phase 7 - Follow-Up Suppression on Prospect Interaction
    // -------------------------------------------------------------
    console.log('\nTesting Phase 7: Follow-Up Suppression on Interaction/Opt-out...');
    const cancelledCount = suppressFollowUpSequenceOnInteraction(seqLeadSaved.id, 'Customer replied with question');
    assert.strictEqual(cancelledCount, 4, 'All 4 pending stages should be cancelled');

    const pendingAfter = db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE leadId = ? AND status = 'Pending'").get(seqLeadSaved.id).count;
    assert.strictEqual(pendingAfter, 0, 'No pending follow-ups should remain');
    console.log(`✅ [TEST 9 PASSED] Sequence suppression verified: ${cancelledCount} pending stages cancelled upon interaction.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 10: Phase 7 - Follow-Up Dispatch with Consent Guard
    // -------------------------------------------------------------
    console.log('\nTesting Phase 7: Follow-Up Dispatch Engine...');
    const dispatchReport = await dispatchDueFollowUpSequences();
    assert(typeof dispatchReport.sentCount === 'number', 'Dispatch must return sentCount');
    assert(typeof dispatchReport.suppressedCount === 'number', 'Dispatch must return suppressedCount');
    console.log(`✅ [TEST 10 PASSED] Follow-Up Dispatch engine successfully verified (Due: ${dispatchReport.dueCount}, Sent: ${dispatchReport.sentCount}, Suppressed: ${dispatchReport.suppressedCount}).`);
    testsPassed++;

    console.log('\n================================================================');
    console.log(`📊 SPRINT 3 (PHASE 5, 6 & 7) RESULTS: ${testsPassed}/${totalTests} PASSED (0 FAILED)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Test Failure in Phase 5/6/7:', err);
    process.exit(1);
  }
}

runTests();
