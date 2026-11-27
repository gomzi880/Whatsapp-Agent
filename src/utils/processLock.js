/**
 * Multi-Process Mutex Lock & Concurrency Guard (Phase 11)
 * 
 * Prevents race conditions and double-dispatching by ensuring only one
 * primary automation runner or scheduler daemon holds the active lock.
 * Supports automatic recovery from stale locks (>1 hour old or dead PID).
 */

import fs from 'fs';
import path from 'path';

const LOCK_FILE = path.resolve('.process.lock');
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour stale lock expiry

/**
 * Checks if a process ID is currently running on the operating system
 */
function isPidRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Attempts to acquire an exclusive lock
 * @param {string} processName
 * @returns {object} { acquired: boolean, lockInfo: object }
 */
export function acquireProcessLock(processName = 'MasterDaemon') {
  const now = Date.now();

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const raw = fs.readFileSync(LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(raw);

      // Check if stale by timeout
      const isStale = (now - lockData.timestamp) > DEFAULT_TIMEOUT_MS;
      // Check if PID is still alive
      const isAlive = lockData.pid ? isPidRunning(lockData.pid) : false;

      if (!isStale && isAlive && lockData.pid !== process.pid) {
        return {
          acquired: false,
          reason: `Lock held by process ${lockData.processName} (PID ${lockData.pid})`,
          lockInfo: lockData
        };
      } else {
        console.log(`⚠️ [Process Lock] Reclaiming stale or terminated lock (PID ${lockData.pid}).`);
      }
    } catch (e) {
      // Corrupt lock file, overwrite
    }
  }

  const newLockData = {
    processName,
    pid: process.pid,
    timestamp: now,
    acquiredAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(newLockData, null, 2), 'utf-8');
    return { acquired: true, lockInfo: newLockData };
  } catch (err) {
    return { acquired: false, reason: err.message };
  }
}

/**
 * Releases the acquired process lock
 */
export function releaseProcessLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const raw = fs.readFileSync(LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(raw);
      if (lockData.pid === process.pid) {
        fs.unlinkSync(LOCK_FILE);
        return true;
      }
    } catch (e) {
      try { fs.unlinkSync(LOCK_FILE); return true; } catch (err) {}
    }
  }
  return false;
}

/**
 * Clean up lock file automatically on process exit
 */
process.on('exit', () => {
  releaseProcessLock();
});
process.on('SIGINT', () => {
  releaseProcessLock();
  process.exit(0);
});
process.on('SIGTERM', () => {
  releaseProcessLock();
  process.exit(0);
});
