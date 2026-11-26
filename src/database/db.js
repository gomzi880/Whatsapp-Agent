import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { INITIAL_SETTINGS, INITIAL_KNOWLEDGE_ITEMS } from '../knowledge/seedData.js';

const DB_PATH = path.resolve('./gymstack.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gymName TEXT NOT NULL,
    normalizedName TEXT NOT NULL,
    ownerName TEXT,
    founderName TEXT,
    managerName TEXT,
    businessEmail TEXT,
    normalizedEmail TEXT,
    whatsappNumber TEXT,
    businessPhone TEXT,
    normalizedPhone TEXT,
    hasWhatsApp INTEGER DEFAULT 0,
    website TEXT,
    domain TEXT,
    fullAddress TEXT,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL,
    instagramUrl TEXT,
    facebookUrl TEXT,
    linkedinUrl TEXT,
    gymCategory TEXT DEFAULT 'Fitness Centre',
    branchesCount INTEGER DEFAULT 1,
    sourceUrl TEXT,
    sourceName TEXT DEFAULT 'Public Directory',
    researchDate TEXT NOT NULL,
    confidenceLevel TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'New',
    leadScore INTEGER DEFAULT 50,
    notes TEXT,
    jobId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_normalizedName_city ON leads(normalizedName, city, country);
  CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
  CREATE INDEX IF NOT EXISTS idx_leads_normalizedPhone ON leads(normalizedPhone);
  CREATE INDEX IF NOT EXISTS idx_leads_normalizedEmail ON leads(normalizedEmail);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_country_city ON leads(country, city);

  CREATE TABLE IF NOT EXISTS research_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobName TEXT,
    targetCountry TEXT,
    targetState TEXT,
    targetCity TEXT,
    targetCategory TEXT,
    searchLimit INTEGER DEFAULT 50,
    status TEXT DEFAULT 'idle',
    discoveredCount INTEGER DEFAULT 0,
    qualifiedCount INTEGER DEFAULT 0,
    currentProgress INTEGER DEFAULT 0,
    errorMessage TEXT,
    startedAt TEXT,
    completedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS research_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    targetCountries TEXT,
    targetCities TEXT,
    targetCategories TEXT,
    dailyLimit INTEGER DEFAULT 50,
    intervalHours INTEGER DEFAULT 24,
    isActive INTEGER DEFAULT 1,
    lastRunAt TEXT,
    nextRunAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sourceType TEXT DEFAULT 'manual',
    sourceDocumentId INTEGER,
    tags TEXT,
    isVerified INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
  CREATE INDEX IF NOT EXISTS idx_knowledge_title ON knowledge_items(title);

  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    originalName TEXT NOT NULL,
    fileName TEXT NOT NULL,
    fileType TEXT NOT NULL,
    fileSize INTEGER,
    category TEXT DEFAULT 'General',
    extractedText TEXT,
    status TEXT DEFAULT 'indexed',
    itemCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS knowledge_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

/**
 * Normalizes text for deduplication
 */
export function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extracts normalized root domain from URL
 */
export function extractDomain(url) {
  if (!url) return null;
  try {
    let clean = url.trim().toLowerCase();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

/**
 * Normalizes phone number to digits only
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 7 ? digits : null;
}

/**
 * Calculates lead quality score (0 - 100)
 */
export function computeLeadScore(lead) {
  let score = 30; // base score for discovery

  if (lead.businessPhone || lead.whatsappNumber) score += 20;
  if (lead.hasWhatsApp) score += 15;
  if (lead.businessEmail) score += 15;
  if (lead.website) score += 10;
  if (lead.ownerName || lead.founderName) score += 10;
  if (lead.instagramUrl || lead.facebookUrl || lead.linkedinUrl) score += 5;
  if (lead.branchesCount > 1) score += 5;

  return Math.min(score, 100);
}

/**
 * Valid Lead Statuses
 */
export const VALID_STATUSES = [
  'New',
  'Researching',
  'Qualified',
  'Not Qualified',
  'Ready for Outreach',
  'Contacted',
  'Responded',
  'Interested',
  'Meeting Requested',
  'Meeting Scheduled',
  'Demo Completed',
  'Follow-up Required',
  'Converted',
  'Not Interested',
  'Unsubscribed',
];

/**
 * Saves or updates a lead, strictly preventing duplicates
 */
export function saveOrUpdateLead(lead) {
  const normalizedName = normalizeString(lead.gymName);
  const domain = extractDomain(lead.website);
  const normalizedPhone = normalizePhone(lead.businessPhone || lead.whatsappNumber);
  const normalizedEmail = lead.businessEmail ? lead.businessEmail.trim().toLowerCase() : null;
  const city = (lead.city || 'Unknown').trim();
  const country = (lead.country || 'India').trim();

  // Deduplication check: Match by domain, phone, or normalized name + city
  let existing = null;
  if (domain) {
    existing = db.prepare('SELECT id, status, leadScore FROM leads WHERE domain = ? LIMIT 1').get(domain);
  }
  if (!existing && normalizedPhone) {
    existing = db.prepare('SELECT id, status, leadScore FROM leads WHERE normalizedPhone = ? LIMIT 1').get(normalizedPhone);
  }
  if (!existing && normalizedEmail) {
    existing = db.prepare('SELECT id, status, leadScore FROM leads WHERE normalizedEmail = ? LIMIT 1').get(normalizedEmail);
  }
  if (!existing) {
    existing = db
      .prepare('SELECT id, status, leadScore FROM leads WHERE normalizedName = ? AND lower(city) = lower(?) AND lower(country) = lower(?) LIMIT 1')
      .get(normalizedName, city, country);
  }

  const score = computeLeadScore({ ...lead, domain, normalizedPhone, normalizedEmail });
  const status = lead.status && VALID_STATUSES.includes(lead.status) ? lead.status : (score >= 60 ? 'Qualified' : 'New');
  const now = new Date().toISOString();

  if (existing) {
    // Update existing lead without overwriting verified fields
    const updateStmt = db.prepare(`
      UPDATE leads SET
        businessPhone = COALESCE(businessPhone, ?),
        normalizedPhone = COALESCE(normalizedPhone, ?),
        whatsappNumber = COALESCE(whatsappNumber, ?),
        hasWhatsApp = CASE WHEN hasWhatsApp = 1 THEN 1 ELSE ? END,
        businessEmail = COALESCE(businessEmail, ?),
        normalizedEmail = COALESCE(normalizedEmail, ?),
        website = COALESCE(website, ?),
        domain = COALESCE(domain, ?),
        ownerName = COALESCE(ownerName, ?),
        founderName = COALESCE(founderName, ?),
        managerName = COALESCE(managerName, ?),
        instagramUrl = COALESCE(instagramUrl, ?),
        facebookUrl = COALESCE(facebookUrl, ?),
        linkedinUrl = COALESCE(linkedinUrl, ?),
        leadScore = MAX(leadScore, ?),
        confidenceLevel = COALESCE(confidenceLevel, ?),
        updatedAt = ?
      WHERE id = ?
    `);

    updateStmt.run(
      lead.businessPhone || null,
      normalizedPhone,
      lead.whatsappNumber || null,
      lead.hasWhatsApp ? 1 : 0,
      lead.businessEmail || null,
      normalizedEmail,
      lead.website || null,
      domain,
      lead.ownerName || null,
      lead.founderName || null,
      lead.managerName || null,
      lead.instagramUrl || null,
      lead.facebookUrl || null,
      lead.linkedinUrl || null,
      score,
      lead.confidenceLevel || 'Medium',
      now,
      existing.id
    );

    return { id: existing.id, isNew: false, score, status: existing.status };
  } else {
    // Insert brand new lead
    const insertStmt = db.prepare(`
      INSERT INTO leads (
        gymName, normalizedName, ownerName, founderName, managerName,
        businessEmail, normalizedEmail, whatsappNumber, businessPhone, normalizedPhone,
        hasWhatsApp, website, domain, fullAddress, city, state, country,
        instagramUrl, facebookUrl, linkedinUrl, gymCategory, branchesCount,
        sourceUrl, sourceName, researchDate, confidenceLevel, status, leadScore, notes, jobId,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    const result = insertStmt.run(
      lead.gymName.trim(),
      normalizedName,
      lead.ownerName || null,
      lead.founderName || null,
      lead.managerName || null,
      lead.businessEmail || null,
      normalizedEmail,
      lead.whatsappNumber || null,
      lead.businessPhone || null,
      normalizedPhone,
      lead.hasWhatsApp ? 1 : 0,
      lead.website || null,
      domain,
      lead.fullAddress || `${city}, ${country}`,
      city,
      lead.state || '',
      country,
      lead.instagramUrl || null,
      lead.facebookUrl || null,
      lead.linkedinUrl || null,
      lead.gymCategory || 'Fitness Centre',
      lead.branchesCount || 1,
      lead.sourceUrl || null,
      lead.sourceName || 'Public Directory',
      lead.researchDate || now.split('T')[0],
      lead.confidenceLevel || 'Medium',
      status,
      score,
      lead.notes || null,
      lead.jobId || null,
      now,
      now
    );

    return { id: result.lastInsertRowid, isNew: true, score, status };
  }
}

/**
 * Filter and query leads with pagination
 */
export function queryLeads(filters = {}, page = 1, limit = 50) {
  let whereClauses = ['1=1'];
  const params = [];

  if (filters.country) {
    whereClauses.push('lower(country) = lower(?)');
    params.push(filters.country);
  }
  if (filters.state) {
    whereClauses.push('lower(state) LIKE lower(?)');
    params.push(`%${filters.state}%`);
  }
  if (filters.city) {
    whereClauses.push('lower(city) LIKE lower(?)');
    params.push(`%${filters.city}%`);
  }
  if (filters.category) {
    whereClauses.push('lower(gymCategory) LIKE lower(?)');
    params.push(`%${filters.category}%`);
  }
  if (filters.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.hasWhatsApp === 'true' || filters.hasWhatsApp === true) {
    whereClauses.push('hasWhatsApp = 1');
  }
  if (filters.hasEmail === 'true' || filters.hasEmail === true) {
    whereClauses.push("businessEmail IS NOT NULL AND businessEmail != ''");
  }
  if (filters.minScore) {
    whereClauses.push('leadScore >= ?');
    params.push(parseInt(filters.minScore, 10));
  }
  if (filters.search) {
    whereClauses.push('(gymName LIKE ? OR ownerName LIKE ? OR fullAddress LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  const whereSql = whereClauses.join(' AND ');
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM leads WHERE ${whereSql}`).get(...params);
  const total = countRow ? countRow.total : 0;

  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT * FROM leads
    WHERE ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { total, page, limit, totalPages: Math.ceil(total / limit), leads: rows };
}

/**
 * Get Aggregated Metrics for Dashboard
 */
export function getLeadStats() {
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const qualifiedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'Qualified'").get().count;
  const withWhatsApp = db.prepare('SELECT COUNT(*) as count FROM leads WHERE hasWhatsApp = 1').get().count;
  const withEmail = db.prepare("SELECT COUNT(*) as count FROM leads WHERE businessEmail IS NOT NULL AND businessEmail != ''").get().count;
  const countriesCount = db.prepare('SELECT COUNT(DISTINCT country) as count FROM leads').get().count;
  const citiesCount = db.prepare('SELECT COUNT(DISTINCT city) as count FROM leads').get().count;

  const statusBreakdown = db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
  const countryBreakdown = db.prepare('SELECT country, COUNT(*) as count FROM leads GROUP BY country ORDER BY count DESC LIMIT 10').all();

  return {
    totalLeads,
    qualifiedLeads,
    withWhatsApp,
    withEmail,
    countriesCount,
    citiesCount,
    statusBreakdown,
    countryBreakdown
  };
}

/**
 * =========================================================================
 * PRODUCT KNOWLEDGE BASE REPOSITORY & METHODS
 * =========================================================================
 */

/**
 * Automatically seeds the database with verified GymStack knowledge on first startup
 */
export function seedKnowledgeBaseIfEmpty() {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_items').get().count;
  if (existingCount === 0) {
    console.log('🌱 Seeding GymStack Product Knowledge Base into SQLite...');

    // Seed Settings
    const insertSetting = db.prepare('INSERT OR REPLACE INTO knowledge_settings (key, value) VALUES (?, ?)');
    for (const setting of INITIAL_SETTINGS) {
      insertSetting.run(setting.key, setting.value);
    }

    // Seed Knowledge Items
    const insertItem = db.prepare(`
      INSERT INTO knowledge_items (category, title, content, sourceType, tags, isVerified, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertItem.run(
          item.category,
          item.title,
          item.content,
          item.sourceType || 'manual',
          item.tags || '',
          item.isVerified ?? 1,
          item.sortOrder || 0
        );
      }
    });

    insertMany(INITIAL_KNOWLEDGE_ITEMS);
    console.log(`✅ Successfully seeded ${INITIAL_KNOWLEDGE_ITEMS.length} product knowledge items across all 14 categories.`);
  }
}

/**
 * Fetch knowledge items with optional category and search filters
 */
export function getKnowledgeItems({ category, search, verifiedOnly = false, limit = 100, offset = 0 } = {}) {
  let whereClauses = [];
  let params = [];

  if (category && category !== 'All') {
    whereClauses.push('category = ?');
    params.push(category);
  }

  if (verifiedOnly) {
    whereClauses.push('isVerified = 1');
  }

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)');
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as count FROM knowledge_items ${whereSql}`).get(...params).count;

  const rows = db.prepare(`
    SELECT * FROM knowledge_items
    ${whereSql}
    ORDER BY sortOrder ASC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { total, items: rows };
}

/**
 * Get a single knowledge item by ID
 */
export function getKnowledgeItemById(id) {
  return db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
}

/**
 * Create a new knowledge item
 */
export function createKnowledgeItem({ category, title, content, sourceType = 'manual', tags = '', isVerified = 1, sortOrder = 0, sourceDocumentId = null }) {
  const info = db.prepare(`
    INSERT INTO knowledge_items (category, title, content, sourceType, tags, isVerified, sortOrder, sourceDocumentId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(category, title, content, sourceType, tags, isVerified, sortOrder, sourceDocumentId);

  return db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Update an existing knowledge item
 */
export function updateKnowledgeItem(id, { category, title, content, sourceType, tags, isVerified, sortOrder }) {
  const existing = getKnowledgeItemById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE knowledge_items
    SET category = ?,
        title = ?,
        content = ?,
        sourceType = ?,
        tags = ?,
        isVerified = ?,
        sortOrder = ?,
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(
    category ?? existing.category,
    title ?? existing.title,
    content ?? existing.content,
    sourceType ?? existing.sourceType,
    tags ?? existing.tags,
    isVerified ?? existing.isVerified,
    sortOrder ?? existing.sortOrder,
    id
  );

  return getKnowledgeItemById(id);
}

/**
 * Delete a knowledge item
 */
export function deleteKnowledgeItem(id) {
  const res = db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(id);
  return res.changes > 0;
}

/**
 * Fetch all knowledge settings as a key-value object
 */
export function getKnowledgeSettings() {
  const rows = db.prepare('SELECT * FROM knowledge_settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

/**
 * Update a knowledge setting key
 */
export function updateKnowledgeSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO knowledge_settings (key, value) VALUES (?, ?)').run(key, String(value));
  return true;
}

/**
 * Save an uploaded knowledge document
 */
export function saveKnowledgeDocument({ originalName, fileName, fileType, fileSize, category = 'General', extractedText = '', status = 'indexed', itemCount = 0 }) {
  const info = db.prepare(`
    INSERT INTO knowledge_documents (originalName, fileName, fileType, fileSize, category, extractedText, status, itemCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(originalName, fileName, fileType, fileSize, category, extractedText, status, itemCount);

  return db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Get all uploaded knowledge documents
 */
export function getKnowledgeDocuments() {
  return db.prepare('SELECT * FROM knowledge_documents ORDER BY id DESC').all();
}

/**
 * Aggregate knowledge base metrics
 */
export function getKnowledgeStats() {
  const totalItems = db.prepare('SELECT COUNT(*) as count FROM knowledge_items').get().count;
  const verifiedItems = db.prepare('SELECT COUNT(*) as count FROM knowledge_items WHERE isVerified = 1').get().count;
  const documentsCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get().count;
  const categoriesCount = db.prepare('SELECT COUNT(DISTINCT category) as count FROM knowledge_items').get().count;
  const outreachSetting = db.prepare("SELECT value FROM knowledge_settings WHERE key = 'outreach_approved'").get();
  const outreachApproved = outreachSetting ? outreachSetting.value === '1' : false;

  const categoryBreakdown = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM knowledge_items 
    GROUP BY category 
    ORDER BY count DESC
  `).all();

  return {
    totalItems,
    verifiedItems,
    documentsCount,
    categoriesCount,
    outreachApproved,
    categoryBreakdown
  };
}

// Automatically seed on initialization if empty
seedKnowledgeBaseIfEmpty();

export default db;
