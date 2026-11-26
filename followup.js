import fs from 'fs';
import path from 'path';

const TRACKER_FILE = './leads_tracker.json';

// In-memory cache synced with disk
let tracker = {};

function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      tracker = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading leads_tracker.json:', err.message);
    tracker = {};
  }
}

function saveTracker() {
  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving leads_tracker.json:', err.message);
  }
}

// Initial load
loadTracker();

/**
 * Record or update lead interaction timestamp
 * @param {string} jid
 * @param {string} lastMessage
 */
export function recordLeadActivity(jid, lastMessage = '') {
  if (!jid || jid.endsWith('@g.us')) return;

  const now = Date.now();
  if (!tracker[jid]) {
    tracker[jid] = {
      jid,
      createdAt: now,
      lastInteraction: now,
      lastMessage,
      followUpSent: false,
    };
  } else {
    tracker[jid].lastInteraction = now;
    tracker[jid].lastMessage = lastMessage;
    // Reset follow-up status if they interacted again
    tracker[jid].followUpSent = false;
  }
  saveTracker();
}

/**
 * Check which leads are due for a 24-hour follow-up
 * @param {number} delayMs Follow up threshold (default 24 hours)
 * @returns {Array<object>} Due leads
 */
export function getDueFollowUps(delayMs = 24 * 60 * 60 * 1000) {
  loadTracker();
  const now = Date.now();
  const due = [];

  for (const [jid, data] of Object.entries(tracker)) {
    const elapsed = now - data.lastInteraction;
    // Due if older than delayMs, less than 4 days old, and follow-up not yet sent
    if (elapsed >= delayMs && elapsed <= 4 * 24 * 60 * 60 * 1000 && !data.followUpSent) {
      due.push(data);
    }
  }

  return due;
}

/**
 * Mark a lead's follow-up as sent
 * @param {string} jid
 */
export function markFollowUpSent(jid) {
  if (tracker[jid]) {
    tracker[jid].followUpSent = true;
    tracker[jid].followUpSentAt = Date.now();
    saveTracker();
  }
}

/**
 * Generates a warm, natural human follow-up message
 */
export function getFollowUpText() {
  const messages = [
    "Hey! 👋 Hope you're having a productive week. Just wanted to check in — were you able to explore the 30-day free trial on gymstack.in/register, or would you like me to walk you through a quick 5-min live demo?",
    "Hey! Just following up on our chat about GymStack. Did you have any other questions regarding biometric setup or automated WhatsApp fee collection?",
    "Hi there! Quick check-in — would you like to see a quick 10-minute live screen demo of GymStack today to see how it works for your gym?",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
