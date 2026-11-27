import assert from 'assert';
import { processProspectReply } from '../src/outreach/campaignManager.js';
import { recordLeadMessage, getLeadMessages, db } from '../src/database/db.js';

async function runTest() {
  console.log('🧪 Starting Verification: Live Prospect Message Recording & Chat Feed...');

  const testJid = '999888777666@lid';
  const testPhone = '999888777666';

  // Clean previous test messages if any
  db.prepare('DELETE FROM lead_messages WHERE remoteJid = ?').run(testJid);

  // 1. Simulate incoming prospect message from an unregistered direct contact
  console.log('\n1. Testing incoming message from unregistered WhatsApp contact (@lid)...');
  const incomingResult = await processProspectReply(testJid, 'Hello, I want to know about Gym Stack software pricing.');

  assert.strictEqual(incomingResult.intent, 'pricing', 'Should detect pricing intent correctly');

  // Verify message was recorded in lead_messages
  const prospectMsgs = getLeadMessages({ remoteJid: testJid, role: 'prospect' });
  assert.strictEqual(prospectMsgs.messages.length >= 1, true, 'Prospect message MUST be recorded in lead_messages');
  const savedMsg = prospectMsgs.messages[0];
  assert.strictEqual(savedMsg.senderRole, 'prospect', 'Sender role must be prospect');
  assert.strictEqual(savedMsg.status, 'received', 'Status must be received');
  assert.strictEqual(savedMsg.messageText, 'Hello, I want to know about Gym Stack software pricing.');
  console.log('✅ Prospect message recorded successfully with role="prospect" and status="received"!');

  // 2. Simulate agent response
  console.log('\n2. Testing agent reply recording...');
  recordLeadMessage({
    leadId: null,
    remoteJid: testJid,
    senderRole: 'agent',
    messageText: 'Hello! Gym Stack Starter plan starts at ₹499/mo. Would you like a free 30-day trial?',
    status: 'sent',
    intent: 'pricing_reply'
  });

  // 3. Verify chronological order ('asc') for WhatsApp chat modal
  console.log('\n3. Testing chronological order query for WhatsApp chat modal...');
  const chatThread = getLeadMessages({ remoteJid: testJid, order: 'asc', limit: 10 });
  assert.strictEqual(chatThread.messages.length >= 2, true, 'Chat thread should contain both messages');
  assert.strictEqual(chatThread.messages[0].senderRole, 'prospect', 'First message chronologically should be prospect');
  assert.strictEqual(chatThread.messages[1].senderRole, 'agent', 'Second message chronologically should be agent');
  console.log('✅ Chronological ordering for WhatsApp chat modal verified!');

  // 4. Test opt-out handling for unregistered contact
  console.log('\n4. Testing opt-out detection and acknowledgment for direct contacts...');
  const optOutResult = await processProspectReply(testJid, 'STOP');
  assert.strictEqual(optOutResult.haltOutreach, true, 'Outreach must be halted on opt-out');
  assert.strictEqual(optOutResult.intent, 'opt_out', 'Intent must be opt_out');

  const optOutMsgs = getLeadMessages({ remoteJid: testJid, intent: 'opt_out' });
  assert.strictEqual(optOutMsgs.messages.length >= 1, true, 'Opt-out incoming message must be stored');
  console.log('✅ Opt-out detection and handling verified for direct WhatsApp contacts!');

  // Cleanup test messages
  db.prepare('DELETE FROM lead_messages WHERE remoteJid = ?').run(testJid);

  console.log('\n🎉 ALL 4 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
