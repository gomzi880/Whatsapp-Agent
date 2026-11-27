/**
 * Admin Authentication & Session Management Service
 * Cryptographically secured using Node.js native crypto.scrypt & constant-time validation.
 */
import crypto from 'crypto';
import db from '../database/db.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DURATION_HOURS = 24;
const REMEMBER_ME_DAYS = 30;

/**
 * Derives a cryptographic hash from a plaintext password with a random salt
 * @param {string} password 
 * @returns {Promise<{ salt: string, hash: string }>}
 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({
        salt,
        hash: derivedKey.toString('hex')
      });
    });
  });
}

/**
 * Verifies a plaintext password against stored salt and hash using timing-safe comparison
 * @param {string} password 
 * @param {string} salt 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, salt, storedHash) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const hashBuffer = Buffer.from(storedHash, 'hex');
      if (derivedKey.length !== hashBuffer.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(derivedKey, hashBuffer));
    });
  });
}

/**
 * Creates or updates an administrator user
 */
export async function createAdminUser({ username, email, password, role = 'admin' }) {
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Valid email address required');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const { salt, hash } = await hashPassword(password);

  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);

  if (existing) {
    db.prepare(`
      UPDATE admin_users 
      SET passwordHash = ?, salt = ?, role = ?, failedAttempts = 0, lockedUntil = NULL
      WHERE id = ?
    `).run(hash, salt, role, existing.id);
    return db.prepare('SELECT id, username, email, role, createdAt FROM admin_users WHERE id = ?').get(existing.id);
  } else {
    const res = db.prepare(`
      INSERT INTO admin_users (username, email, passwordHash, salt, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanUsername, cleanEmail, hash, salt, role);
    return db.prepare('SELECT id, username, email, role, createdAt FROM admin_users WHERE id = ?').get(res.lastInsertRowid);
  }
}

/**
 * Authenticates an administrator by username or email
 */
export async function authenticateAdmin(identifier, password, ipAddress = '') {
  const cleanId = String(identifier).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ? OR email = ?').get(cleanId, cleanId);

  if (!user) {
    return { success: false, reason: 'Invalid username or password' };
  }

  // Check lockout
  if (user.lockedUntil) {
    const lockedUntilTime = new Date(user.lockedUntil).getTime();
    if (Date.now() < lockedUntilTime) {
      const waitMin = Math.ceil((lockedUntilTime - Date.now()) / 60000);
      return { success: false, reason: `Account is temporarily locked. Please try again in ${waitMin} minute(s).` };
    }
  }

  const isMatch = await verifyPassword(password, user.salt, user.passwordHash);

  if (!isMatch) {
    const attempts = (user.failedAttempts || 0) + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      console.warn(`🔒 [Security Alert]: Admin account '${user.username}' locked for ${LOCKOUT_MINUTES}m after ${attempts} failed attempts.`);
    }

    db.prepare('UPDATE admin_users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?').run(attempts, lockedUntil, user.id);

    // Log failed login audit
    try {
      db.prepare(`
        INSERT INTO audit_logs (agentName, actionType, targetEntity, targetId, status, details, performedBy)
        VALUES ('auth_service', 'LOGIN_FAILED', 'admin_users', ?, 'failed', ?, ?)
      `).run(user.id, JSON.stringify({ ipAddress, attempts, locked: !!lockedUntil }), user.username);
    } catch (e) {}

    return { success: false, reason: 'Invalid username or password' };
  }

  // Reset failed attempts on success
  const now = new Date().toISOString();
  db.prepare('UPDATE admin_users SET failedAttempts = 0, lockedUntil = NULL, lastLoginAt = ? WHERE id = ?').run(now, user.id);

  // Log successful login audit
  try {
    db.prepare(`
      INSERT INTO audit_logs (agentName, actionType, targetEntity, targetId, status, details, performedBy)
      VALUES ('auth_service', 'LOGIN_SUCCESS', 'admin_users', ?, 'success', ?, ?)
    `).run(user.id, JSON.stringify({ ipAddress }), user.username);
  } catch (e) {}

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  };
}

/**
 * Creates a persistent session token for an authenticated user
 */
export function createSession(userId, { rememberMe = false, ipAddress = '', userAgent = '' } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const durationMs = rememberMe
    ? REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000
    : SESSION_DURATION_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  db.prepare(`
    INSERT INTO login_sessions (token, userId, expiresAt, ipAddress, userAgent)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, userId, expiresAt, ipAddress, userAgent);

  return { token, expiresAt, maxAgeMs: durationMs };
}

/**
 * Validates a session token
 */
export function validateSession(token) {
  if (!token || typeof token !== 'string') return null;

  cleanExpiredSessions();

  const session = db.prepare(`
    SELECT s.token, s.expiresAt, u.id as userId, u.username, u.email, u.role
    FROM login_sessions s
    JOIN admin_users u ON s.userId = u.id
    WHERE s.token = ? AND datetime(s.expiresAt) > datetime('now')
  `).get(token);

  return session || null;
}

/**
 * Destroys/revokes a session token (Logout)
 */
export function revokeSession(token) {
  if (!token) return false;
  const res = db.prepare('DELETE FROM login_sessions WHERE token = ?').run(token);
  return res.changes > 0;
}

/**
 * Removes expired sessions from the database
 */
export function cleanExpiredSessions() {
  try {
    db.prepare("DELETE FROM login_sessions WHERE datetime(expiresAt) <= datetime('now')").run();
  } catch (e) {}
}

/**
 * Check if at least one admin account exists
 */
export function hasAdminAccount() {
  const count = db.prepare('SELECT COUNT(*) as count FROM admin_users').get().count;
  return count > 0;
}
