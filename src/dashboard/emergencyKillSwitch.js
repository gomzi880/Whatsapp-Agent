/**
 * Global Emergency Stop Kill-Switch (Phase 10)
 * 
 * Provides an immediate, process-level kill switch that halts all:
 * - Active research jobs
 * - WhatsApp outreach campaigns & schedulers
 * - Email outreach campaigns
 * - Follow-up dispatches
 * 
 * Maintains a strict audit trail of who initiated the stop and when it was resumed.
 */

import db, {
  logAuditAction,
  updateAgentMonitoring,
  getAdminSettings,
  updateAdminSettings
} from '../database/db.js';
import { stopDailyResearchScheduler } from '../scheduler/researchScheduler.js';
import { stopDailyOutreachScheduler } from '../scheduler/outreachScheduler.js';

let isEmergencyStopTriggered = false;

/**
 * Checks whether the emergency kill switch is currently engaged
 */
export function isEmergencyStopActive() {
  if (isEmergencyStopTriggered) return true;
  try {
    const row = db.prepare("SELECT value FROM knowledge_settings WHERE key = 'emergency_stop_active'").get();
    return row && (row.value === 'true' || row.value === '1');
  } catch (e) {
    return isEmergencyStopTriggered;
  }
}

/**
 * Immediately halts all automated outreach, campaigns, and schedulers
 * @param {object} options { reason, initiatedBy }
 */
export function triggerEmergencyStop(options = {}) {
  const {
    reason = 'Immediate administrative intervention required',
    initiatedBy = 'administrator'
  } = options;

  isEmergencyStopTriggered = true;

  // 1. Persist state in database settings
  db.prepare(`
    INSERT INTO knowledge_settings (key, value)
    VALUES ('emergency_stop_active', 'true')
    ON CONFLICT(key) DO UPDATE SET value = 'true'
  `).run();

  // 2. Pause global agent settings
  updateAdminSettings({
    whatsappAgentActive: false,
    emailAgentActive: false,
    researchAgentActive: false,
    calendarAgentActive: false
  }, initiatedBy);

  // 3. Stop background scheduler timers
  try {
    stopDailyResearchScheduler();
    stopDailyOutreachScheduler();
  } catch (e) {
    console.warn('[Emergency Stop Timer Warning]:', e.message);
  }

  // 4. Update agent monitoring state for all agents
  const agents = ['research_agent', 'outreach_agent', 'sales_agent', 'feedback_agent', 'trial_tracker_agent'];
  for (const ag of agents) {
    try {
      updateAgentMonitoring(ag, {
        runningStatus: 'Paused - Emergency Stop',
        currentTask: `HALTED: ${reason}`
      });
    } catch (e) {}
  }

  // 5. Record high-priority audit log
  logAuditAction({
    agentName: 'Global Emergency Kill-Switch',
    actionType: 'EMERGENCY_STOP_TRIGGERED',
    details: { reason, timestamp: new Date().toISOString() },
    performedBy: initiatedBy
  });

  console.log(`\n======================================================`);
  console.log(`🚨 [EMERGENCY STOP] SYSTEM HALTED BY ${initiatedBy.toUpperCase()}!`);
  console.log(`   Reason: ${reason}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    emergencyStopActive: true,
    reason,
    stoppedAt: new Date().toISOString()
  };
}

/**
 * Resumes system operations after emergency stop
 * @param {object} options { initiatedBy }
 */
export function resumeSystemFromEmergencyStop(options = {}) {
  const { initiatedBy = 'administrator' } = options;

  isEmergencyStopTriggered = false;

  // 1. Persist cleared state in database
  db.prepare(`
    INSERT INTO knowledge_settings (key, value)
    VALUES ('emergency_stop_active', 'false')
    ON CONFLICT(key) DO UPDATE SET value = 'false'
  `).run();

  // 2. Re-enable global agent settings
  updateAdminSettings({
    whatsappAgentActive: true,
    emailAgentActive: true,
    researchAgentActive: true,
    calendarAgentActive: true
  }, initiatedBy);

  // 3. Restore agent monitoring statuses
  const agents = ['research_agent', 'outreach_agent', 'sales_agent', 'feedback_agent', 'trial_tracker_agent'];
  for (const ag of agents) {
    try {
      updateAgentMonitoring(ag, {
        runningStatus: 'Active',
        currentTask: 'Idle - Monitoring pipeline'
      });
    } catch (e) {}
  }

  // 4. Record audit log
  logAuditAction({
    agentName: 'Global Emergency Kill-Switch',
    actionType: 'SYSTEM_RESUMED_FROM_EMERGENCY_STOP',
    details: { resumedAt: new Date().toISOString() },
    performedBy: initiatedBy
  });

  console.log(`\n======================================================`);
  console.log(`🟢 [SYSTEM RESUMED] Emergency stop disengaged by ${initiatedBy.toUpperCase()}.`);
  console.log(`======================================================\n`);

  return {
    success: true,
    emergencyStopActive: false,
    resumedAt: new Date().toISOString()
  };
}

export const resumeFromEmergencyStop = resumeSystemFromEmergencyStop;
