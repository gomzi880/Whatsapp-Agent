/**
 * Daily Automatic Global Gym Research Scheduler
 * 
 * Runs daily from 7:00 AM to 10:00 AM Asia/Kolkata (IST).
 * Discovers at least 10 NEW and UNIQUE eligible gym businesses per day.
 * Avoids repeated locations using locationRotator and enforces strict
 * pre-insert historical deduplication so previously researched gyms never count.
 */

import { executeResearchSync } from '../researcher/agent.js';
import { getNextResearchTarget } from '../researcher/locationRotator.js';
import db, {
  getTodaysNewLeadsCount,
  logAuditAction,
  updateAgentMonitoring,
  getAdminSettings
} from '../database/db.js';

let schedulerInterval = null;
let isSessionRunning = false;
let lastSessionDate = null;

/**
 * Gets current time in Asia/Kolkata time zone
 */
export function getCurrentISTTime() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = istFormatter.formatToParts(now);
  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const hours = parseInt(map.hour, 10);
  const minutes = parseInt(map.minute, 10);
  const dateStr = `${map.year}-${map.month}-${map.day}`;

  // Research window: 7:00 AM to 10:00 AM IST
  const isWithinWindow = (hours >= 7 && hours < 10);

  return {
    dateStr,
    hours,
    minutes,
    isWithinWindow,
    isoIST: `${dateStr}T${map.hour}:${map.minute}:${map.second}+05:30`
  };
}

export function isWithinResearchWindow(date = new Date()) {
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit'
  });
  const hours = parseInt(istFormatter.format(date), 10);
  return hours >= 7 && hours < 10;
}

export async function runDailyResearchRoutine(options = {}) {
  return runDailyResearchSession(options);
}

/**
 * Runs a research session until daily target (default 10 new unique leads) is reached
 * or max location attempts are completed.
 * @param {object} options
 * @returns {Promise<object>} Session summary report
 */
