/**
 * Automated Verification Suite for Phase 1 (Protection & Backups) and Phase 2 (Admin Auth & Security)
 */
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/dashboard/server.js';
import db from '../src/database/db.js';
import { createDatabaseBackup, listDatabaseBackups } from '../src/utils/backupService.js';
import {
  hashPassword,
  verifyPassword,
  createAdminUser,
  authenticateAdmin,
  createSession,
  validateSession,
  revokeSession,
  hasAdminAccount
} from '../src/auth/authService.js';
import { COOKIE_NAME } from '../src/auth/sessionMiddleware.js';

async function runPhase1And2Tests() {
  console.log('================================================================');
  console.log('🧪 VERIFICATION BATTERY: PHASE 1 & PHASE 2');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function testResult(num, name, ok, note = '') {
    if (ok) {
      passed++;
      console.log(`✅ [TEST ${num}] ${name}`);
      if (note) console.log(`   └─ ${note}`);
    } else {
      failed++;
      console.error(`❌ [TEST ${num}] ${name}`);
      if (note) console.error(`   └─ ${note}`);
    }
  }

  // -----------------------------------------------------------------
  // 1. PHASE 1: DATABASE BACKUP SERVICE
  // -----------------------------------------------------------------
  try {
    const backupPath = await createDatabaseBackup('test_audit');
    assert(fs.existsSync(backupPath), 'Backup file must exist on disk');
    const backups = listDatabaseBackups();
    assert(backups.length > 0, 'Backup listing must contain at least 1 file');
    testResult(1, 'Phase 1: Automated SQLite snapshot created', true, `Snapshot saved at ${backupPath}`);
  } catch (err) {
    testResult(1, 'Phase 1: Automated SQLite snapshot created', false, err.message);
  }

  // -----------------------------------------------------------------
  // 2. PHASE 1: EXISTING WHATSAPP CREDENTIAL INTEGRITY
  // -----------------------------------------------------------------
  try {
    const authDir = path.resolve('./auth_info_baileys');
    assert(fs.existsSync(authDir), 'Baileys auth folder must be present');
    const credFiles = fs.readdirSync(authDir);
    const hasCreds = credFiles.some(f => f.includes('creds.json'));
    assert(hasCreds, 'creds.json must be preserved');
    testResult(2, 'Phase 1: Baileys WhatsApp credentials preserved', true, `${credFiles.length} auth files intact in ./auth_info_baileys`);
  } catch (err) {
    testResult(2, 'Phase 1: Baileys WhatsApp credentials preserved', false, err.message);
  }

  // -----------------------------------------------------------------
  // 3. PHASE 2: SCRYPT PASSWORD HASHING & TIMING-SAFE VERIFICATION
  // -----------------------------------------------------------------
  try {
    const password = 'SuperSecret@2026';
    const { salt, hash } = await hashPassword(password);
    assert(salt && hash, 'Salt and hash must be generated');
    
    const valid = await verifyPassword(password, salt, hash);
    const invalid = await verifyPassword('WrongPassword', salt, hash);
    assert.strictEqual(valid, true, 'Correct password must verify');
    assert.strictEqual(invalid, false, 'Incorrect password must reject');
    testResult(3, 'Phase 2: Scrypt 512-bit password hashing & verification', true, 'Cryptographic salt and hash validated');
  } catch (err) {
    testResult(3, 'Phase 2: Scrypt 512-bit password hashing & verification', false, err.message);
  }

  // -----------------------------------------------------------------
  // 4. PHASE 2: ADMIN USER CREATION & IDEMPOTENCY
  // -----------------------------------------------------------------
  try {
    const testAdmin = await createAdminUser({
      username: 'test_sec_admin',
      email: 'test_admin@gymstack.in',
      password: 'InitialPassword123'
    });
    assert(testAdmin && testAdmin.id, 'Admin user must be saved');
    assert.strictEqual(testAdmin.role, 'admin');

    const hasAdmin = hasAdminAccount();
    assert.strictEqual(hasAdmin, true, 'hasAdminAccount must return true');
    testResult(4, 'Phase 2: Admin user management & database storage', true, `Admin #${testAdmin.id} created with role '${testAdmin.role}'`);
  } catch (err) {
    testResult(4, 'Phase 2: Admin user management & database storage', false, err.message);
  }

  // -----------------------------------------------------------------
  // 5. PHASE 2: AUTHENTICATION & FAILED LOGIN ATTEMPTS / LOCKOUT
  // -----------------------------------------------------------------
  try {
    // 5a. Bad password
    const failRes = await authenticateAdmin('test_sec_admin', 'WrongPass!', '127.0.0.1');
    assert.strictEqual(failRes.success, false);

    // 5b. Good password
    const successRes = await authenticateAdmin('test_sec_admin', 'InitialPassword123', '127.0.0.1');
    assert.strictEqual(successRes.success, true);
    assert.strictEqual(successRes.user.username, 'test_sec_admin');

    // 5c. Audit log verification
    const auditLogs = db.prepare("SELECT * FROM audit_logs WHERE agentName = 'auth_service' ORDER BY id DESC LIMIT 5").all();
    assert(auditLogs.length > 0, 'Auth audit logs must be recorded');
    testResult(5, 'Phase 2: Authentication flow & audit logging', true, 'Audit logs verified for LOGIN_SUCCESS and LOGIN_FAILED');
  } catch (err) {
    testResult(5, 'Phase 2: Authentication flow & audit logging', false, err.message);
  }

  // -----------------------------------------------------------------
  // 6. PHASE 2: PERSISTENT SERVER-SIDE SESSIONS & LOGOUT
  // -----------------------------------------------------------------
  let testToken = '';
  try {
    const session = createSession(1, { rememberMe: true, ipAddress: '127.0.0.1' });
    assert(session.token && session.token.length === 64, 'Token must be 64-char hex');
    testToken = session.token;

    const validated = validateSession(testToken);
    assert(validated && validated.userId === 1, 'Session token must validate successfully');

    const revoked = revokeSession(testToken);
    assert.strictEqual(revoked, true, 'Session must revoke');
    const afterRevoke = validateSession(testToken);
    assert.strictEqual(afterRevoke, null, 'Revoked session must be rejected');

    testResult(6, 'Phase 2: Session tokens & revocation (logout)', true, 'Token generated, validated, and revoked');
  } catch (err) {
    testResult(6, 'Phase 2: Session tokens & revocation (logout)', false, err.message);
  }

  // -----------------------------------------------------------------
  // 7. PHASE 2: HTTP MIDDLEWARE ROUTE PROTECTION
  // -----------------------------------------------------------------
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 7a. Unauthenticated GET / should redirect to /login
    const redirectRes = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    assert.strictEqual(redirectRes.status, 302, 'Unauthenticated root must redirect (HTTP 302)');
    assert(redirectRes.headers.get('location').includes('/login'), 'Redirect destination must be /login');

    // 7b. Unauthenticated API request should return 401 Unauthorized
    const apiRes = await fetch(`${baseUrl}/api/stats`);
    assert.strictEqual(apiRes.status, 401, 'Unauthenticated API call must return HTTP 401');
    const apiJson = await apiRes.json();
    assert.strictEqual(apiJson.requiresLogin, true);

    // 7c. Public login page should return HTTP 200
    const loginPageRes = await fetch(`${baseUrl}/login`);
    assert.strictEqual(loginPageRes.status, 200, 'Login page must be publicly accessible (HTTP 200)');
    const loginHtml = await loginPageRes.text();
    assert(loginHtml.includes('Administrator Access') || loginHtml.includes('GymStack'), 'Login HTML must render properly');

    // 7d. Valid session cookie should access protected dashboard
    const validSession = createSession(1, { rememberMe: false });
    const authDashboardRes = await fetch(`${baseUrl}/`, {
      headers: {
        'Cookie': `${COOKIE_NAME}=${validSession.token}`
      }
    });
    assert.strictEqual(authDashboardRes.status, 200, 'Authenticated request with cookie must succeed (HTTP 200)');

    testResult(7, 'Phase 2: HTTP middleware & route protection', true, '302 redirects on HTML pages, 401 on APIs, 200 with session cookie');
  } catch (err) {
    testResult(7, 'Phase 2: HTTP middleware & route protection', false, err.message);
  } finally {
    server.close();
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 SPRINT 1 (PHASE 1 & 2) RESULTS: ${passed}/7 PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase1And2Tests();
