/**
 * Global Gym Research Agent Orchestrator
 * Controls automated research jobs, discovery from sources, lead enrichment,
 * and persistent storage into SQLite.
 */

import db, { saveOrUpdateLead } from '../database/db.js';
import { searchGymsFromOSM } from './sources/osm.js';
import { searchGymsFromGoogle } from './sources/google.js';
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

  // 1. Fetch raw candidate gyms from Google Places (if configured) and OpenStreetMap
  let candidates = [];

  try {
    const googleResults = await searchGymsFromGoogle({ city, state, country, category, limit });
    if (googleResults && googleResults.length > 0) {
      candidates.push(...googleResults);
    }
  } catch (e) {
    console.warn('[Google Search Provider Note]:', e.message);
  }

  // Complement with OpenStreetMap authorized directory
  const remainingNeeded = Math.max(limit - candidates.length, 10);
  const osmResults = await searchGymsFromOSM({ city, state, country, category, limit: remainingNeeded });
  candidates.push(...osmResults);

  // Limit to user requested limit
  candidates = candidates.slice(0, limit);

  console.log(`📍 [Research Job #${jobId}] Discovered ${candidates.length} candidate businesses. Enriching data...`);

  let discoveredCount = 0;
  let qualifiedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    // Check pause or stop signal
    if (controller.status === 'stopped') {
      console.log(`⏹️ [Research Job #${jobId}] Stopped by user.`);
      db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
      activeJobControllers.delete(jobId);
      return;
    }

    while (controller.status === 'paused') {
      console.log(`⏸️ [Research Job #${jobId}] Job paused. Waiting for resume...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (controller.status === 'stopped') {
        db.prepare("UPDATE research_jobs SET status = 'stopped', completedAt = datetime('now') WHERE id = ?").run(jobId);
        activeJobControllers.delete(jobId);
        return;
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

  // Mark job completed
  db.prepare(`
    UPDATE research_jobs SET
      status = 'completed',
      currentProgress = 100,
      completedAt = datetime('now')
    WHERE id = ?
  `).run(jobId);

  activeJobControllers.delete(jobId);
  console.log(`✅ [Research Job #${jobId}] Completed! Discovered: ${discoveredCount}, Qualified: ${qualifiedCount}`);
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
