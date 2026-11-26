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

  CREATE TABLE IF NOT EXISTS outreach_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    targetCountry TEXT,
    targetCity TEXT,
    targetCategory TEXT,
    minLeadScore INTEGER DEFAULT 50,
    dailyLimit INTEGER DEFAULT 20,
    status TEXT DEFAULT 'pending_approval',
    customIntroTemplate TEXT,
    totalEligible INTEGER DEFAULT 0,
    sentCount INTEGER DEFAULT 0,
    deliveredCount INTEGER DEFAULT 0,
    respondedCount INTEGER DEFAULT 0,
    interestedCount INTEGER DEFAULT 0,
    optOutCount INTEGER DEFAULT 0,
    failedCount INTEGER DEFAULT 0,
    errorMessage TEXT,
    startedAt TEXT,
    completedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lead_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER,
    campaignId INTEGER,
    remoteJid TEXT NOT NULL,
    senderRole TEXT NOT NULL,
    messageText TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    intent TEXT,
    errorMessage TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_jid ON lead_messages(remoteJid);
  CREATE INDEX IF NOT EXISTS idx_messages_leadId ON lead_messages(leadId);
  CREATE INDEX IF NOT EXISTS idx_messages_campaignId ON lead_messages(campaignId);
  CREATE INDEX IF NOT EXISTS idx_messages_role ON lead_messages(senderRole);

  CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fromEmail TEXT DEFAULT 'sales@gymstack.in',
    targetCountry TEXT,
    targetCity TEXT,
    targetCategory TEXT,
    minLeadScore INTEGER DEFAULT 50,
    dailyLimit INTEGER DEFAULT 20,
    status TEXT DEFAULT 'pending_approval',
    subject TEXT,
    templateType TEXT DEFAULT 'introductory',
    customMessage TEXT,
    totalEligible INTEGER DEFAULT 0,
    sentCount INTEGER DEFAULT 0,
    deliveredCount INTEGER DEFAULT 0,
    openedCount INTEGER DEFAULT 0,
    repliedCount INTEGER DEFAULT 0,
    interestedCount INTEGER DEFAULT 0,
    optOutCount INTEGER DEFAULT 0,
    failedCount INTEGER DEFAULT 0,
    errorMessage TEXT,
    startedAt TEXT,
    completedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lead_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER,
    campaignId INTEGER,
    fromEmail TEXT NOT NULL,
    toEmail TEXT NOT NULL,
    subject TEXT NOT NULL,
    bodyHtml TEXT NOT NULL,
    bodyText TEXT,
    direction TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    intent TEXT,
    messageId TEXT,
    inReplyTo TEXT,
    referencesHeader TEXT,
    hasAttachment INTEGER DEFAULT 0,
    attachmentName TEXT,
    errorMessage TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY(campaignId) REFERENCES email_campaigns(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_lead_emails_leadId ON lead_emails(leadId);
  CREATE INDEX IF NOT EXISTS idx_lead_emails_toEmail ON lead_emails(toEmail);
  CREATE INDEX IF NOT EXISTS idx_lead_emails_msgId ON lead_emails(messageId);
  CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER,
    gymName TEXT NOT NULL,
    ownerName TEXT NOT NULL,
    email TEXT,
    whatsappNumber TEXT,
    meetingDate TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT,
    timeZone TEXT DEFAULT 'Asia/Kolkata (IST)',
    meetingLink TEXT,
    googleCalendarEventId TEXT,
    googleCalendarUrl TEXT,
    status TEXT DEFAULT 'Requested',
    meetingNotes TEXT,
    channel TEXT DEFAULT 'whatsapp',
    confirmedAt TEXT,
    reminderSent24h INTEGER DEFAULT 0,
    reminderSent1h INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_meetings_leadId ON meetings(leadId);
  CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meetingDate);
  CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
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
 * Retrieves a single lead by primary key ID
 */
export function getLeadById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) || null;
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

/**
 * =========================================================================
 * OUTREACH CAMPAIGNS & WHATSAPP CONVERSATION REPOSITORY
 * =========================================================================
 */

/**
 * Find a lead in database by phone or WhatsApp JID
 */
