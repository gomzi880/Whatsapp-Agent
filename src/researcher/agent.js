/**
 * Global Gym Research Agent Orchestrator
 * Controls automated research jobs, discovery from sources, lead enrichment,
 * and persistent storage into SQLite.
 */

import db, {
  saveOrUpdateLead,
  recordResearchHistory,
  logAuditAction,
  updateAgentMonitoring
} from '../database/db.js';
import { searchGymsFromOSM } from './sources/osm.js';
import { searchGymsFromGoogle } from './sources/google.js';
import { searchGymsFromAIDeepResearch } from './sources/deepResearch.js';
import { enrichFromWebsite, determineConfidenceLevel } from './enricher.js';

// In-memory map of running jobs to control pause/resume/stop signals
const activeJobControllers = new Map();

/**
 * Creates and starts a new research job
 * @param {object} params { country, state, city, category, limit }
 * @returns {Promise<object>} Job status details
 */
export async function startResearchJob({
  country = 'India',
  state = '',
  city = 'Indore',
  category = 'Fitness Centre',
  limit = 30,
}) {
  const insertJob = db.prepare(`
    INSERT INTO research_jobs (
      jobName, targetCountry, targetState, targetCity, targetCategory, searchLimit,
      status, discoveredCount, qualifiedCount, currentProgress, startedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'running', 0, 0, 0, datetime('now'))
  `);

  const jobName = `${category} in ${city}, ${country}`;
  const res = insertJob.run(jobName, country, state || '', city, category, limit);
  const jobId = res.lastInsertRowid;

  const controller = {
    jobId,
    status: 'running', // 'running', 'paused', 'stopped'
  };
  activeJobControllers.set(jobId, controller);

  // Execute job asynchronously in background
  executeResearchJob(jobId, { country, state, city, category, limit }).catch((err) => {
    console.error(`[Research Job #${jobId} Fatal Error]:`, err.message);
    db.prepare("UPDATE research_jobs SET status = 'failed', errorMessage = ? WHERE id = ?").run(
      err.message,
      jobId
    );
    activeJobControllers.delete(jobId);
  });

  return {
    jobId,
    jobName,
    status: 'running',
    target: { country, state, city, category, limit },
  };
}

/**
 * Executes the multi-source discovery, enrichment, and storage pipeline
 */
