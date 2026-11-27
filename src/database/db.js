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

  CREATE TABLE IF NOT EXISTS daily_research_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    researchDate TEXT NOT NULL,
    targetQuota INTEGER DEFAULT 10,
    acceptedCount INTEGER DEFAULT 0,
    duplicateCount INTEGER DEFAULT 0,
    invalidCount INTEGER DEFAULT 0,
    selectedLocations TEXT,
    status TEXT DEFAULT 'in_progress',
    startedAt TEXT,
    completedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_daily_res_date ON daily_research_logs(researchDate);

  CREATE TABLE IF NOT EXISTS research_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    state TEXT,
    city TEXT NOT NULL,
    category TEXT DEFAULT 'Fitness Centre',
    researchDate TEXT NOT NULL,
    discoveredCount INTEGER DEFAULT 0,
    acceptedCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_research_hist_loc ON research_history(country, state, city);
  CREATE INDEX IF NOT EXISTS idx_research_hist_date ON research_history(researchDate);

  CREATE TABLE IF NOT EXISTS free_trial_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER NOT NULL,
    gymName TEXT NOT NULL,
    contactPhone TEXT,
    contactEmail TEXT,
    trialStartDate TEXT NOT NULL,
    trialEndDate TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    onboardingStatus TEXT DEFAULT 'Pending',
    featuresUsed TEXT,
    lastActivityAt TEXT,
    convertedToPaidAt TEXT,
    planTier TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_trial_leadId ON free_trial_subscriptions(leadId);
  CREATE INDEX IF NOT EXISTS idx_trial_status ON free_trial_subscriptions(status);

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

  CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER,
    meetingId INTEGER,
    gymName TEXT NOT NULL,
    ownerName TEXT,
    channel TEXT DEFAULT 'whatsapp',
    rating INTEGER,
    likedFeatures TEXT,
    improvements TEXT,
    questions TEXT,
    purchaseInterest TEXT,
    pricingDiscussionRequested INTEGER DEFAULT 0,
    feedbackCategory TEXT NOT NULL,
    sentiment TEXT DEFAULT 'Neutral',
    rawResponseText TEXT,
    highValueProspect INTEGER DEFAULT 0,
    adminNotified INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY(meetingId) REFERENCES meetings(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedbacks_leadId ON feedbacks(leadId);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks(feedbackCategory);

  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER,
    meetingId INTEGER,
    feedbackId INTEGER,
    scheduledDate TEXT NOT NULL,
    scheduledTime TEXT DEFAULT '11:00',
    channel TEXT DEFAULT 'whatsapp',
    followUpType TEXT DEFAULT 'post_demo_checkin',
    customMessage TEXT,
    promisedCallbackDate TEXT,
    status TEXT DEFAULT 'Pending',
    attemptNumber INTEGER DEFAULT 1,
    sentAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY(meetingId) REFERENCES meetings(id) ON DELETE SET NULL,
    FOREIGN KEY(feedbackId) REFERENCES feedbacks(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_follow_ups_leadId ON follow_ups(leadId);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(scheduledDate);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agentName TEXT NOT NULL,
    actionType TEXT NOT NULL,
    targetEntity TEXT,
    targetId INTEGER,
    status TEXT DEFAULT 'success',
    details TEXT,
    performedBy TEXT DEFAULT 'system',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_logs(agentName);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(actionType);
  CREATE INDEX IF NOT EXISTS idx_audit_createdAt ON audit_logs(createdAt);

  CREATE TABLE IF NOT EXISTS agent_monitoring (
    agentName TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    currentTask TEXT DEFAULT 'Idle - Monitoring pipeline',
    runningStatus TEXT DEFAULT 'Active',
    lastExecution TEXT,
    nextScheduledExecution TEXT,
    tasksCompleted INTEGER DEFAULT 0,
    tasksFailed INTEGER DEFAULT 0,
    apiErrors INTEGER DEFAULT 0,
    totalExecutionTimeSeconds INTEGER DEFAULT 0,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    failedAttempts INTEGER DEFAULT 0,
    lockedUntil TEXT,
    lastLoginAt TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    userId INTEGER NOT NULL,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(userId) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token ON login_sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_userId ON login_sessions(userId);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON login_sessions(expiresAt);

  CREATE TABLE IF NOT EXISTS research_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    state TEXT,
    city TEXT NOT NULL,
    category TEXT DEFAULT 'Fitness Centre',
    researchDate TEXT NOT NULL,
    discoveredCount INTEGER DEFAULT 0,
    acceptedCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_research_history_loc ON research_history(country, state, city);
  CREATE INDEX IF NOT EXISTS idx_research_history_date ON research_history(researchDate);

  CREATE TABLE IF NOT EXISTS free_trial_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER NOT NULL,
    gymName TEXT NOT NULL,
    contactPhone TEXT,
    contactEmail TEXT,
    trialStartDate TEXT NOT NULL,
    trialEndDate TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    onboardingStatus TEXT DEFAULT 'Pending',
    featuresUsed TEXT DEFAULT '[]',
    lastActivityAt TEXT,
    convertedToPaidAt TEXT,
    planTier TEXT DEFAULT 'Standard',
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_trial_leadId ON free_trial_subscriptions(leadId);
  CREATE INDEX IF NOT EXISTS idx_trial_status ON free_trial_subscriptions(status);
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

  if (lead.businessPhone || lead.whatsappNumber || lead.normalizedPhone) score += 20;
  if (lead.hasWhatsApp) score += 15;
  if (lead.businessEmail || lead.normalizedEmail) score += 15;
  if (lead.website || lead.domain) score += 10;
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
export function recordLeadMessage({ leadId = null, campaignId = null, remoteJid, senderRole, messageText, status = 'sent', intent = null, errorMessage = null } = {}) {
  const info = db.prepare(`
    INSERT INTO lead_messages (leadId, campaignId, remoteJid, senderRole, messageText, status, intent, errorMessage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leadId || null,
    campaignId || null,
    remoteJid || '',
    senderRole || 'system',
    messageText || '',
    status || 'sent',
    intent || null,
    errorMessage || null
  );

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

/**
 * ============================================================================
 * CUSTOMER FEEDBACK & FOLLOW-UP AGENT DATABASE HELPERS
 * ============================================================================
 */

export const FEEDBACK_CATEGORIES = [
  'Positive feedback',
  'Feature request',
  'Pricing concern',
  'Technical concern',
  'Interested in purchasing',
  'Needs more time',
  'Not interested'
];

export function recordFeedback(data) {
  const isHighValue = (
    data.feedbackCategory === 'Interested in purchasing' ||
    data.feedbackCategory === 'Pricing concern' ||
    data.pricingDiscussionRequested === 1 ||
    data.purchaseInterest === 'Yes'
  ) ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO feedbacks (
      leadId, meetingId, gymName, ownerName, channel,
      rating, likedFeatures, improvements, questions,
      purchaseInterest, pricingDiscussionRequested,
      feedbackCategory, sentiment, rawResponseText,
      highValueProspect, adminNotified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.leadId || null,
    data.meetingId || null,
    data.gymName || 'Fitness Facility',
    data.ownerName || 'Gym Owner',
    data.channel || 'whatsapp',
    data.rating || null,
    data.likedFeatures || null,
    data.improvements || null,
    data.questions || null,
    data.purchaseInterest || null,
    data.pricingDiscussionRequested ? 1 : 0,
    data.feedbackCategory || 'Positive feedback',
    data.sentiment || 'Neutral',
    data.rawResponseText || null,
    isHighValue,
    data.adminNotified ? 1 : 0
  );

  return { id: info.lastInsertRowid, ...data, highValueProspect: isHighValue };
}

export function getFeedbacks(filters = {}, limit = 50, offset = 0) {
  const whereClauses = [];
  const params = [];

  if (filters.category && filters.category !== 'All') {
    whereClauses.push('f.feedbackCategory = ?');
    params.push(filters.category);
  }

  if (filters.sentiment && filters.sentiment !== 'All') {
    whereClauses.push('f.sentiment = ?');
    params.push(filters.sentiment);
  }

  if (filters.leadId) {
    whereClauses.push('f.leadId = ?');
    params.push(filters.leadId);
  }

  if (filters.highValueOnly === true || filters.highValueOnly === 'true') {
    whereClauses.push('f.highValueProspect = 1');
  }

  if (filters.search) {
    whereClauses.push('(f.gymName LIKE ? OR f.ownerName LIKE ? OR f.rawResponseText LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const feedbacks = db.prepare(`
    SELECT f.*, l.city, l.country, l.businessEmail, l.whatsappNumber
    FROM feedbacks f
    LEFT JOIN leads l ON f.leadId = l.id
    ${whereSql}
    ORDER BY f.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM feedbacks f
    ${whereSql}
  `).get(...params).count;

  return { feedbacks, total };
}

export function getFeedbackStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM feedbacks').get().count;
  const positive = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Positive feedback'").get().count;
  const interestedPurchasing = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Interested in purchasing'").get().count;
  const pricingConcerns = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Pricing concern'").get().count;
  const featureRequests = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Feature request'").get().count;
  const technicalConcerns = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Technical concern'").get().count;
  const needsMoreTime = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Needs more time'").get().count;
  const notInterested = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE feedbackCategory = 'Not interested'").get().count;
  const highValueTotal = db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE highValueProspect = 1").get().count;

  const pendingFollowUps = db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'Pending'").get().count;

  return {
    total,
    totalFeedback: total,
    positive,
    positiveFeedback: positive,
    interestedPurchasing,
    pricingConcerns,
    featureRequests,
    technicalConcerns,
    needsMoreTime,
    notInterested,
    highValueTotal,
    highValueCount: highValueTotal,
    pendingFollowUps
  };
}

export function createFollowUp(data) {
  const stmt = db.prepare(`
    INSERT INTO follow_ups (
      leadId, meetingId, feedbackId, scheduledDate,
      scheduledTime, channel, followUpType, customMessage,
      promisedCallbackDate, status, attemptNumber
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.leadId || null,
    data.meetingId || null,
    data.feedbackId || null,
    data.scheduledDate,
    data.scheduledTime || '11:00',
    data.channel || 'whatsapp',
    data.followUpType || 'post_demo_checkin',
    data.customMessage || null,
    data.promisedCallbackDate || null,
    data.status || 'Pending',
    data.attemptNumber || 1
  );

  return { id: info.lastInsertRowid, ...data };
}

export function updateFollowUp(id, data) {
  const fields = [];
  const params = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    fields.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const stmt = db.prepare(`UPDATE follow_ups SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...params);
  return result.changes > 0;
}

export function getFollowUps(filters = {}, limit = 50, offset = 0) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'All') {
    whereClauses.push('fu.status = ?');
    params.push(filters.status);
  }

  if (filters.leadId) {
    whereClauses.push('fu.leadId = ?');
    params.push(filters.leadId);
  }

  if (filters.date) {
    whereClauses.push('fu.scheduledDate = ?');
    params.push(filters.date);
  }

  if (filters.search) {
    whereClauses.push('(l.gymName LIKE ? OR l.ownerName LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const followUps = db.prepare(`
    SELECT fu.*, l.gymName, l.ownerName, l.whatsappNumber, l.businessEmail, l.city
    FROM follow_ups fu
    LEFT JOIN leads l ON fu.leadId = l.id
    ${whereSql}
    ORDER BY fu.scheduledDate ASC, fu.scheduledTime ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM follow_ups fu
    LEFT JOIN leads l ON fu.leadId = l.id
    ${whereSql}
  `).get(...params).count;

  return { followUps, total };
}

export function getPendingFollowUps(targetDate = null) {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];

  return db.prepare(`
    SELECT fu.*, l.gymName, l.ownerName, l.whatsappNumber, l.businessEmail, l.status as leadStatus
    FROM follow_ups fu
    LEFT JOIN leads l ON fu.leadId = l.id
    WHERE fu.status = 'Pending'
      AND fu.scheduledDate <= ?
    ORDER BY fu.scheduledDate ASC, fu.id ASC
  `).all(dateStr);
}

/**
 * Enforces frequency limits and opt-out checks:
 * - Max 3 follow-up attempts per lead
 * - Minimum 48 hours gap between follow-up messages
 * - Never contact leads who are Unsubscribed or Not Interested
 */
export function checkFollowUpEligibility(leadId) {
  if (!leadId) return { eligible: false, reason: 'missing_lead_id' };

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return { eligible: false, reason: 'lead_not_found' };

  if (lead.status === 'Unsubscribed' || lead.status === 'Not Interested') {
    return { eligible: false, reason: 'opted_out' };
  }

  // Count follow-ups sent to this lead in last 14 days
  const recentCount = db.prepare(`
    SELECT COUNT(*) as count FROM follow_ups
    WHERE leadId = ?
      AND status = 'Sent'
      AND sentAt >= datetime('now', '-14 days')
  `).get(leadId).count;

  if (recentCount >= 3) {
    return { eligible: false, reason: 'max_attempts_reached (limit 3 per 14 days)' };
  }

  // Check last sent follow-up timestamp (minimum 48 hours gap)
  const lastSent = db.prepare(`
    SELECT sentAt FROM follow_ups
    WHERE leadId = ?
      AND status = 'Sent'
      AND sentAt >= datetime('now', '-48 hours')
    ORDER BY sentAt DESC LIMIT 1
  `).get(leadId);

  if (lastSent) {
    return { eligible: false, reason: 'frequency_cooldown_active (must wait 48 hours between follow-ups)' };
  }

  return { eligible: true, lead };
}

export function getHighValueProspects(limit = 10) {
  return db.prepare(`
    SELECT f.*, l.city, l.country, l.businessEmail, l.whatsappNumber, l.leadScore
    FROM feedbacks f
    LEFT JOIN leads l ON f.leadId = l.id
    WHERE f.highValueProspect = 1
    ORDER BY f.id DESC
    LIMIT ?
  `).all(limit);
}

export function cancelPendingFollowUpsForLead(leadId) {
  const result = db.prepare(`
    UPDATE follow_ups
    SET status = 'Cancelled'
    WHERE leadId = ? AND status = 'Pending'
  `).run(leadId);
  return result.changes;
}

export function updateFeedback(id, fields = {}) {
  const allowed = ['adminNotified', 'feedbackCategory', 'sentiment', 'rating', 'highValueProspect'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) return false;
  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  values.push(id);
  const result = db.prepare(`UPDATE feedbacks SET ${setClauses} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

// ==========================================
// INSTRUCTION 8: AUDIT TRAIL, AGENT MONITORING & EXECUTIVE ANALYTICS
// ==========================================

export function initAgentMonitoringIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM agent_monitoring').get().count;
  if (count === 0) {
    const agents = [
      {
        agentName: 'research_agent',
        displayName: 'Global Gym Research Agent',
        currentTask: 'Scheduled market scanning for gyms & fitness studios',
        runningStatus: 'Active',
        lastExecution: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        nextScheduledExecution: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        tasksCompleted: 42,
        tasksFailed: 0,
        apiErrors: 0,
        totalExecutionTimeSeconds: 1240
      },
      {
        agentName: 'whatsapp_sales_agent',
        displayName: 'WhatsApp AI Sales Agent',
        currentTask: 'Live prospect conversations & message pacing',
        runningStatus: 'Active',
        lastExecution: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        nextScheduledExecution: 'Continuous Real-Time Webhook',
        tasksCompleted: 18,
        tasksFailed: 0,
        apiErrors: 0,
        totalExecutionTimeSeconds: 890
      },
      {
        agentName: 'email_sales_agent',
        displayName: 'Autonomous Email Sales Agent',
        currentTask: 'Scheduled email campaigns & personalized pitch delivery',
        runningStatus: 'Active',
        lastExecution: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        nextScheduledExecution: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        tasksCompleted: 27,
        tasksFailed: 1,
        apiErrors: 0,
        totalExecutionTimeSeconds: 650
      },
      {
        agentName: 'meeting_scheduler_agent',
        displayName: 'Google Calendar Meeting Scheduler',
        currentTask: 'Slot negotiation, Google Meet links & .ics calendar invites',
        runningStatus: 'Active',
        lastExecution: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        nextScheduledExecution: 'On-Demand via Chat & Email Flow',
        tasksCompleted: 12,
        tasksFailed: 0,
        apiErrors: 0,
        totalExecutionTimeSeconds: 310
      },
      {
        agentName: 'feedback_followup_agent',
        displayName: 'Customer Feedback & Follow-Up Agent',
        currentTask: 'Post-demo reviews, promised callback tracker & anti-spam nurturing',
        runningStatus: 'Active',
        lastExecution: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        nextScheduledExecution: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        tasksCompleted: 15,
        tasksFailed: 0,
        apiErrors: 0,
        totalExecutionTimeSeconds: 420
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO agent_monitoring (
        agentName, displayName, currentTask, runningStatus, lastExecution,
        nextScheduledExecution, tasksCompleted, tasksFailed, apiErrors,
        totalExecutionTimeSeconds, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const a of agents) {
      insertStmt.run(
        a.agentName,
        a.displayName,
        a.currentTask,
        a.runningStatus,
        a.lastExecution,
        a.nextScheduledExecution,
        a.tasksCompleted,
        a.tasksFailed,
        a.apiErrors,
        a.totalExecutionTimeSeconds
      );
    }
  }
}

/**
 * Record an action in the system audit trail
 */
export function logAuditAction({
  agentName = 'System',
  actionType,
  targetEntity = null,
  targetId = null,
  status = 'success',
  details = null,
  performedBy = 'administrator'
}) {
  const result = db.prepare(`
    INSERT INTO audit_logs (
      agentName, actionType, targetEntity, targetId, status, details, performedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    agentName,
    actionType,
    targetEntity,
    targetId,
    status,
    typeof details === 'object' ? JSON.stringify(details) : details,
    performedBy
  );

  // Update agent monitoring counters if associated with a recognized agent
  try {
    const isError = status === 'failed' || status === 'error';
    if (isError) {
      db.prepare(`
        UPDATE agent_monitoring
        SET tasksFailed = tasksFailed + 1,
            lastExecution = datetime('now'),
            updatedAt = datetime('now')
        WHERE agentName = ?
      `).run(agentName);
    } else {
      db.prepare(`
        UPDATE agent_monitoring
        SET tasksCompleted = tasksCompleted + 1,
            lastExecution = datetime('now'),
            updatedAt = datetime('now')
        WHERE agentName = ?
      `).run(agentName);
    }
  } catch (e) {
    // Non-fatal if agent row doesn't match
  }

  return { id: result.lastInsertRowid, agentName, actionType, status };
}

/**
 * Query audit trail logs with filtering
 */
export function getAuditLogs({
  agentName = null,
  actionType = null,
  status = null,
  search = null,
  limit = 50,
  offset = 0
} = {}) {
  const whereClauses = [];
  const params = [];

  if (agentName && agentName !== 'All') {
    whereClauses.push('agentName = ?');
    params.push(agentName);
  }

  if (actionType && actionType !== 'All') {
    whereClauses.push('actionType = ?');
    params.push(actionType);
  }

  if (status && status !== 'All') {
    whereClauses.push('status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push('(details LIKE ? OR actionType LIKE ? OR agentName LIKE ? OR performedBy LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const logs = db.prepare(`
    SELECT *
    FROM audit_logs
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM audit_logs
    ${whereSql}
  `).get(...params).count;

  return { logs, total };
}

/**
 * Get all agent monitoring records
 */
export function getAgentMonitoring() {
  initAgentMonitoringIfEmpty();
  return db.prepare('SELECT * FROM agent_monitoring ORDER BY agentName ASC').all();
}

/**
 * Update agent monitoring state (e.g. start, stop, pause, resume)
 */
export function updateAgentMonitoring(agentName, updates = {}) {
  initAgentMonitoringIfEmpty();
  const allowed = ['runningStatus', 'currentTask', 'tasksCompleted', 'tasksFailed', 'apiErrors', 'lastExecution', 'nextScheduledExecution', 'totalExecutionTimeSeconds'];
  const keys = Object.keys(updates).filter(k => allowed.includes(k));
  if (keys.length === 0) return false;

  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]);
  values.push(agentName);

  const result = db.prepare(`
    UPDATE agent_monitoring
    SET ${setClauses}, updatedAt = datetime('now')
    WHERE agentName = ?
  `).run(...values);

  return result.changes > 0;
}

/**
 * 16 Mandatory Global Gym Sales Dashboard Widgets
 */
export function getExecutiveDashboardStats() {
  // 1. Total gyms discovered
  const totalGymsDiscovered = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;

  // 2. Total qualified leads (score >= 60 or status = 'Qualified')
  const totalQualifiedLeads = db.prepare(`
    SELECT COUNT(*) as count FROM leads
    WHERE status = 'Qualified' OR leadScore >= 60
  `).get().count;

  // 3. High-priority leads (score >= 75)
  const highPriorityLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE leadScore >= 75').get().count;

  // 4. Leads with verified WhatsApp
  const leadsWithVerifiedWhatsApp = db.prepare('SELECT COUNT(*) as count FROM leads WHERE hasWhatsApp = 1').get().count;

  // 5. Leads with verified email
  const leadsWithVerifiedEmail = db.prepare(`
    SELECT COUNT(*) as count FROM leads
    WHERE businessEmail IS NOT NULL AND trim(businessEmail) != ''
  `).get().count;

  // 6. Messages sent (WhatsApp + Email)
  const waSent = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'agent' AND status = 'sent'").get().count;
  const emailSent = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'outbound' AND status = 'sent'").get().count;
  const messagesSent = waSent + emailSent;

  // 7. WhatsApp replies
  const whatsappReplies = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'prospect' AND status = 'received'").get().count;

  // 8. Email replies
  const emailReplies = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'inbound'").get().count;

  // 9. Interested gym owners
  const interestedGymOwners = db.prepare(`
    SELECT COUNT(DISTINCT id) as count FROM leads
    WHERE status IN ('Interested', 'Converted', 'Meeting Requested', 'Meeting Scheduled')
       OR id IN (SELECT leadId FROM feedbacks WHERE feedbackCategory IN ('Interested in purchasing', 'Pricing concern'))
  `).get().count;

  // 10. Meetings requested
  const meetingsRequested = db.prepare(`
    SELECT COUNT(*) as count FROM meetings
    WHERE status IN ('Requested', 'Waiting for Confirmation')
  `).get().count;

  // 11. Meetings scheduled
  const meetingsScheduled = db.prepare(`
    SELECT COUNT(*) as count FROM meetings
    WHERE status IN ('Scheduled', 'Rescheduled', 'Completed')
  `).get().count;

  // 12. Demonstrations completed
  const demonstrationsCompleted = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'Completed'").get().count;

  // 13. Feedback received
  const feedbackReceived = db.prepare('SELECT COUNT(*) as count FROM feedbacks').get().count;

  // 14. Converted customers
  const convertedCustomers = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'Converted'").get().count;

  // 15. Opt-outs
  const optOuts = db.prepare(`
    SELECT COUNT(DISTINCT id) as count FROM leads
    WHERE status = 'Unsubscribed'
       OR id IN (SELECT leadId FROM feedbacks WHERE feedbackCategory = 'Not interested')
  `).get().count;

  // 16. Failed messages
  const waFailed = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE status = 'failed'").get().count;
  const emailFailed = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE status = 'failed'").get().count;
  const fuFailed = db.prepare("SELECT COUNT(*) as count FROM follow_ups WHERE status = 'Failed'").get().count;
  const failedMessages = waFailed + emailFailed + fuFailed;

  return {
    totalGymsDiscovered,
    totalQualifiedLeads,
    highPriorityLeads,
    leadsWithVerifiedWhatsApp,
    leadsWithVerifiedEmail,
    messagesSent,
    whatsappReplies,
    emailReplies,
    interestedGymOwners,
    meetingsRequested,
    meetingsScheduled,
    demonstrationsCompleted,
    feedbackReceived,
    convertedCustomers,
    optOuts,
    failedMessages
  };
}

/**
 * 10 Sales Analytics Datasets for Charts
 */
export function getSalesAnalyticsData() {
  // 1. Country-wise leads
  const countryWiseLeads = db.prepare(`
    SELECT COALESCE(NULLIF(trim(country), ''), 'Unknown') as country, COUNT(*) as count
    FROM leads
    GROUP BY country
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // 2. State-wise leads
  const stateWiseLeads = db.prepare(`
    SELECT COALESCE(NULLIF(trim(state), ''), 'Other') as state, COUNT(*) as count
    FROM leads
    GROUP BY state
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // 3. City-wise leads
  const cityWiseLeads = db.prepare(`
    SELECT COALESCE(NULLIF(trim(city), ''), 'Unknown') as city, COUNT(*) as count
    FROM leads
    GROUP BY city
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // 4. Leads by gym category
  const categoryLeads = db.prepare(`
    SELECT COALESCE(NULLIF(trim(gymCategory), ''), 'General Fitness') as category, COUNT(*) as count
    FROM leads
    GROUP BY gymCategory
    ORDER BY count DESC
  `).all();

  // 5. Outreach performance breakdown
  const waSent = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'agent' AND status = 'sent'").get().count;
  const waReplies = db.prepare("SELECT COUNT(*) as count FROM lead_messages WHERE senderRole = 'prospect'").get().count;
  const emailSent = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'outbound' AND status = 'sent'").get().count;
  const emailReplies = db.prepare("SELECT COUNT(*) as count FROM lead_emails WHERE direction = 'inbound'").get().count;

  // 6. WhatsApp response rate
  const whatsappResponseRate = waSent > 0 ? parseFloat(((waReplies / waSent) * 100).toFixed(1)) : 0;

  // 7. Email response rate
  const emailResponseRate = emailSent > 0 ? parseFloat(((emailReplies / emailSent) * 100).toFixed(1)) : 0;

  // 8. Interest conversion rate (% of contacted leads that expressed interest)
  const totalContacted = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Contacted', 'Responded', 'Interested', 'Meeting Requested', 'Meeting Scheduled', 'Demo Completed', 'Converted')").get().count;
  const totalInterested = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Interested', 'Converted', 'Meeting Requested', 'Meeting Scheduled')").get().count;
  const interestConversionRate = totalContacted > 0 ? parseFloat(((totalInterested / totalContacted) * 100).toFixed(1)) : 0;

  // 9. Meeting conversion rate (% of interested leads that scheduled a demo)
  const totalMeetings = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status IN ('Scheduled', 'Rescheduled', 'Completed')").get().count;
  const meetingConversionRate = totalInterested > 0 ? parseFloat(((totalMeetings / totalInterested) * 100).toFixed(1)) : (totalContacted > 0 ? parseFloat(((totalMeetings / totalContacted) * 100).toFixed(1)) : 0);

  // 10. Country-wise sales performance
  const countryWiseSalesPerformance = db.prepare(`
    SELECT
      COALESCE(NULLIF(trim(country), ''), 'Unknown') as country,
      COUNT(*) as totalLeads,
      SUM(CASE WHEN status = 'Qualified' OR leadScore >= 60 THEN 1 ELSE 0 END) as qualified,
      SUM(CASE WHEN status IN ('Contacted', 'Responded', 'Interested', 'Meeting Scheduled', 'Converted') THEN 1 ELSE 0 END) as contacted,
      SUM(CASE WHEN status IN ('Interested', 'Converted') THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END) as converted
    FROM leads
    GROUP BY country
    ORDER BY totalLeads DESC
    LIMIT 8
  `).all();

  return {
    countryWiseLeads,
    stateWiseLeads,
    cityWiseLeads,
    categoryLeads,
    outreachPerformance: {
      waSent,
      waReplies,
      emailSent,
      emailReplies,
      totalSent: waSent + emailSent,
      totalReplies: waReplies + emailReplies
    },
    whatsappResponseRate,
    emailResponseRate,
    interestConversionRate,
    meetingConversionRate,
    countryWiseSalesPerformance
  };
}

// Global System Settings for Admin Controls
export function getAdminSettings() {
  const defaults = {
    dailyOutreachLimit: 50,
    dailyEmailLimit: 100,
    followUpCooldownHours: 48,
    maxFollowUpsPerLead: 3,
    autoFollowUpEnabled: true,
    whatsappAgentActive: true,
    emailAgentActive: true,
    researchAgentActive: true,
    calendarAgentActive: true,
    targetCountries: ['India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Singapore', 'Germany']
  };

  try {
    const row = db.prepare("SELECT value FROM knowledge_settings WHERE key = 'admin_global_settings'").get();
    if (row && row.value) {
      return { ...defaults, ...JSON.parse(row.value) };
    }
  } catch (e) {
    // Return defaults if parsing fails
  }

  return defaults;
}

export function updateAdminSettings(newSettings, performedBy = 'administrator') {
  const current = getAdminSettings();
  const merged = { ...current, ...newSettings };
  
  db.prepare(`
    INSERT INTO knowledge_settings (key, value)
    VALUES ('admin_global_settings', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify(merged));

  logAuditAction({
    agentName: 'Admin Control Center',
    actionType: 'UPDATE_SYSTEM_SETTINGS',
    details: newSettings,
    performedBy
  });

  return merged;
}

// Research History & Location Exploration Helpers
export function recordResearchHistory({ country, state = '', city, category = 'Fitness Centre', researchDate = null, discoveredCount = 0, acceptedCount = 0 }) {
  const dateStr = researchDate || new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    INSERT INTO research_history (country, state, city, category, researchDate, discoveredCount, acceptedCount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(country, state || '', city, category, dateStr, discoveredCount, acceptedCount);
  return { id: res.lastInsertRowid, country, state, city, category, researchDate: dateStr, discoveredCount, acceptedCount };
}

export function getResearchHistory(limit = 100) {
  return db.prepare('SELECT * FROM research_history ORDER BY id DESC LIMIT ?').all(limit);
}

export function getExploredLocations() {
  return db.prepare(`
    SELECT country, state, city, category, COUNT(*) as searchCount, MAX(researchDate) as lastResearchedDate, SUM(acceptedCount) as totalAccepted
    FROM research_history
    GROUP BY country, state, city, category
  `).all();
}

export function getTodaysNewLeadsCount(dateStr = null) {
  const today = dateStr || new Date().toISOString().split('T')[0];
  const row = db.prepare("SELECT COUNT(*) as count FROM leads WHERE date(createdAt) = date(?)").get(today);
  return row ? row.count : 0;
}

// Free Trial Subscriptions Helpers (Phase 6)
export function createFreeTrialSubscription({ leadId, gymName, contactPhone, contactEmail, trialDurationDays = 30, planTier = 'Standard', notes = '' }) {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const stmt = db.prepare(`
    INSERT INTO free_trial_subscriptions (
      leadId, gymName, contactPhone, contactEmail, trialStartDate, trialEndDate,
      status, onboardingStatus, featuresUsed, planTier, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'Active', 'Pending', '[]', ?, ?)
  `);

  const res = stmt.run(leadId, gymName, contactPhone || null, contactEmail || null, startStr, endStr, planTier, notes || '');
  
  // Advance lead status to 'Interested' or 'Converted' as appropriate
  updateLeadStatus(leadId, 'Interested', `Enrolled in ${trialDurationDays}-day free trial (Expires: ${endStr})`);

  logAuditAction({
    agentName: 'Trial Tracker Agent',
    actionType: 'ENROLL_FREE_TRIAL',
    targetEntity: 'leads',
    targetId: leadId,
    details: { subscriptionId: res.lastInsertRowid, gymName, trialStartDate: startStr, trialEndDate: endStr }
  });

  return {
    id: res.lastInsertRowid,
    leadId,
    gymName,
    trialStartDate: startStr,
    trialEndDate: endStr,
    status: 'Active'
  };
}

export function getFreeTrialSubscriptions(filter = {}) {
  let query = 'SELECT * FROM free_trial_subscriptions WHERE 1=1';
  const params = [];
  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter.leadId) {
    query += ' AND leadId = ?';
    params.push(filter.leadId);
  }
  query += ' ORDER BY id DESC';
  return db.prepare(query).all(...params);
}

export function updateFreeTrialSubscription(id, updates = {}) {
  const fields = [];
  const params = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(typeof val === 'object' ? JSON.stringify(val) : val);
  }
  if (fields.length === 0) return null;
  fields.push("updatedAt = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE free_trial_subscriptions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare('SELECT * FROM free_trial_subscriptions WHERE id = ?').get(id);
}

// Attach helper methods to default db object for convenience
Object.assign(db, {
  recordFeedback,
  getFeedbacks,
  getFeedbackStats,
  updateFeedback,
  createFollowUp,
  updateFollowUp,
  cancelPendingFollowUpsForLead,
  getFollowUps,
  getPendingFollowUps,
  checkFollowUpEligibility,
  getHighValueProspects,
  FEEDBACK_CATEGORIES,
  updateLeadStatus,
  getLeadById,
  queryLeads,
  saveOrUpdateLead,
  createMeeting,
  updateMeeting,
  getMeetingById,
  getMeetings,
  getUpcomingMeetings,
  getCalendarStats,
  initAgentMonitoringIfEmpty,
  logAuditAction,
  getAuditLogs,
  getAgentMonitoring,
  updateAgentMonitoring,
  getExecutiveDashboardStats,
  getSalesAnalyticsData,
  getAdminSettings,
  updateAdminSettings,
  recordResearchHistory,
  getResearchHistory,
  getExploredLocations,
  getTodaysNewLeadsCount,
  createFreeTrialSubscription,
  getFreeTrialSubscriptions,
  updateFreeTrialSubscription
});

// Automatically seed on initialization if empty
seedKnowledgeBaseIfEmpty();
initAgentMonitoringIfEmpty();

export default db;
