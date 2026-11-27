import { db } from '../src/database/db.js';

console.log('🧹 Cleaning test records and research data as requested by user...');

const tablesToClear = [
  'leads',
  'lead_messages',
  'outreach_campaigns',
  'email_campaigns',
  'lead_emails',
  'meetings',
  'feedbacks',
  'follow_ups',
  'research_jobs',
  'research_history',
  'daily_research_logs',
  'free_trial_subscriptions',
  'audit_logs'
];

db.transaction(() => {
  for (const table of tablesToClear) {
    try {
      const countBefore = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
      db.prepare(`DELETE FROM ${table}`).run();
      console.log(`✅ Cleared ${table}: removed ${countBefore} records`);
    } catch (err) {
      console.warn(`⚠️ Notice for ${table}:`, err.message);
    }
  }

  // Reset sqlite_sequence for cleared tables
  try {
    for (const table of tablesToClear) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
    }
    console.log('✅ Auto-increment counters reset for cleared tables.');
  } catch (err) {
    console.warn('Notice resetting sqlite_sequence:', err.message);
  }
})();

console.log('\n🔒 Master Data Retained & Verified:');
const masterTables = ['knowledge_items', 'knowledge_documents', 'knowledge_settings', 'admin_users', 'agent_monitoring', 'research_schedules'];
for (const m of masterTables) {
  try {
    const c = db.prepare(`SELECT COUNT(*) as c FROM ${m}`).get().c;
    console.log(`  🛡️ ${m}: ${c} records intact`);
  } catch (err) {
    console.log(`  🛡️ ${m}: ${err.message}`);
  }
}

console.log('\n✨ Database cleanup complete! Fresh clean state ready for production use.');
