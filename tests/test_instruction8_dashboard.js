import assert from 'assert';
import http from 'http';
import app from '../src/dashboard/server.js';
import db, {
  getExecutiveDashboardStats,
  getSalesAnalyticsData,
  getAgentMonitoring,
  updateAgentMonitoring,
  logAuditAction,
  getAuditLogs,
  getAdminSettings,
  updateAdminSettings
} from '../src/database/db.js';

async function runTests() {
  console.log('🚀 Running Instruction 8: Global Gym Sales Dashboard & Analytics Test Suite...\n');

  // TEST 1: All 16 Executive KPI Widgets Verification
  console.log('--- Test 1: Verify All 16 Mandatory Widgets ---');
  const stats = getExecutiveDashboardStats();
  console.log('Stats returned:', stats);

  const mandatoryWidgets = [
    'totalGymsDiscovered',
    'totalQualifiedLeads',
    'highPriorityLeads',
    'leadsWithVerifiedWhatsApp',
    'leadsWithVerifiedEmail',
    'messagesSent',
    'whatsappReplies',
    'emailReplies',
    'interestedGymOwners',
    'meetingsRequested',
    'meetingsScheduled',
    'demonstrationsCompleted',
    'feedbackReceived',
    'convertedCustomers',
    'optOuts',
    'failedMessages'
  ];

  for (const w of mandatoryWidgets) {
    assert(stats[w] !== undefined, `Widget "${w}" must be defined`);
    assert(typeof stats[w] === 'number', `Widget "${w}" must be a number`);
  }
  assert(stats.totalGymsDiscovered >= 1, 'Should reflect existing gym leads');
  assert(stats.messagesSent >= 1, 'Should reflect sent messages');
  console.log('✅ Test 1 Passed: All 16 dashboard widgets verified.\n');

  // TEST 2: All 10 Sales Analytics Datasets Verification
  console.log('--- Test 2: Verify All 10 Sales Analytics Datasets ---');
  const analytics = getSalesAnalyticsData();

  assert(Array.isArray(analytics.countryWiseLeads), '1. countryWiseLeads must be an array');
  assert(Array.isArray(analytics.stateWiseLeads), '2. stateWiseLeads must be an array');
  assert(Array.isArray(analytics.cityWiseLeads), '3. cityWiseLeads must be an array');
  assert(Array.isArray(analytics.categoryLeads), '4. categoryLeads must be an array');
  assert(typeof analytics.outreachPerformance === 'object', '5. outreachPerformance must be an object');
  assert(typeof analytics.whatsappResponseRate === 'number', '6. whatsappResponseRate must be a number');
  assert(typeof analytics.emailResponseRate === 'number', '7. emailResponseRate must be a number');
  assert(typeof analytics.interestConversionRate === 'number', '8. interestConversionRate must be a number');
  assert(typeof analytics.meetingConversionRate === 'number', '9. meetingConversionRate must be a number');
  assert(Array.isArray(analytics.countryWiseSalesPerformance), '10. countryWiseSalesPerformance must be an array');

  console.log('1. Countries:', analytics.countryWiseLeads.length);
  console.log('2. States:', analytics.stateWiseLeads.length);
  console.log('3. Cities:', analytics.cityWiseLeads.length);
  console.log('4. Categories:', analytics.categoryLeads.length);
  console.log('5. Outreach Perf:', analytics.outreachPerformance);
  console.log('6. WA Response Rate:', analytics.whatsappResponseRate + '%');
  console.log('7. Email Response Rate:', analytics.emailResponseRate + '%');
  console.log('8. Interest Conversion Rate:', analytics.interestConversionRate + '%');
  console.log('9. Meeting Conversion Rate:', analytics.meetingConversionRate + '%');
  console.log('10. Country Sales Perf Rows:', analytics.countryWiseSalesPerformance.length);
  console.log('✅ Test 2 Passed: All 10 analytical datasets verified.\n');

  // TEST 3: Agent Monitoring Telemetry & Telemetry Verification
  console.log('--- Test 3: Agent Monitoring Telemetry ---');
  const agents = getAgentMonitoring();
  assert(agents.length === 5, 'Must have all 5 system agents registered');

  const requiredFields = [
    'agentName',
    'displayName',
    'currentTask',
    'runningStatus',
    'lastExecution',
    'nextScheduledExecution',
    'tasksCompleted',
    'tasksFailed',
    'apiErrors',
    'totalExecutionTimeSeconds'
  ];

  for (const ag of agents) {
    for (const f of requiredFields) {
      assert(ag[f] !== undefined, `Agent ${ag.agentName} must have field ${f}`);
    }
  }

  // Test agent control action
  const updatedPause = updateAgentMonitoring('whatsapp_sales_agent', { runningStatus: 'Paused' });
  assert.strictEqual(updatedPause, true);
  const pausedAgent = getAgentMonitoring().find(a => a.agentName === 'whatsapp_sales_agent');
  assert.strictEqual(pausedAgent.runningStatus, 'Paused');

  // Resume agent
  updateAgentMonitoring('whatsapp_sales_agent', { runningStatus: 'Active' });
  console.log('✅ Test 3 Passed: Agent monitoring telemetry and state transitions verified.\n');

  // TEST 4: Audit Trail Logging & Querying
  console.log('--- Test 4: Audit Trail Engine ---');
  const auditEntry = logAuditAction({
    agentName: 'research_agent',
    actionType: 'DISCOVER_GYMS',
    targetEntity: 'leads',
    targetId: 1,
    status: 'success',
    details: { gymsFound: 15, location: 'Indore, India' },
    performedBy: 'autonomous_cron'
  });
  assert(auditEntry.id > 0);

  const logsResult = getAuditLogs({ actionType: 'DISCOVER_GYMS' });
  assert(logsResult.logs.length >= 1, 'Should find logged audit action');
  assert.strictEqual(logsResult.logs[0].actionType, 'DISCOVER_GYMS');
  console.log('✅ Test 4 Passed: Audit trail persistence and search verified.\n');

  // TEST 5: Admin Controls & Global Settings
  console.log('--- Test 5: Global Admin Settings ---');
  const initialSettings = getAdminSettings();
  assert(initialSettings.dailyOutreachLimit > 0);

  const updatedSettings = updateAdminSettings({
    dailyOutreachLimit: 75,
    dailyEmailLimit: 150,
    followUpCooldownHours: 48
  }, 'super_admin');
  assert.strictEqual(updatedSettings.dailyOutreachLimit, 75);
  assert.strictEqual(updatedSettings.dailyEmailLimit, 150);
  console.log('✅ Test 5 Passed: Global admin controls saved & audited.\n');

  // TEST 6: Express REST API Endpoints Verification
  console.log('--- Test 6: Dashboard Server REST API Endpoints ---');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3188, resolve));

  async function apiGet(path) {
    const res = await fetch(`http://localhost:3188${path}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`http://localhost:3188${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // 6a. Overview Stats
  const overviewRes = await apiGet('/api/dashboard/overview-stats');
  assert.strictEqual(overviewRes.success, true);
  assert(overviewRes.stats.totalGymsDiscovered >= 1);

  // 6b. Analytics
  const analyticsRes = await apiGet('/api/dashboard/analytics');
  assert.strictEqual(analyticsRes.success, true);
  assert(analyticsRes.analytics.countryWiseLeads.length >= 1);

  // 6c. Agents
  const agentsRes = await apiGet('/api/dashboard/agents');
  assert.strictEqual(agentsRes.success, true);
  assert.strictEqual(agentsRes.agents.length, 5);

  // 6d. Agent Control
  const ctrlRes = await apiPost('/api/dashboard/agents/email_sales_agent/action', { action: 'pause' });
  assert.strictEqual(ctrlRes.success, true);
  assert.strictEqual(ctrlRes.runningStatus, 'Paused');

  // Resume agent
  const resumeRes = await apiPost('/api/dashboard/agents/email_sales_agent/action', { action: 'resume' });
  assert.strictEqual(resumeRes.success, true);
  assert.strictEqual(resumeRes.runningStatus, 'Active');

  // 6e. Audit Logs
  const auditRes = await apiGet('/api/dashboard/audit-logs');
  assert.strictEqual(auditRes.success, true);
  assert(auditRes.logs.length >= 1);

  // 6f. Settings GET & POST
  const getSetRes = await apiGet('/api/dashboard/settings');
  assert.strictEqual(getSetRes.success, true);

  const postSetRes = await apiPost('/api/dashboard/settings', { dailyOutreachLimit: 60 });
  assert.strictEqual(postSetRes.success, true);
  assert.strictEqual(postSetRes.settings.dailyOutreachLimit, 60);

  // Teardown
  await new Promise(resolve => server.close(resolve));
  console.log('✅ Test 6 Passed: All REST endpoints operational and verified.\n');

  console.log('🎉 ALL INSTRUCTION 8 TESTS PASSED SUCCESSFULLY! 100% COMPLETE & VERIFIED.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
