/**
 * Verification Battery for Phase 8 & Phase 9
 * Phase 8: Automatic Demonstration Meeting Scheduler (Google Calendar + Meet)
 * Phase 9: Customer Feedback Agent (6 Questions, 7 Categories, High-Value Alerts)
 */

import assert from 'assert';
import db, {
  saveOrUpdateLead,
  getLeadById,
  createMeeting,
  updateMeeting,
  getFeedbacks
} from '../src/database/db.js';
import {
  processSchedulingTurn,
  isConfirmationText,
  isCancellationText,
  isRescheduleText
} from '../src/calendar/schedulingStateMachine.js';
import {
  getAvailableSlots,
  generateGoogleMeetLink
} from '../src/calendar/googleCalendarService.js';
import {
  generateFeedbackMessage,
  classifyFeedbackResponse,
  recordCustomerFeedback,
  FEEDBACK_QUESTIONS
} from '../src/feedback/feedbackService.js';
import { notifyAdminHighValueLead } from '../src/feedback/adminNotifier.js';

console.log('================================================================');
console.log('🧪 VERIFICATION BATTERY: PHASE 8 & PHASE 9');
console.log('================================================================\n');

let testsPassed = 0;
const totalTests = 8;

async function runTests() {
  try {
    // -------------------------------------------------------------
    // TEST 1: Phase 8 - Available Slots & Buffer Validation (10:00 - 19:00 IST)
    // -------------------------------------------------------------
    console.log('Testing Phase 8: Calendar Slot Availability & Working Hours...');
    const testDate = '2026-12-01';
    const slotsResult = getAvailableSlots(testDate);
    const slots = slotsResult.slots || slotsResult.availableSlots;

    assert(Array.isArray(slots), 'Slots must be an array');
    assert(slots.length > 0, 'Must have available slots within 10:00 AM - 07:00 PM IST');
    assert(slots.every((s) => s.time24 >= '10:00' && s.time24 <= '18:30'), 'Slots must be within 10:00 - 19:00 IST');
    console.log(`✅ [TEST 1 PASSED] Calendar slots accurately generated (${slots.length} available slots on ${testDate}).`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 2: Phase 8 - Explicit Confirmation Parsing & State Machine Logic
    // -------------------------------------------------------------
    console.log('\nTesting Phase 8: Confirmation, Reschedule & Cancellation NLP matching...');
    assert.strictEqual(isConfirmationText('Yes, tomorrow 3 PM works perfectly for me!'), true);
    assert.strictEqual(isConfirmationText('Book it'), true);
    assert.strictEqual(isConfirmationText('Theek hai, confirm kar do'), true);

    assert.strictEqual(isCancellationText('Please cancel the demo meeting.'), true);
    assert.strictEqual(isCancellationText('mat karo cancel'), true);

    assert.strictEqual(isRescheduleText('Can we reschedule the demo to another time?'), true);
    assert.strictEqual(isRescheduleText('Dusra time de do'), true);
    console.log('✅ [TEST 2 PASSED] Intent NLP correctly parses confirmation, cancellation, and reschedule requests.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 3: Phase 8 - Conversational Booking State Machine (Unconfirmed vs Confirmed)
    // -------------------------------------------------------------
    console.log('\nTesting Phase 8: Meeting Booking State Machine Turn Execution...');
    const schedLead = saveOrUpdateLead({
      gymName: 'Pulse Athletic Club ' + Date.now(),
      city: 'Ahmedabad',
      country: 'India',
      businessPhone: '919712334455',
      businessEmail: `pulse_${Date.now()}@athletic.in`,
      status: 'Meeting Requested'
    });
    const schedLeadObj = getLeadById(schedLead.id);

    // Ensure clean slot for testing
    const testMeetingDate = '2026-12-10';
    db.prepare('DELETE FROM meetings WHERE meetingDate = ?').run(testMeetingDate);

    // Turn 1: Propose a date/time -> Should transition to 'Waiting for Confirmation' (NOT Scheduled yet)
    const turn1 = await processSchedulingTurn({
      lead: schedLeadObj,
      incomingText: `Can we schedule the demonstration on ${testMeetingDate} at 4 PM?`,
      channel: 'whatsapp',
      remoteJid: '919712334455@s.whatsapp.net'
    });

    assert(turn1.meeting, 'Turn 1 must generate a meeting record');
    assert.strictEqual(turn1.meeting.status, 'Waiting for Confirmation', 'Meeting must NOT be confirmed without explicit confirmation');
    assert(turn1.replyText.toLowerCase().includes('confirm') || turn1.replyText.toLowerCase().includes('yes'), 'Agent must request explicit confirmation');

    // Turn 2: Explicit Confirmation -> Should transition to 'Scheduled' with Meet Link
    const turn2 = await processSchedulingTurn({
      lead: schedLeadObj,
      incomingText: 'Yes, I confirm!',
      channel: 'whatsapp',
      remoteJid: '919712334455@s.whatsapp.net'
    });

    assert.strictEqual(turn2.meeting.status, 'Scheduled', 'Meeting must advance to Scheduled upon explicit confirmation');
    assert(turn2.meeting.meetingLink.includes('meet.google.com'), 'Meeting must include Google Meet link');
    console.log(`✅ [TEST 3 PASSED] State machine safely enforced confirmation gate. Meet Link: ${turn2.meeting.meetingLink}`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 4: Phase 8 - Rescheduling & Cancellation Turns
    // -------------------------------------------------------------
    console.log('\nTesting Phase 8: Cancellation & Reschedule Handling...');
    const turnCancel = await processSchedulingTurn({
      lead: schedLeadObj,
      incomingText: 'I need to cancel our meeting.',
      channel: 'whatsapp',
      remoteJid: '919712334455@s.whatsapp.net'
    });

    assert.strictEqual(turnCancel.meeting.status, 'Cancelled', 'Meeting status must become Cancelled');
    console.log(`✅ [TEST 4 PASSED] Meeting #${turnCancel.meeting.id} successfully cancelled via text message.`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 5: Phase 9 - 6-Question Feedback Request Generation
    // -------------------------------------------------------------
    console.log('\nTesting Phase 9: 6-Question Feedback Request formatting...');
    assert.strictEqual(FEEDBACK_QUESTIONS.length, 6, 'Must have exactly 6 feedback questions');

    const fbWa = generateFeedbackMessage(schedLeadObj, turn2.meeting, 'whatsapp');
    assert(fbWa.text.includes('How was your Gym Stack demonstration?'), 'Must include Question 1');
    assert(fbWa.text.includes('Which features did you like most?'), 'Must include Question 2');
    assert(fbWa.text.includes('Which features would you like to improve?'), 'Must include Question 3');
    assert(fbWa.text.includes('Do you have any questions?'), 'Must include Question 4');
    assert(fbWa.text.includes('Are you interested in purchasing'), 'Must include Question 5');
    assert(fbWa.text.includes('discuss pricing'), 'Must include Question 6');

    const fbEmail = generateFeedbackMessage(schedLeadObj, turn2.meeting, 'email');
    assert(fbEmail.subject.includes('Demo Feedback'), 'Email subject must mention Demo Feedback');
    assert(fbEmail.html.includes('<ol'), 'Email must format questions into HTML ordered list');
    console.log('✅ [TEST 5 PASSED] 6-Question feedback requests formatted accurately for WhatsApp & Email.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 6: Phase 9 - Feedback Category Classification (7 Categories)
    // -------------------------------------------------------------
    console.log('\nTesting Phase 9: Classification into 7 Feedback Categories...');
    const positiveClass = await classifyFeedbackResponse('The demo was amazing! Loved the biometric scanner and face attendance.');
    assert.strictEqual(positiveClass.category, 'Positive feedback');

    const featureReqClass = await classifyFeedbackResponse('Could you please add diet chart integration and custom member barcode support?');
    assert.strictEqual(featureReqClass.category, 'Feature request');

    const pricingClass = await classifyFeedbackResponse('The features are good but the Starter price is a bit high. Can we negotiate a discount?');
    assert.strictEqual(pricingClass.category, 'Pricing concern');

    const purchaseClass = await classifyFeedbackResponse('We are ready to buy Gym Stack for both our branches. How do we make payment?');
    assert.strictEqual(purchaseClass.category, 'Interested in purchasing');

    const notInterestedClass = await classifyFeedbackResponse('We decided to stick with our manual register. Please do not contact us.');
    assert.strictEqual(notInterestedClass.category, 'Not interested');

    console.log('✅ [TEST 6 PASSED] Feedback responses classified accurately into official categories:');
    console.log(`   └─ "Positive feedback", "Feature request", "Pricing concern", "Interested in purchasing", "Not interested"`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 7: Phase 9 - High-Value Prospect Alert on Purchase/Pricing Interest
    // -------------------------------------------------------------
    console.log('\nTesting Phase 9: High-Value Prospect Alert from Feedback...');
    const alertResult = await notifyAdminHighValueLead(
      schedLeadObj,
      {
        feedbackCategory: 'Interested in purchasing',
        sentiment: 'Positive',
        rating: 5,
        purchaseInterest: 'Yes',
        pricingDiscussionRequested: 1,
        rawResponseText: 'Ready to buy Gym Stack!'
      },
      turn2.meeting
    );

    assert.strictEqual(alertResult.adminNotified, true, 'Admin must be flagged as notified');
    assert(alertResult.alertSubject.includes('HIGH-VALUE PROSPECT ALERT'), 'Alert subject must emphasize high value');
    console.log(`✅ [TEST 7 PASSED] High-value prospect notification triggered: "${alertResult.alertSubject}"`);
    testsPassed++;

    // -------------------------------------------------------------
    // TEST 8: Phase 9 - Feedback Storage in Database & Association
    // -------------------------------------------------------------
    console.log('\nTesting Phase 9: Feedback Persistent Storage in SQLite...');
    const feedbackResult = await recordCustomerFeedback({
      lead: schedLeadObj,
      meetingId: turn2.meeting.id,
      channel: 'whatsapp',
      responseText: 'Great demo! We liked biometric integration, but want to discuss custom pricing for 2 locations.'
    });
    const storedFeedback = feedbackResult.feedback;

    assert(storedFeedback.id, 'Feedback record must have an ID');
    assert.strictEqual(storedFeedback.leadId, schedLeadObj.id, 'Feedback must link to lead');
    assert.ok(storedFeedback.pricingDiscussionRequested, 'Pricing discussion must be flagged');

    const fbList = getFeedbacks({ leadId: schedLeadObj.id });
    assert(fbList.feedbacks && fbList.feedbacks.length >= 1, 'Feedback must be queryable via getFeedbacks');
    console.log(`✅ [TEST 8 PASSED] Feedback #${storedFeedback.id} successfully recorded against Lead #${schedLeadObj.id}. Category: ${storedFeedback.feedbackCategory}`);
    testsPassed++;

    console.log('\n================================================================');
    console.log(`📊 SPRINT 4 (PHASE 8 & 9) RESULTS: ${testsPassed}/${totalTests} PASSED (0 FAILED)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Test Failure in Phase 8/9:', err);
    process.exit(1);
  }
}

runTests();
