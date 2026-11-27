/**
 * Verification Battery for Phase 3 & Phase 4
 * Phase 3: Daily Automatic Global Gym Research
 * Phase 4: Daily Automatic WhatsApp Outreach
 */

import assert from 'assert';
import db, {
  saveOrUpdateLead,
  getResearchHistory,
  getTodaysNewLeadsCount,
  updateLeadStatus
} from '../src/database/db.js';
import { getNextResearchTarget, getLocationStats } from '../src/researcher/locationRotator.js';
import { isWithinResearchWindow, runDailyResearchRoutine } from '../src/scheduler/researchScheduler.js';
import { checkOutreachConsent, build30DayTrialPitch } from '../src/outreach/consentGuard.js';
import { runDailyOutreachRoutine, isWithinOutreachWindow } from '../src/scheduler/outreachScheduler.js';

console.log('================================================================');
console.log('🧪 VERIFICATION BATTERY: PHASE 3 & PHASE 4');
console.log('================================================================\n');

let testsPassed = 0;
const totalTests = 8;

async function runTests() {
  try {
    // -------------------------------------------------------------
    // TEST 1: Location Rotator functionality & Unexplored Prioritization
    // -------------------------------------------------------------
    console.log('Testing Location Rotator...');
    const target1 = getNextResearchTarget();
    assert(target1.country, 'Target must have a country');
    assert(target1.city, 'Target must have a city');
    assert(['Gym', 'Fitness Centre'].includes(target1.category), 'Category must be Gym or Fitness Centre');

    const target2 = getNextResearchTarget();
    assert(target2.city, 'Target 2 must have a city');

    const stats = getLocationStats();
    assert(stats.totalTargetLocations > 50, 'Total configured target locations should exceed 50');
    console.log(`✅ [TEST 1 PASSED] Location Rotator successfully selects target locations: ${target1.city} (${target1.country}) -> ${target2.city} (${target2.country})`);
    console.log(`   └─ Coverage: ${stats.exploredLocationsCount}/${stats.totalTargetLocations} explored (${stats.explorationCoveragePercent}%)`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 2: Research Window (07:00 - 10:00 IST) Timezone Evaluation
    // -------------------------------------------------------------
    console.log('\nTesting Daily Research/Outreach Window calculation...');
    const morningDate = new Date('2026-11-27T02:30:00.000Z'); // 08:00 AM IST
    const eveningDate = new Date('2026-11-27T12:30:00.000Z'); // 18:00 PM IST (6:00 PM)

    assert.strictEqual(isWithinResearchWindow(morningDate), true, '08:00 AM IST should be within window');
    assert.strictEqual(isWithinResearchWindow(eveningDate), false, '06:00 PM IST should be outside window');
    assert.strictEqual(isWithinOutreachWindow(morningDate), true, '08:00 AM IST should be within outreach window');
    assert.strictEqual(isWithinOutreachWindow(eveningDate), false, '06:00 PM IST should be outside outreach window');
    console.log('✅ [TEST 2 PASSED] Timezone calculations accurately enforce 07:00 - 10:00 AM Asia/Kolkata window');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 3: Pre-Insert Historical Deduplication (Past leads do NOT count)
    // -------------------------------------------------------------
    console.log('\nTesting Pre-insert Historical Deduplication...');
    const uniquePhone = '9191' + Date.now().toString().slice(-8);
    const uniqueName = 'Titan Iron Gymnasium ' + Date.now();
    const firstInsert = saveOrUpdateLead({
      gymName: uniqueName,
      city: 'Indore',
      country: 'India',
      businessPhone: uniquePhone,
      businessEmail: `titan_${Date.now()}@ironfit.in`,
      gymCategory: 'Gym'
    });
    assert.strictEqual(firstInsert.isNew, true, 'First insert must be flagged as new lead');

    const secondInsert = saveOrUpdateLead({
      gymName: uniqueName + ' Branch 2',
      city: 'Indore',
      country: 'India',
      businessPhone: uniquePhone,
      businessEmail: `titan_${Date.now()}@ironfit.in`,
      gymCategory: 'Gym'
    });
    assert.strictEqual(secondInsert.isNew, false, 'Duplicate phone/email must NOT be flagged as new lead');
    assert.strictEqual(secondInsert.id, firstInsert.id, 'Duplicate lead must merge into existing lead ID');
    console.log(`✅ [TEST 3 PASSED] Historical duplicate matching verified: Lead #${firstInsert.id} detected and updated, isNew=false`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 4: Daily Research Routine with Quota & History Recording
    // -------------------------------------------------------------
    console.log('\nTesting Daily Research Scheduler Routine...');
    const initialTodayCount = getTodaysNewLeadsCount();
    // Run research routine for a small target quota
    const researchRun = await runDailyResearchRoutine({
      targetNewLeads: initialTodayCount + 2,
      maxLocationsToTry: 1,
      enforceWindow: false,
      limitPerCity: 5
    });

    assert(researchRun.status === 'completed', 'Research run should complete successfully');
    const history = getResearchHistory(5);
    assert(history.length > 0, 'Research history table should record runs');
    console.log(`✅ [TEST 4 PASSED] Daily Research Scheduler executed run successfully. Recorded in research_history.`);
    console.log(`   └─ Latest log: ${history[0].city}, ${history[0].country} | Discovered: ${history[0].discoveredCount}, Accepted: ${history[0].acceptedCount}`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 5: Consent Guard - Strict Opt-Out Suppression
    // -------------------------------------------------------------
    console.log('\nTesting Consent Guard Opt-Out Suppression...');
    const unsubLead = saveOrUpdateLead({
      gymName: 'Opt-Out Test Fitness',
      city: 'Mumbai',
      country: 'India',
      businessPhone: '919999000111',
      businessEmail: 'optout@testfitness.com',
      status: 'Unsubscribed'
    });
    updateLeadStatus(unsubLead.id, 'Unsubscribed', 'User opted out');

    const consentCheck = checkOutreachConsent(unsubLead.id, 'whatsapp');
    assert.strictEqual(consentCheck.allowed, false, 'Unsubscribed lead MUST be blocked from outreach');
    assert(consentCheck.reason.includes('OPTED OUT') || consentCheck.reason.includes('Unsubscribed'), 'Reason must state opt-out');
    console.log(`✅ [TEST 5 PASSED] Consent Guard blocked outreach to Unsubscribed Lead #${unsubLead.id}: "${consentCheck.reason}"`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 6: 30-Day Free Trial Pitch Copy & Required Elements
    // -------------------------------------------------------------
    console.log('\nTesting 30-Day Free Trial Pitch formatting...');
    const pitch = build30DayTrialPitch({
      gymName: 'Powerhouse Gym',
      city: 'Bengaluru',
      ownerName: 'Vikram',
      category: 'Gym'
    });

    assert(pitch.includes('Hello Vikram!'), 'Pitch must greet the owner by name');
    assert(pitch.includes('Powerhouse Gym'), 'Pitch must reference the gym name');
    assert(pitch.includes('30-Day Full Access Free Trial') || pitch.includes('30-day free trial'), 'Pitch must offer 30-day free trial');
    assert(pitch.includes('Biometric') || pitch.includes('attendance'), 'Pitch must highlight key benefits');
    assert(/reply 'stop'|stop/i.test(pitch), 'Pitch must provide explicit opt-out instructions');
    console.log('✅ [TEST 6 PASSED] 30-Day Trial Pitch copy correctly includes personalized greeting, value prop, and opt-out notice');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 7: Daily Automatic Outreach Routine Execution
    // -------------------------------------------------------------
    console.log('\nTesting Daily Outreach Routine...');
    // Create an eligible qualified lead with unique phone
    const testPhone = '9198' + Date.now().toString().slice(-8);
    const qualifiedLead = saveOrUpdateLead({
      gymName: 'Apex Performance Center ' + Date.now(),
      city: 'Pune',
      country: 'India',
      businessPhone: testPhone,
      whatsappNumber: testPhone,
      hasWhatsApp: 1,
      businessEmail: `apex_${Date.now()}@performance.in`,
      leadScore: 85,
      status: 'Qualified'
    });

    const outreachResult = await runDailyOutreachRoutine({
      targetCount: 1,
      minScore: 50,
      delayMs: 50,
      enforceWindow: false
    });

    assert.strictEqual(outreachResult.status, 'completed', 'Outreach routine should complete');
    assert((outreachResult.sentCount || outreachResult.contactedCount) >= 1, 'At least 1 outreach message should be dispatched');

    const contactedLeadId = outreachResult.sessionResults[0].leadId;
    const updatedLead = db.prepare('SELECT status FROM leads WHERE id = ?').get(contactedLeadId);
    assert.strictEqual(updatedLead.status, 'Contacted', 'Pitched lead status must advance to Contacted');
    console.log(`✅ [TEST 7 PASSED] Daily Outreach Routine successfully dispatched 30-day trial pitch. Lead #${contactedLeadId} status -> "${updatedLead.status}"`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 8: Daily Frequency Cap / Cooldown Protection
    // -------------------------------------------------------------
    console.log('\nTesting Daily Frequency Cap / Cooldown Protection...');
    const secondOutreachConsent = checkOutreachConsent(contactedLeadId, 'whatsapp');
    assert.strictEqual(secondOutreachConsent.allowed, false, 'Same lead cannot be contacted twice in the same day');
    assert(
      secondOutreachConsent.reason.includes('already received outreach today') ||
      secondOutreachConsent.reason.includes('frequency cap') ||
      secondOutreachConsent.reason.includes('lifecycle') ||
      secondOutreachConsent.reason.includes('Contacted'),
      'Reason must indicate cooldown or frequency cap'
    );
    console.log(`✅ [TEST 8 PASSED] Cooldown guard prevented duplicate outreach today: "${secondOutreachConsent.reason}"`);
    testsPassed++;

    console.log('\n================================================================');
    console.log(`📊 SPRINT 2 (PHASE 3 & 4) RESULTS: ${testsPassed}/${totalTests} PASSED (0 FAILED)`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ Test Failure:', error);
    process.exit(1);
  }
}

runTests();
