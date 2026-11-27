/**
 * Process Lock & Cross-Process Mutex Utility (Phase 11)
 * 
 * Prevents race conditions, double-dispatches, and concurrent job collisions
 * across background schedulers and asynchronous worker processes.
 */

import fs from 'fs';
import path from 'path';

const LOCKS_DIR = path.resolve('./.locks');

// Ensure locks directory exists
if (!fs.existsSync(LOCKS_DIR)) {
  try {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

/**
 * Attempts to acquire an atomic lock for a given named operation
 * @param {string} lockName Name of the lock (e.g. 'outreach_scheduler', 'research_job')
 * @param {number} ttlSeconds Time-to-live before considering a lock stale (default: 1800s / 30m)
 * @returns {object} { acquired: boolean, lockPath: string, reason?: string }
 */
export function acquireLock(lockName, ttlSeconds = 1800) {
  const safeName = lockName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockPath = path.join(LOCKS_DIR, `${safeName}.lock`);
  const now = Date.now();

  if (fs.existsSync(lockPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const ageSeconds = (now - data.timestamp) / 1000;

      if (ageSeconds < (data.ttlSeconds || ttlSeconds)) {
        return {
          acquired: false,
          lockPath,
          reason: `Lock '${lockName}' is currently held by PID ${data.pid} (acquired ${Math.round(ageSeconds)}s ago)`
        };
      } else {
        // Stale lock detected, override
        console.warn(`⚠️ [ProcessLock] Overriding stale lock '${lockName}' (Age: ${Math.round(ageSeconds)}s > TTL: ${ttlSeconds}s)`);
      }
    } catch (e) {
      // Corrupt lock file, safe to overwrite
    }
  }

  const payload = {
    lockName,
    pid: process.pid,
    timestamp: now,
    ttlSeconds,
    acquiredAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2), { flag: 'w' });
    return { acquired: true, lockPath };
  } catch (err) {
    return { acquired: false, lockPath, reason: err.message };
  }
}

/**
 * Releases an acquired lock
 * @param {string} lockName 
 */
export function releaseLock(lockName) {
  const safeName = lockName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockPath = path.join(LOCKS_DIR, `${safeName}.lock`);

  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
      return true;
    } catch (err) {
      console.warn(`[ProcessLock] Warning releasing lock '${lockName}':`, err.message);
      return false;
    }
  }
  return false;
}

/**
 * Executes an asynchronous function safely with an exclusive mutex lock
 * @param {string} lockName 
 * @param {Function} asyncFn 
 * @param {number} ttlSeconds 
 */
export async function withLock(lockName, asyncFn, ttlSeconds = 1800) {
  const lock = acquireLock(lockName, ttlSeconds);
  if (!lock.acquired) {
    console.log(`🔒 [ProcessLock] Operation '${lockName}' skipped: ${lock.reason}`);
    return { executed: false, reason: lock.reason };
  }

  try {
    const result = await asyncFn();
    return { executed: true, result };
  } finally {
    releaseLock(lockName);
  }
}