export function findLeadByPhoneOrJid(phoneOrJid) {
  if (!phoneOrJid) return null;
  const digits = phoneOrJid.replace(/[^0-9]/g, '');
  if (!digits || digits.length < 7) return null;

  // 1. Direct match on normalized phone
  let lead = db.prepare('SELECT * FROM leads WHERE normalizedPhone = ?').get(digits);
  if (lead) return lead;

  // 2. Suffix match (last 10 digits for India/international matching)
  const last10 = digits.slice(-10);
  lead = db.prepare('SELECT * FROM leads WHERE normalizedPhone LIKE ? OR whatsappNumber LIKE ?').get(`%${last10}`, `%${last10}`);
  return lead || null;
}

/**
 * Update lead status directly
 */
export function updateLeadStatus(leadId, status, notes = null) {
  if (!VALID_STATUSES.includes(status)) {
    console.warn(`[Lead Status Warning]: Invalid status "${status}". Setting anyway.`);
  }

  const existing = db.prepare('SELECT notes FROM leads WHERE id = ?').get(leadId);
  const combinedNotes = notes 
    ? (existing && existing.notes ? `${existing.notes} | ${notes}` : notes)
    : (existing ? existing.notes : null);

  db.prepare(`
    UPDATE leads 
    SET status = ?, 
        notes = ?,
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(status, combinedNotes, leadId);

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

/**
 * Record a message sent or received
 */
export function recordLeadMessage({ leadId = null, campaignId = null, remoteJid, senderRole, messageText, status = 'sent', intent = null, errorMessage = null }) {
  const info = db.prepare(`
    INSERT INTO lead_messages (leadId, campaignId, remoteJid, senderRole, messageText, status, intent, errorMessage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(leadId, campaignId, remoteJid, senderRole, messageText, status, intent, errorMessage);

  return db.prepare('SELECT * FROM lead_messages WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Fetch messages with filters and pagination
 */
export function getLeadMessages({ leadId, campaignId, remoteJid, role, intent, limit = 50, offset = 0 } = {}) {
  let whereClauses = [];
  let params = [];

  if (leadId) {
    whereClauses.push('leadId = ?');
    params.push(leadId);
  }
  if (campaignId) {
    whereClauses.push('campaignId = ?');
    params.push(campaignId);
  }
  if (remoteJid) {
    whereClauses.push('remoteJid = ?');
    params.push(remoteJid);
  }
  if (role) {
    whereClauses.push('senderRole = ?');
    params.push(role);
  }
  if (intent) {
    whereClauses.push('intent = ?');
    params.push(intent);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as count FROM lead_messages ${whereSql}`).get(...params).count;

  const rows = db.prepare(`
    SELECT m.*, l.gymName, l.city, l.country
    FROM lead_messages m
    LEFT JOIN leads l ON m.leadId = l.id
    ${whereSql}
    ORDER BY m.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { total, messages: rows };
}

/**
 * Create a new outreach campaign
 */
export function createOutreachCampaign({ name, targetCountry = '', targetCity = '', targetCategory = '', minLeadScore = 50, dailyLimit = 20, customIntroTemplate = null }) {
  // Count eligible leads matching filters
  const eligibleLeads = getEligibleLeadsForOutreach({ country: targetCountry, city: targetCity, category: targetCategory, minScore: minLeadScore, limit: 1000 });

  const info = db.prepare(`
    INSERT INTO outreach_campaigns (
      name, targetCountry, targetCity, targetCategory, minLeadScore, dailyLimit, 
      status, customIntroTemplate, totalEligible
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?)
  `).run(
    name || `Campaign: ${targetCategory || 'Gyms'} in ${targetCity || targetCountry || 'Global'}`,
    targetCountry || 'All',
    targetCity || 'All',
    targetCategory || 'All',
    minLeadScore,
    dailyLimit,
    customIntroTemplate,
    eligibleLeads.length
  );

  return db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Update outreach campaign
 */
export function updateOutreachCampaign(id, updateData) {
  const existing = getOutreachCampaignById(id);
  if (!existing) return null;

  const fields = ['name', 'status', 'sentCount', 'deliveredCount', 'respondedCount', 'interestedCount', 'optOutCount', 'failedCount', 'errorMessage', 'startedAt', 'completedAt'];
  const setClauses = [];
  const params = [];

  for (const f of fields) {
    if (updateData[f] !== undefined) {
      setClauses.push(`${f} = ?`);
      params.push(updateData[f]);
    }
  }

  if (setClauses.length === 0) return existing;

  params.push(id);
  db.prepare(`UPDATE outreach_campaigns SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  return getOutreachCampaignById(id);
}

/**
 * Get all outreach campaigns
 */
export function getOutreachCampaigns(limit = 50) {
  return db.prepare('SELECT * FROM outreach_campaigns ORDER BY id DESC LIMIT ?').all(limit);
}

/**
 * Get single outreach campaign
 */
export function getOutreachCampaignById(id) {
  return db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id);
}

/**
 * Query eligible leads for outreach
 */
export function getEligibleLeadsForOutreach({ country = '', city = '', category = '', minScore = 30, limit = 50 } = {}) {
  let whereClauses = [
    "(hasWhatsApp = 1 OR normalizedPhone IS NOT NULL)",
    "normalizedPhone IS NOT NULL AND normalizedPhone != ''",
    "status NOT IN ('Unsubscribed', 'Not Interested', 'Converted')",
    'leadScore >= ?'
  ];
  let params = [minScore];

  if (country && country !== 'All') {
    whereClauses.push('country = ?');
    params.push(country);
  }
  if (city && city !== 'All') {
    whereClauses.push('city = ?');
    params.push(city);
  }
  if (category && category !== 'All') {
    whereClauses.push('gymCategory = ?');
    params.push(category);
  }

  // Exclude leads contacted in the last 7 days
  whereClauses.push(`
    id NOT IN (
      SELECT DISTINCT leadId FROM lead_messages 
      WHERE senderRole = 'agent' 
        AND createdAt >= datetime('now', '-7 days')
        AND leadId IS NOT NULL
    )
  `);

  const rows = db.prepare(`
    SELECT * FROM leads
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY leadScore DESC, id DESC
    LIMIT ?
  `).all(...params, limit);

  return rows;
}

/**
 * Aggregated metrics for outreach dashboard
 */
export function getOutreachStats() {
  const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM outreach_campaigns').get().count;
  const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM outreach_campaigns WHERE status = 'running'").get().count;
  const totalSent = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'agent'").get().count;
  const totalReplies = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'prospect'").get().count;
  const interestedCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Interested', 'Meeting Requested', 'Meeting Scheduled', 'Converted')").get().count;
  const optOutCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Unsubscribed', 'Not Interested')").get().count;
  const failedCount = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE status = 'failed'").get().count;

  const responseRate = totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0;

  return {
    totalCampaigns,
    activeCampaigns,
    totalSent,
    totalReplies,
    responseRate,
    interestedCount,
    optOutCount,
    failedCount
  };
}

/**
 * ============================================================================
 * EMAIL SALES AGENT DATABASE HELPERS
 * ============================================================================
 */

export function createEmailCampaign(data) {
  const stmt = db.prepare(`
    INSERT INTO email_campaigns (
      name, fromEmail, targetCountry, targetCity, targetCategory,
      minLeadScore, dailyLimit, status, subject, templateType, customMessage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.name,
    data.fromEmail || 'sales@gymstack.in',
    data.targetCountry || null,
    data.targetCity || null,
    data.targetCategory || null,
    data.minLeadScore !== undefined ? data.minLeadScore : 50,
    data.dailyLimit !== undefined ? data.dailyLimit : 20,
    data.status || 'pending_approval',
    data.subject || null,
    data.templateType || 'introductory',
    data.customMessage || null
  );

  return { id: info.lastInsertRowid, ...data };
}

export function updateEmailCampaign(id, data) {
  const fields = [];
  const params = [];

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const stmt = db.prepare(`UPDATE email_campaigns SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...params);
  return result.changes > 0;
}

export function getEmailCampaignById(id) {
  return db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(id);
}

export function getEmailCampaigns(limit = 50, offset = 0) {
  return db.prepare(`
    SELECT * FROM email_campaigns 
    ORDER BY id DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function recordLeadEmail(data) {
  const stmt = db.prepare(`
    INSERT INTO lead_emails (
      leadId, campaignId, fromEmail, toEmail, subject,
      bodyHtml, bodyText, direction, status, intent,
      messageId, inReplyTo, referencesHeader, hasAttachment,
      attachmentName, errorMessage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.leadId || null,
    data.campaignId || null,
    data.fromEmail,
    data.toEmail,
    data.subject,
    data.bodyHtml,
    data.bodyText || null,
    data.direction || 'outbound',
    data.status || 'sent',
    data.intent || null,
    data.messageId || null,
    data.inReplyTo || null,
    data.referencesHeader || null,
    data.hasAttachment ? 1 : 0,
    data.attachmentName || null,
    data.errorMessage || null
  );

  return { id: info.lastInsertRowid, ...data };
}

export function updateLeadEmail(id, data) {
  const fields = [];
  const params = [];

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const stmt = db.prepare(`UPDATE lead_emails SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...params);
  return result.changes > 0;
}

export function getLeadEmails(leadId, limit = 50) {
  return db.prepare(`
    SELECT * FROM lead_emails 
    WHERE leadId = ? 
    ORDER BY createdAt ASC 
    LIMIT ?
  `).all(leadId, limit);
}

export function getAllEmails(filters = {}, limit = 50, offset = 0) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'All') {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.direction && filters.direction !== 'All') {
    whereClauses.push('direction = ?');
    params.push(filters.direction);
  }

  if (filters.leadId) {
    whereClauses.push('leadId = ?');
    params.push(filters.leadId);
  }

  if (filters.search) {
    whereClauses.push('(toEmail LIKE ? OR fromEmail LIKE ? OR subject LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const emails = db.prepare(`
    SELECT le.*, l.gymName, l.ownerName, l.city, l.country
    FROM lead_emails le
    LEFT JOIN leads l ON le.leadId = l.id
    ${whereSql}
    ORDER BY le.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count 
    FROM lead_emails le
    ${whereSql}
  `).get(...params).count;

  return { emails, total };
}

export function getEligibleLeadsForEmailOutreach({
  country,
  city,
  category,
  minScore = 50,
  limit = 20
}) {
  const whereClauses = [
    `status IN ('Qualified', 'Ready for Outreach', 'New')`,
    `status NOT IN ('Unsubscribed', 'Not Qualified', 'Not Interested', 'Converted')`,
    `businessEmail IS NOT NULL AND TRIM(businessEmail) != ''`,
    `leadScore >= ?`
  ];
  const params = [minScore];

  if (country && country !== 'All') {
    whereClauses.push('country = ?');
    params.push(country);
  }
  if (city && city !== 'All') {
    whereClauses.push('city = ?');
    params.push(city);
  }
  if (category && category !== 'All') {
    whereClauses.push('gymCategory = ?');
    params.push(category);
  }

  // Deduplication & Anti-Spam: Exclude leads emailed in the last 7 days
  whereClauses.push(`
    id NOT IN (
      SELECT DISTINCT leadId FROM lead_emails 
      WHERE direction = 'outbound' 
        AND status IN ('sent', 'delivered', 'replied')
        AND createdAt >= datetime('now', '-7 days')
        AND leadId IS NOT NULL
    )
  `);

  const rows = db.prepare(`
    SELECT * FROM leads
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY leadScore DESC, id DESC
    LIMIT ?
  `).all(...params, limit);

  return rows;
}

export function getEmailStats() {
  const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM email_campaigns').get().count;
  const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM email_campaigns WHERE status = 'running'").get().count;
  const totalSent = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'outbound' AND status IN ('sent', 'delivered')").get().count;
  const totalReceived = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'inbound'").get().count;
  const totalReplied = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE status = 'replied'").get().count;
  const totalFailed = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE status = 'failed'").get().count;
  const totalPending = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE status = 'pending'").get().count;
  const totalOptOuts = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'Unsubscribed'").get().count;
  const interestedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Interested', 'Meeting Requested', 'Meeting Scheduled')").get().count;

  const replyRate = totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0;

  return {
    totalCampaigns,
    activeCampaigns,
    totalSent,
    totalReceived,
    totalReplied,
    totalFailed,
    totalPending,
    totalOptOuts,
    interestedLeads,
    replyRate
  };
}

/**
 * ============================================================================
 * AUTOMATIC MEETING SCHEDULING AGENT DATABASE HELPERS
 * ============================================================================
 */

export const VALID_MEETING_STATUSES = [
  'Requested',
  'Waiting for Confirmation',
  'Scheduled',
  'Rescheduled',
  'Completed',
  'Cancelled',
  'No Show'
];

export function createMeeting(data) {
  const stmt = db.prepare(`
    INSERT INTO meetings (
      leadId, gymName, ownerName, email, whatsappNumber,
      meetingDate, startTime, endTime, timeZone,
      meetingLink, googleCalendarEventId, googleCalendarUrl,
      status, meetingNotes, channel, confirmedAt,
      reminderSent24h, reminderSent1h
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.leadId || null,
    data.gymName || 'Fitness Facility',
    data.ownerName || 'Gym Owner',
    data.email || null,
    data.whatsappNumber || null,
    data.meetingDate,
    data.startTime,
    data.endTime || null,
    data.timeZone || 'Asia/Kolkata (IST)',
    data.meetingLink || null,
    data.googleCalendarEventId || null,
    data.googleCalendarUrl || null,
    data.status || 'Requested',
    data.meetingNotes || null,
    data.channel || 'whatsapp',
    data.confirmedAt || null,
    data.reminderSent24h ? 1 : 0,
    data.reminderSent1h ? 1 : 0
  );

  return { id: info.lastInsertRowid, ...data };
}

export function updateMeeting(id, data) {
  const fields = ["updatedAt = datetime('now')"];
  const params = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'updatedAt' || key === 'id') continue;
    fields.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.length === 1) return false;

  params.push(id);
  const stmt = db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...params);
  return result.changes > 0;
}

export function getMeetingById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) || null;
}

export function getMeetings(filters = {}, limit = 50, offset = 0) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'All') {
    whereClauses.push('m.status = ?');
    params.push(filters.status);
  }

  if (filters.leadId) {
    whereClauses.push('m.leadId = ?');
    params.push(filters.leadId);
  }

  if (filters.date) {
    whereClauses.push('m.meetingDate = ?');
    params.push(filters.date);
  }

  if (filters.search) {
    whereClauses.push('(m.gymName LIKE ? OR m.ownerName LIKE ? OR m.email LIKE ? OR m.whatsappNumber LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const meetings = db.prepare(`
    SELECT m.*, l.city, l.country
    FROM meetings m
    LEFT JOIN leads l ON m.leadId = l.id
    ${whereSql}
    ORDER BY m.meetingDate DESC, m.startTime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM meetings m
    ${whereSql}
  `).get(...params).count;

  return { meetings, total };
}

export function getUpcomingMeetings(limit = 10) {
  return db.prepare(`
    SELECT m.*, l.city, l.country
    FROM meetings m
    LEFT JOIN leads l ON m.leadId = l.id
    WHERE m.status IN ('Scheduled', 'Rescheduled', 'Waiting for Confirmation')
      AND m.meetingDate >= date('now')
    ORDER BY m.meetingDate ASC, m.startTime ASC
    LIMIT ?
  `).all(limit);
}

export function getLeadMeetings(leadId) {
  if (!leadId) return [];
  return db.prepare(`
    SELECT * FROM meetings
    WHERE leadId = ?
    ORDER BY id DESC
  `).all(leadId);
}

export function checkSlotAvailability(meetingDate, startTime) {
  // Check if any active meeting is already booked at this exact date & time
  const existing = db.prepare(`
    SELECT * FROM meetings
    WHERE meetingDate = ?
      AND startTime = ?
      AND status IN ('Scheduled', 'Rescheduled', 'Waiting for Confirmation')
    LIMIT 1
  `).get(meetingDate, startTime);

  return !existing;
}

export function getCalendarStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM meetings').get().count;
  const scheduled = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Scheduled'").get().count;
  const waiting = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Waiting for Confirmation'").get().count;
  const requested = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Requested'").get().count;
  const completed = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Completed'").get().count;
  const cancelled = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Cancelled'").get().count;
  const noShow = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'No Show'").get().count;

  const todayMeetings = db.prepare(`
    SELECT COUNT(*) as count FROM meetings
    WHERE meetingDate = date('now')
      AND status IN ('Scheduled', 'Rescheduled')
  `).get().count;

  return {
    total,
    scheduled,
    waiting,
    requested,
    completed,
    cancelled,
    noShow,
    todayMeetings
  };
}

// Automatically seed on initialization if empty
seedKnowledgeBaseIfEmpty();

export default db;