export async function runDailyResearchSession(options = {}) {
  const {
    targetNewLeads = 10,
    forceLocation = null
  } = options;
  const maxLocationsPerRun = options.maxLocationsPerRun || options.maxLocationsToTry || 4;

  if (isSessionRunning) {
    console.log('⚠️ [Research Scheduler] Research session already in progress. Skipping duplicate invocation.');
    return { status: 'already_running' };
  }

  isSessionRunning = true;
  const startTime = new Date();
  const ist = getCurrentISTTime();

  console.log(`\n======================================================`);
  console.log(`🌐 [Research Scheduler] Starting Daily Research Session`);
  console.log(`📅 Date (IST): ${ist.dateStr} | Time: ${ist.hours}:${ist.minutes.toString().padStart(2, '0')}`);
  console.log(`🎯 Daily Target: At least ${targetNewLeads} NEW & UNIQUE gym leads`);
  console.log(`======================================================\n`);

  updateAgentMonitoring('research_agent', {
    runningStatus: 'Active',
    currentTask: `Daily research session in progress (Target: ${targetNewLeads} new leads)`
  });

  logAuditAction({
    agentName: 'Research Scheduler',
    actionType: 'DAILY_RESEARCH_SESSION_STARTED',
    details: { istTime: ist.isoIST, targetNewLeads }
  });

  const locationsResearched = [];
  let totalNewLeadsAcquired = 0;
  let attempts = 0;

  try {
    // Check how many new leads were already discovered today
    let currentNewToday = getTodaysNewLeadsCount(ist.dateStr);
    console.log(`📊 [Research Scheduler] New unique leads recorded today so far: ${currentNewToday}`);

    while (currentNewToday < targetNewLeads && attempts < maxLocationsPerRun) {
      attempts++;

      // Pick next target location via Rotator
      const target = forceLocation || getNextResearchTarget();
      console.log(`📍 [Research Scheduler Attempt #${attempts}] Researched Target: ${target.category} in ${target.city}, ${target.state ? target.state + ', ' : ''}${target.country}`);

      updateAgentMonitoring('research_agent', {
        currentTask: `Researching ${target.city}, ${target.country} (Attempt ${attempts}/${maxLocationsPerRun})`
      });

      // Execute research synchronously for this city
      const result = await executeResearchSync({
        country: target.country,
        state: target.state,
        city: target.city,
        category: target.category,
        limit: 30
      });

      const newInThisRun = result.newLeadsCount || 0;
      totalNewLeadsAcquired += newInThisRun;
      locationsResearched.push({
        location: `${target.city}, ${target.country}`,
        discovered: result.discoveredCount || 0,
        newLeads: newInThisRun,
        duplicates: result.duplicateCount || 0,
        qualified: result.qualifiedCount || 0
      });

      // Update current count from DB
      currentNewToday = getTodaysNewLeadsCount(ist.dateStr);
      console.log(`📈 Progress: ${currentNewToday}/${targetNewLeads} new unique leads completed today.`);

      if (currentNewToday >= targetNewLeads) {
        console.log(`🎉 [Research Scheduler] Daily target achieved! (${currentNewToday}/${targetNewLeads} new unique leads).`);
        break;
      }

      // If user provided a single forceLocation, do not loop
      if (forceLocation) break;

      // Polite pause between locations
      await new Promise((r) => setTimeout(r, 1000));
    }

    const durationSeconds = Math.round((Date.now() - startTime.getTime()) / 1000);
    const targetMet = currentNewToday >= targetNewLeads;
    lastSessionDate = ist.dateStr;

    const summary = {
      status: 'completed',
      date: ist.dateStr,
      targetNewLeads,
      newLeadsToday: currentNewToday,
      newLeadsInThisSession: totalNewLeadsAcquired,
      targetMet,
      locationsResearched,
      durationSeconds,
      completedAt: new Date().toISOString()
    };

    updateAgentMonitoring('research_agent', {
      runningStatus: 'Active',
      currentTask: `Idle - Daily research complete. Today's new leads: ${currentNewToday}/${targetNewLeads} (Target ${targetMet ? 'Met' : 'Partial'})`,
      lastExecution: new Date().toISOString()
    });

    logAuditAction({
      agentName: 'Research Scheduler',
      actionType: 'DAILY_RESEARCH_SESSION_COMPLETED',
      details: summary
    });

    console.log(`✅ [Research Scheduler] Session complete in ${durationSeconds}s. Target met: ${targetMet}`);
    return summary;
  } catch (err) {
    console.error('❌ [Research Scheduler Fatal Error]:', err.message);

    updateAgentMonitoring('research_agent', {
      runningStatus: 'Error',
      currentTask: `Error in daily research session: ${err.message}`
    });

    logAuditAction({
      agentName: 'Research Scheduler',
      actionType: 'DAILY_RESEARCH_SESSION_FAILED',
      status: 'failed',
      details: { error: err.message }
    });

    return {
      status: 'failed',
      error: err.message,
      newLeadsToday: getTodaysNewLeadsCount(ist.dateStr)
    };
  } finally {
    isSessionRunning = false;
  }
}

/**
 * Starts the background timer checking every 60 seconds
 * to launch research daily at 7:00 AM IST
 */
export function startDailyResearchScheduler() {
  if (schedulerInterval) {
    return { status: 'already_started' };
  }

  console.log('⏰ [Research Scheduler] Daily Research Scheduler initialized (Window: 7:00 AM - 10:00 AM Asia/Kolkata).');

  // Check every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      const settings = getAdminSettings();
      if (!settings.researchAgentActive) return;

      const ist = getCurrentISTTime();

      // If within 7:00 AM to 10:00 AM IST and hasn't completed today
      if (ist.isWithinWindow && lastSessionDate !== ist.dateStr && !isSessionRunning) {
        const todayCount = getTodaysNewLeadsCount(ist.dateStr);
        if (todayCount < 10) {
          console.log(`⏰ [Research Scheduler Trigger] 7:00 AM - 10:00 AM IST window active. Launching daily research...`);
          await runDailyResearchSession({ targetNewLeads: 10 });
        } else {
          lastSessionDate = ist.dateStr;
        }
      }
    } catch (err) {
      console.error('[Research Scheduler Tick Error]:', err.message);
    }
  }, 60 * 1000);

  return { status: 'started' };
}

/**
 * Stops the background scheduler
 */
export function stopDailyResearchScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏹️ [Research Scheduler] Scheduler stopped.');
    return { status: 'stopped' };
  }
  return { status: 'not_running' };
}

/**
 * Returns current scheduler status
 */
export function getResearchSchedulerStatus() {
  const ist = getCurrentISTTime();
  return {
    isActive: !!schedulerInterval,
    isSessionRunning,
    lastSessionDate,
    currentIST: ist.isoIST,
    isWithinDailyWindow: ist.isWithinWindow,
    todaysNewLeads: getTodaysNewLeadsCount(ist.dateStr),
    dailyTarget: 10
  };
}