async function executeResearchJob(jobId, { country, state, city, category, limit }) {
  console.log(`🚀 [Research Job #${jobId}] Starting discovery for "${category}" in ${city}, ${country}...`);

  const controller = activeJobControllers.get(jobId);
  if (!controller) return;

  // 1. Fetch candidate gyms across multi-engine sources:
  // - AI Deep Web Intelligence (Gemini high-coverage search)
  // - Google Places API (if configured in .env)
  // - OpenStreetMap + Photon Deep Locality Engines
  let candidates = [];
  const seenCandidateNames = new Set();

  function addCandidates(list) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !item.gymName) continue;
      const cleanName = item.gymName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanName && !seenCandidateNames.has(cleanName)) {
        seenCandidateNames.add(cleanName);
        candidates.push(item);
      }
    }
  }

  // Engine A: AI Deep Web Intelligence (Gemini Grounded Gym Research)
  try {
    const aiResults = await searchGymsFromAIDeepResearch({ city, state, country, category, limit });
    addCandidates(aiResults);
    console.log(`🤖 [Research Job #${jobId}] AI Deep Research yielded ${aiResults.length} initial gyms.`);
  } catch (e) {
    console.warn('[AI Deep Research Provider Note]:', e.message);
  }

  // Engine B: Google Places API (if configured)
  try {
    const googleResults = await searchGymsFromGoogle({ city, state, country, category, limit });
    addCandidates(googleResults);
  } catch (e) {
    console.warn('[Google Search Provider Note]:', e.message);
  }

  // Engine C: OpenStreetMap + Photon Global Directory
  try {
    const remainingNeeded = Math.max(limit - candidates.length, 15);
    const osmResults = await searchGymsFromOSM({ city, state, country, category, limit: remainingNeeded });
    addCandidates(osmResults);
    console.log(`🗺️ [Research Job #${jobId}] OSM & Directory engines contributed ${osmResults.length} gyms.`);
  } catch (e) {
    console.warn('[OSM Search Provider Note]:', e.message);
  }

  // Limit to target limit requested by user
  candidates = candidates.slice(0, limit);

  console.log(`📍 [Research Job #${jobId}] Multi-engine discovery complete. Total distinct candidates: ${candidates.length}. Enriching and storing...`);

  let discoveredCount = 0;
  let qualifiedCount = 0;
  let newLeadsCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    // Check pause or stop signal
    if (controller.status === 'stopped') {
      console.log(`⏹️ [Research Job #${jobId}] Stopped by user.`);
      db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
      activeJobControllers.delete(jobId);
      return { jobId, discoveredCount, qualifiedCount, newLeadsCount, duplicateCount, status: 'stopped' };
    }

    while (controller.status === 'paused') {
      console.log(`⏸️ [Research Job #${jobId}] Job paused. Waiting for resume...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (controller.status === 'stopped') {
        db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
        activeJobControllers.delete(jobId);
        return { jobId, discoveredCount, qualifiedCount, newLeadsCount, duplicateCount, status: 'stopped' };
      }
    }

    const rawGym = candidates[i];
    const researchDate = new Date().toISOString().split('T')[0];

    // 2. Lead Enrichment (Web scrape for emails, social media, owner/founder)
    let enrichedData = {};
    if (rawGym.website) {
      enrichedData = await enrichFromWebsite(rawGym.website);
    }

    // Combine verified fields
    const fullLead = {
      ...rawGym,
      ownerName: enrichedData.ownerName || rawGym.ownerName || null,
      founderName: enrichedData.founderName || rawGym.founderName || null,
      managerName: enrichedData.managerName || rawGym.managerName || null,
      businessEmail: enrichedData.businessEmail || rawGym.businessEmail || null,
      instagramUrl: enrichedData.instagramUrl || rawGym.instagramUrl || null,
      facebookUrl: enrichedData.facebookUrl || rawGym.facebookUrl || null,
      linkedinUrl: enrichedData.linkedinUrl || rawGym.linkedinUrl || null,
      researchDate,
      jobId,
      status: 'New',
    };

    fullLead.confidenceLevel = determineConfidenceLevel(fullLead);

    // 3. Save with strict duplicate prevention in SQLite
    const saved = saveOrUpdateLead(fullLead);
    discoveredCount++;

    if (saved.isNew) {
      newLeadsCount++;
    } else {
      duplicateCount++;
    }

    if (saved.score >= 60 || fullLead.businessEmail || fullLead.businessPhone) {
      qualifiedCount++;
    }

    const progress = Math.round(((i + 1) / candidates.length) * 100);

    // Update job status in database
    db.prepare(`
      UPDATE research_jobs SET
        discoveredCount = ?,
        qualifiedCount = ?,
        currentProgress = ?
      WHERE id = ?
    `).run(discoveredCount, qualifiedCount, progress, jobId);

    // Polite pause between requests to respect rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  // Record historical research tracking
  recordResearchHistory({
    country,
    state: state || '',
    city,
    category,
    discoveredCount,
    acceptedCount: newLeadsCount
  });

  // Mark job completed
  db.prepare(`
    UPDATE research_jobs SET
      status = 'completed',
      currentProgress = 100,
      completedAt = datetime('now')
    WHERE id = ?
  `).run(jobId);

  logAuditAction({
    agentName: 'Research Agent',
    actionType: 'RESEARCH_JOB_COMPLETED',
    targetEntity: 'research_jobs',
    targetId: jobId,
    details: { country, state, city, category, discoveredCount, qualifiedCount, newLeadsCount, duplicateCount }
  });

  updateAgentMonitoring('research_agent', {
    runningStatus: 'Active',
    currentTask: `Finished research in ${city}, ${country} (${newLeadsCount} new leads accepted)`,
    lastExecution: new Date().toISOString()
  });

  activeJobControllers.delete(jobId);
  console.log(`✅ [Research Job #${jobId}] Completed! Discovered: ${discoveredCount}, Qualified: ${qualifiedCount}, New Unique Leads: ${newLeadsCount}, Duplicates Merged: ${duplicateCount}`);

  return { jobId, discoveredCount, qualifiedCount, newLeadsCount, duplicateCount, status: 'completed' };
}

/**
 * Synchronous executor wrapper for research jobs (for schedulers)
 */
export async function executeResearchSync({
  country = 'India',
  state = '',
  city = 'Indore',
  category = 'Fitness Centre',
  limit = 30
}) {
  const insertJob = db.prepare(`
    INSERT INTO research_jobs (
      jobName, targetCountry, targetState, targetCity, targetCategory, searchLimit,
      status, discoveredCount, qualifiedCount, currentProgress, startedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'running', 0, 0, 0, datetime('now'))
  `);

  const jobName = `${category} in ${city}, ${country}`;
  const res = insertJob.run(jobName, country, state || '', city, category, limit);
  const jobId = res.lastInsertRowid;

  const controller = { jobId, status: 'running' };
  activeJobControllers.set(jobId, controller);

  try {
    return await executeResearchJob(jobId, { country, state, city, category, limit });
  } catch (err) {
    console.error(`[Research Job #${jobId} Error]:`, err.message);
    db.prepare("UPDATE research_jobs SET status = 'failed', errorMessage = ? WHERE id = ?").run(
      err.message,
      jobId
    );
    activeJobControllers.delete(jobId);
    throw err;
  }
}

/**
 * Pause a running job
 */
export function pauseResearchJob(jobId) {
  const controller = activeJobControllers.get(Number(jobId));
  if (controller && controller.status === 'running') {
    controller.status = 'paused';
    db.prepare("UPDATE research_jobs SET status = 'paused' WHERE id = ?").run(jobId);
    return true;
  }
  return false;
}

/**
 * Resume a paused job
 */
export function resumeResearchJob(jobId) {
  const controller = activeJobControllers.get(Number(jobId));
  if (controller && controller.status === 'paused') {
    controller.status = 'running';
    db.prepare("UPDATE research_jobs SET status = 'running' WHERE id = ?").run(jobId);
    return true;
  }
  return false;
}

/**
 * Stop a running or paused job
 */
export function stopResearchJob(jobId) {
  const controller = activeJobControllers.get(Number(jobId));
  if (controller) {
    controller.status = 'stopped';
    db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
    activeJobControllers.delete(Number(jobId));
    return true;
  }
  db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
  return true;
}

/**
 * Get all research jobs
 */
export function getResearchJobs(limit = 20) {
  return db.prepare('SELECT * FROM research_jobs ORDER BY id DESC LIMIT ?').all(limit);
}

/**
 * Get active running job status
 */
export function getActiveJobStatus(jobId) {
  return db.prepare('SELECT * FROM research_jobs WHERE id = ?').get(jobId);
}
