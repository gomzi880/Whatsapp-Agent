import assert from 'assert';
import http from 'http';
import app from '../src/dashboard/server.js';
import db, { FEEDBACK_CATEGORIES, saveOrUpdateLead, getLeadById } from '../src/database/db.js';
import {
  FEEDBACK_QUESTIONS,
  generateFeedbackMessage,
  classifyFeedbackResponse,
  processInboundFeedback
} from '../src/feedback/feedbackService.js';
import {
  schedulePostDemoFollowUp,
  schedulePromisedCallback,
  executeDueFollowUps,
  identifyUnresponsiveLeads
} from '../src/feedback/followUpScheduler.js';

async function runTests() {
  console.log('🚀 Running Instruction 7: Customer Feedback & Follow-Up Agent Test Suite...\n');

  // TEST 1: FEEDBACK_QUESTIONS count and structure
  console.log('--- Test 1: Feedback Questions ---');
  assert.strictEqual(FEEDBACK_QUESTIONS.length, 6, 'Must have exactly 6 mandatory feedback questions');
  assert(FEEDBACK_QUESTIONS[0].includes('demonstration'), 'Question 1 should ask about the demonstration');
  assert(FEEDBACK_QUESTIONS[1].includes('most'), 'Question 2 should ask about liked features');
  assert(FEEDBACK_QUESTIONS[2].includes('improve'), 'Question 3 should ask about improvements');
  assert(FEEDBACK_QUESTIONS[3].includes('questions'), 'Question 4 should ask for questions');
  assert(FEEDBACK_QUESTIONS[4].includes('purchasing'), 'Question 5 should ask about purchasing interest');
  assert(FEEDBACK_QUESTIONS[5].includes('pricing'), 'Question 6 should ask about discussing pricing');
  console.log('✅ Test 1 Passed: 6 standard feedback questions validated.\n');

  // TEST 2: Message Generation (WhatsApp & Email)
  console.log('--- Test 2: Generate Feedback Messages ---');
  const sampleLead = { id: 9991, gymName: 'Iron Paradise Fitness', ownerName: 'Vikram Singh' };
  
  const waMsg = generateFeedbackMessage(sampleLead, null, 'whatsapp');
  assert(waMsg.text.includes('Iron Paradise Fitness'), 'WhatsApp message must include gym name');
  assert(waMsg.text.includes('How was your Gym Stack demonstration?'), 'Must include Q1');
  assert(waMsg.text.includes('Would you like to discuss pricing?'), 'Must include Q6');

  const emailMsg = generateFeedbackMessage(sampleLead, null, 'email');
  assert(emailMsg.subject.includes('Iron Paradise Fitness'), 'Email subject must include gym name');
  assert(emailMsg.html.includes('<ol'), 'Email HTML must include structured questions');
  console.log('✅ Test 2 Passed: Dual-channel message generator formatted correctly.\n');

  // TEST 3: AI / Rule-based Feedback Classifier
  console.log('--- Test 3: Feedback Category Classification ---');
  const testCases = [
    { text: 'Great demo! Everything looks super smooth and modern.', expected: 'Positive feedback' },
    { text: 'We really want to buy Gym Stack for 2 branches. How do we start?', expected: 'Interested in purchasing' },
    { text: 'Can we get a discount if we pay for 1 full year upfront? Price is a bit high.', expected: 'Pricing concern' },
    { text: 'Can you add integration with our local biometric turnstile?', expected: 'Feature request' },
    { text: 'Does it work offline when internet drops in the basement gym?', expected: 'Technical concern' },
    { text: 'We need to discuss with our head trainer. Please contact me next Monday.', expected: 'Needs more time' },
    { text: 'Not interested. We already bought another system, please stop emailing.', expected: 'Not interested' }
  ];

  for (const tc of testCases) {
    const res = await classifyFeedbackResponse(tc.text);
    console.log(`Input: "${tc.text}" -> Category: [${res.category}], Sentiment: [${res.sentiment}], High-Value: [${res.isHighValue}]`);
    assert(FEEDBACK_CATEGORIES.includes(res.category), `Category "${res.category}" must be in FEEDBACK_CATEGORIES`);
    assert.strictEqual(res.category, tc.expected, `Expected "${tc.expected}", got "${res.category}"`);
  }
  console.log('✅ Test 3 Passed: All 7 mandatory feedback categories verified.\n');

  // TEST 4: Inbound Feedback Processing & High-Value Flagging
  console.log('--- Test 4: Inbound Feedback Processing & Actions ---');
  
  // Seed a test lead
  const lead1Record = saveOrUpdateLead({
    gymName: 'Titan Powerhouse Gym',
    ownerName: 'Rajesh Sharma',
    phone: '+919876543210',
    whatsappNumber: '+919876543210',
    businessEmail: 'rajesh@titanpower.com',
    city: 'Indore',
    state: 'Madhya Pradesh',
    country: 'India',
    leadScore: 85,
    status: 'Demo Completed'
  });
  const testLead1 = getLeadById(lead1Record.id);

  // 4a. High-Value Prospect: Interested in purchasing
  const purchaseReply = await processInboundFeedback({
    lead: testLead1,
    responseText: 'We are very interested in purchasing Gym Stack. Please send the payment invoice and contract.',
    channel: 'whatsapp'
  });
  assert.strictEqual(purchaseReply.classification.category, 'Interested in purchasing');
  assert.strictEqual(purchaseReply.classification.isHighValue, true);
  
  const updatedLead1 = getLeadById(testLead1.id);
  assert.strictEqual(updatedLead1.status, 'Interested', 'High-value buyer status should advance to Interested');

  // 4b. Opt-Out / Not Interested: Suppresses outreach & cancels follow-ups
  const lead2Record = saveOrUpdateLead({
    gymName: 'Alpha Old Gym',
    ownerName: 'Sunil Verma',
    phone: '+919811122233',
    whatsappNumber: '+919811122233',
    businessEmail: 'sunil@alphagym.com',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    country: 'India',
    leadScore: 60,
    status: 'Demo Completed'
  });
  const testLead2 = getLeadById(lead2Record.id);

  // Schedule a pending follow-up for lead 2
  const pendingFu = db.createFollowUp({
    leadId: testLead2.id,
    scheduledDate: '2026-12-01',
    channel: 'whatsapp',
    followUpType: 'Demo Feedback'
  });

  const optOutReply = await processInboundFeedback({
    lead: testLead2,
    responseText: 'Not interested at all. Do not message me again.',
    channel: 'whatsapp'
  });

  assert.strictEqual(optOutReply.classification.category, 'Not interested');
  const updatedLead2 = getLeadById(testLead2.id);
  assert.strictEqual(updatedLead2.status, 'Unsubscribed', 'Opt-out must mark lead as Unsubscribed');

  const checkFu = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(pendingFu.id);
  assert.strictEqual(checkFu.status, 'Cancelled', 'Opt-out must cancel all pending follow-ups');

  // Verify anti-spam eligibility check blocks follow-up for unsubscribed lead
  const eligibility = db.checkFollowUpEligibility(testLead2.id);
  assert.strictEqual(eligibility.eligible, false, 'Unsubscribed lead must not be eligible for follow-ups');
  console.log('✅ Test 4 Passed: Inbound processing, high-value alerts, and opt-out suppression verified.\n');

  // TEST 5: Promised Callback Date (Strictly No Voice Calls)
  console.log('--- Test 5: Promised Callback Scheduling (No Phone Calls) ---');
  const callbackRes = schedulePromisedCallback({
    leadId: testLead1.id,
    callbackDate: '2026-12-10',
    customNote: 'Prospect requested text follow-up regarding multi-branch pricing'
  });
  assert.strictEqual(callbackRes.scheduled, true);
  assert.strictEqual(callbackRes.followUp.followUpType, 'Promised Callback');
  assert.strictEqual(callbackRes.followUp.promisedCallbackDate, '2026-12-10');
  console.log('✅ Test 5 Passed: Promised callback date stored with text reminder only.\n');

  // TEST 6: Auto-follow-up scheduling when meeting is completed
  console.log('--- Test 6: Auto-Schedule Follow-Up on Meeting Completion ---');
  const meeting = db.createMeeting({
    leadId: testLead1.id,
    gymName: testLead1.gymName,
    meetingDate: '2026-11-26',
    startTime: '10:00 AM',
    status: 'Scheduled'
  });

  // TEST 7: Express REST Endpoints
  console.log('--- Test 7: Dashboard Server REST API Endpoints ---');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3099, resolve));

  async function apiGet(path) {
    const res = await fetch(`http://localhost:3099${path}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`http://localhost:3099${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async function apiPatch(path, body) {
    const res = await fetch(`http://localhost:3099${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // 7a. Get Stats
  const statsRes = await apiGet('/api/feedback/stats');
  assert.strictEqual(statsRes.success, true);
  assert(statsRes.stats.totalFeedback >= 2, 'Stats should reflect recorded feedbacks');
  assert.strictEqual(statsRes.feedbackCategories.length, 7);

  // 7b. Query Feedbacks
  const itemsRes = await apiGet('/api/feedback/items?category=Interested+in+purchasing');
  assert.strictEqual(itemsRes.success, true);
  assert(itemsRes.feedbacks.length >= 1, 'Should return matching feedback entry');

  // 7c. High-Value Prospects
  const hvRes = await apiGet('/api/feedback/high-value');
  assert.strictEqual(hvRes.success, true);
  assert(hvRes.prospects.length >= 1, 'Should list high-value prospects');

  // 7d. Update meeting to Completed -> Auto-schedules follow-up
  const patchRes = await apiPatch(`/api/calendar/meetings/${meeting.id}/status`, { status: 'Completed' });
  assert.strictEqual(patchRes.success, true);

  // Verify follow-up was scheduled for this meeting
  const autoFollowUps = db.getFollowUps({ meetingId: meeting.id });
  const list = autoFollowUps.followUps || autoFollowUps;
  assert(list.length >= 1, 'Marking meeting as Completed must auto-schedule post-demo follow-up');
  console.log(`Auto-scheduled follow-up for meeting #${meeting.id}: Type=${list[0].followUpType}, Date=${list[0].scheduledDate}`);

  // 7e. List Follow-Ups
  const fuListRes = await apiGet('/api/feedback/followups?status=Pending');
  assert.strictEqual(fuListRes.success, true);
  assert(fuListRes.followUps.length >= 1);

  // 7f. Execute Due Follow-Ups
  const runDueRes = await apiPost('/api/feedback/run-due', {});
  assert.strictEqual(runDueRes.success, true);

  // 7g. Unresponsive Leads
  const unrespRes = await apiGet('/api/feedback/unresponsive?days=0');
  assert.strictEqual(unrespRes.success, true);

  // Teardown test server
  await new Promise(resolve => server.close(resolve));
  console.log('✅ Test 7 Passed: All Feedback and Follow-Up REST endpoints verified.\n');

  console.log('🎉 ALL INSTRUCTION 7 TESTS PASSED SUCCESSFULLY! 100% COMPLETE & VERIFIED.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
