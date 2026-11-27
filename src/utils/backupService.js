/**
 * Automated Database Backup Service
 * Performs safe, non-blocking snapshots of gymstack.db before migrations or deployments.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve('./gymstack.db');
const BACKUP_DIR = path.resolve('./backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Creates a timestamped backup of the SQLite database
 * @param {string} label Descriptive tag for the backup (e.g. 'pre_migration_phase2')
 * @returns {Promise<string>} Path to created backup file
 */
export async function createDatabaseBackup(label = 'snapshot') {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database file not found at ${DB_PATH}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `gymstack_${label}_${timestamp}.db`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  const db = new Database(DB_PATH);
  try {
    // Utilize better-sqlite3 native safe backup API (works cleanly with WAL mode)
    await db.backup(backupFilePath);
    console.log(`🛡️ [Backup Service] Safe database snapshot created: ${backupFileName}`);
    return backupFilePath;
  } finally {
    db.close();
  }
}

/**
 * Lists available database backup snapshots
 * @returns {Array<object>} Backup files metadata
 */
export function listDatabaseBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
  return files.map(filename => {
    const filePath = path.join(BACKUP_DIR, filename);
    const stats = fs.statSync(filePath);
    return {
      filename,
      sizeBytes: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
      createdAt: stats.birthtime.toISOString()
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
