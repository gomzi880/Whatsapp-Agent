/**
 * CLI Administrator Setup Tool
 * Creates or resets the administrator account without exposing passwords in source code.
 * Usage:
 *   node scripts/setup-admin.js --username admin --email sales@gymstack.in --password yourSecurePassword
 */
import { createAdminUser } from '../src/auth/authService.js';
import dotenv from 'dotenv';
dotenv.config();

async function runSetup() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) options.username = args[++i];
    if (args[i] === '--email' && args[i + 1]) options.email = args[++i];
    if (args[i] === '--password' && args[i + 1]) options.password = args[++i];
    if (args[i] === '--role' && args[i + 1]) options.role = args[++i];
  }

  const username = options.username || process.env.ADMIN_USERNAME || 'admin';
  const email = options.email || process.env.ADMIN_EMAIL || 'sales@gymstack.in';
  const password = options.password || process.env.ADMIN_PASSWORD || 'GymStack@2026';

  console.log('======================================================');
  console.log('🛡️  GymStack Admin Account Initialization');
  console.log('======================================================');
  console.log(`Username: ${username}`);
  console.log(`Email:    ${email}`);
  console.log('Creating cryptographic Scrypt password credentials...');

  try {
    const user = await createAdminUser({
      username,
      email,
      password,
      role: options.role || 'admin'
    });

    console.log('\n✅ Admin account ready!');
    console.log(`User ID:   #${user.id}`);
    console.log(`Role:      ${user.role}`);
    console.log(`Created:   ${user.createdAt}`);
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Admin setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
