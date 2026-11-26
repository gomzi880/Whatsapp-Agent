import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import db, {
  queryLeads,
  getLeadStats,
  VALID_STATUSES,
  getKnowledgeItems,
  getKnowledgeItemById,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  getKnowledgeSettings,
  updateKnowledgeSetting,
  getKnowledgeDocuments,
  getKnowledgeStats,
  getOutreachCampaigns,
  getOutreachCampaignById,
  getOutreachStats,
  getLeadMessages,
  getEligibleLeadsForOutreach
} from '../database/db.js';
import { TARGET_LOCATIONS, GYM_CATEGORIES } from '../researcher/sources/locations.js';
import {
  startResearchJob,
  pauseResearchJob,
  resumeResearchJob,
  stopResearchJob,
  getResearchJobs,
  getActiveJobStatus,
} from '../researcher/agent.js';
import { MANDATORY_CATEGORIES } from '../knowledge/seedData.js';
import { retrieveRelevantKnowledge } from '../knowledge/rag.js';
import {
  isOutreachApproved,
  setOutreachApproval,
  processUploadedDocument,
  reindexAllDocuments
} from '../knowledge/knowledgeService.js';
import {
  createCampaign,
  approveCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  sendTestOutreachMessage,
  generatePersonalizedIntro
} from '../outreach/campaignManager.js';
import { isWhatsAppConnected } from '../outreach/outreachService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer storage for Knowledge Base Documents
const uploadsDir = path.resolve('./uploads/knowledge');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

app.use('/uploads', express.static(path.resolve('./uploads')));

// Serve Static Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Get Aggregated Metrics
app.get('/api/stats', (req, res) => {
  try {
    const stats = getLeadStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Query Leads with Full Filters & Pagination
app.get('/api/leads', (req, res) => {
  try {
    const { country, state, city, category, status, hasWhatsApp, hasEmail, minScore, search, page = 1, limit = 50 } = req.query;
    const result = queryLeads(
      { country, state, city, category, status, hasWhatsApp, hasEmail, minScore, search },
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update Lead Status / Notes
app.patch('/api/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, ownerName, businessPhone, businessEmail } = req.body;

    const updates = [];
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (ownerName !== undefined) {
      updates.push('ownerName = ?');
      params.push(ownerName);
    }
    if (businessPhone !== undefined) {
      updates.push('businessPhone = ?');
      params.push(businessPhone);
    }
    if (businessEmail !== undefined) {
      updates.push('businessEmail = ?');
      params.push(businessEmail);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    updates.push('updatedAt = datetime("now")');
    params.push(id);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Start New Research Job
app.post('/api/research/start', async (req, res) => {
  try {
    const { country, state, city, category, limit } = req.body;
    if (!city || !country) {
      return res.status(400).json({ success: false, error: 'Country and City are required' });
    }
    const job = await startResearchJob({ country, state, city, category, limit });
    res.json({ success: true, jobId: job.jobId, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Job Controls: Pause, Resume, Stop
app.post('/api/research/pause', (req, res) => {
  const { jobId } = req.body;
  const ok = pauseResearchJob(jobId);
  res.json({ success: ok });
});

app.post('/api/research/resume', (req, res) => {
  const { jobId } = req.body;
  const ok = resumeResearchJob(jobId);
  res.json({ success: ok });
});

app.post('/api/research/stop', (req, res) => {
  const { jobId } = req.body;
  const ok = stopResearchJob(jobId);
  res.json({ success: ok });
});

// 6. Get Jobs & Progress Status
app.get('/api/research/jobs', (req, res) => {
  const jobs = getResearchJobs(parseInt(req.query.limit || 20, 10));
  res.json({ success: true, jobs });
});

app.get('/api/research/status/:id', (req, res) => {
  const job = getActiveJobStatus(req.params.id);
  res.json({ success: true, job });
});

// 7. Locations & Categories Dropdown Helper
app.get('/api/locations', (req, res) => {
  res.json({
    success: true,
    locations: TARGET_LOCATIONS,
    categories: GYM_CATEGORIES,
    statuses: VALID_STATUSES,
  });
});

// 8. One-Click Export to CSV
app.get('/api/leads/export/csv', (req, res) => {
  try {
    const { country, state, city, category, status } = req.query;
    const { leads } = queryLeads({ country, state, city, category, status }, 1, 10000);

    const headers = [
      'ID',
      'Gym Name',
      'Category',
      'Owner Name',
      'Founder Name',
      'Business Phone',
      'WhatsApp Available',
      'Business Email',
      'Website',
      'Address',
      'City',
      'State',
      'Country',
      'Lead Status',
      'Lead Score',
      'Confidence Level',
      'Instagram URL',
      'Facebook URL',
      'LinkedIn URL',
      'Research Date',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];

    for (const l of leads) {
      csvRows.push(
        [
          l.id,
          escapeCsv(l.gymName),
          escapeCsv(l.gymCategory),
          escapeCsv(l.ownerName),
          escapeCsv(l.founderName),
          escapeCsv(l.businessPhone),
          l.hasWhatsApp ? 'Yes' : 'No',
          escapeCsv(l.businessEmail),
          escapeCsv(l.website),
          escapeCsv(l.fullAddress),
          escapeCsv(l.city),
          escapeCsv(l.state),
          escapeCsv(l.country),
          escapeCsv(l.status),
          l.leadScore,
          escapeCsv(l.confidenceLevel),
          escapeCsv(l.instagramUrl),
          escapeCsv(l.facebookUrl),
          escapeCsv(l.linkedinUrl),
          escapeCsv(l.researchDate),
        ].join(',')
      );
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gymstack_leads_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).send('Error exporting CSV: ' + err.message);
  }
});

// 9. One-Click Export to JSON
app.get('/api/leads/export/json', (req, res) => {
  try {
    const { country, state, city, category, status } = req.query;
    const { leads } = queryLeads({ country, state, city, category, status }, 1, 10000);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gymstack_leads_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(leads, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PRODUCT KNOWLEDGE BASE API ENDPOINTS
// ==========================================

// 10. Knowledge Metrics & Stats
app.get('/api/knowledge/stats', (req, res) => {
  try {
    const stats = getKnowledgeStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Mandatory Categories List
app.get('/api/knowledge/categories', (req, res) => {
  res.json({ success: true, categories: MANDATORY_CATEGORIES });
});

// 12. Query Knowledge Items (Filters & Search)
app.get('/api/knowledge/items', (req, res) => {
  try {
    const { category, search, verifiedOnly, limit = 100, offset = 0 } = req.query;
    const result = getKnowledgeItems({
      category,
      search,
      verifiedOnly: verifiedOnly === 'true',
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Get Single Knowledge Item
app.get('/api/knowledge/items/:id', (req, res) => {
  try {
    const item = getKnowledgeItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Create Knowledge Item
app.post('/api/knowledge/items', (req, res) => {
  try {
    const { category, title, content, sourceType, tags, isVerified, sortOrder } = req.body;
    if (!category || !title || !content) {
      return res.status(400).json({ success: false, error: 'Category, title, and content are required' });
    }
    const item = createKnowledgeItem({ category, title, content, sourceType, tags, isVerified, sortOrder });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Update Knowledge Item
app.put('/api/knowledge/items/:id', (req, res) => {
  try {
    const updated = updateKnowledgeItem(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Delete Knowledge Item
app.delete('/api/knowledge/items/:id', (req, res) => {
  try {
    const ok = deleteKnowledgeItem(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Knowledge Settings (Pricing, Demo Links, Company Info)
app.get('/api/knowledge/settings', (req, res) => {
  try {
    const settings = getKnowledgeSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/knowledge/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'Key is required' });
    updateKnowledgeSetting(key, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 18. Outreach Approval Guardrail
app.post('/api/knowledge/approval', (req, res) => {
  try {
    const { approved } = req.body;
    setOutreachApproval(approved);
    res.json({ success: true, outreachApproved: isOutreachApproved() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 19. Document & Media Upload
app.post('/api/knowledge/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const { category = 'General', title = '' } = req.body;
    const result = await processUploadedDocument({ file: req.file, category, title });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 20. List Uploaded Documents
app.get('/api/knowledge/documents', (req, res) => {
  try {
    const documents = getKnowledgeDocuments();
    res.json({ success: true, documents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 21. Re-index All Documents
app.post('/api/knowledge/reindex', async (req, res) => {
  try {
    const result = await reindexAllDocuments();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 22. Test AI RAG Retrieval Simulator
app.post('/api/knowledge/test-query', (req, res) => {
  try {
    const { query } = req.body;
    const result = retrieveRelevantKnowledge(query);
    res.json({ success: true, query, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// OUTREACH CAMPAIGNS & LIVE MESSAGES ENDPOINTS
// ==========================================

// 23. Outreach Metrics & Stats
app.get('/api/outreach/stats', (req, res) => {
  try {
    const stats = getOutreachStats();
    res.json({ success: true, stats, isWhatsAppConnected: isWhatsAppConnected() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 24. List All Campaigns
app.get('/api/outreach/campaigns', (req, res) => {
  try {
    const campaigns = getOutreachCampaigns(parseInt(req.query.limit || 50, 10));
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 25. Create Campaign (Staged in pending_approval)
app.post('/api/outreach/campaigns', (req, res) => {
  try {
    const { name, targetCountry, targetCity, targetCategory, minLeadScore, dailyLimit, customIntroTemplate } = req.body;
    const campaign = createCampaign({
      name,
      targetCountry,
      targetCity,
      targetCategory,
      minLeadScore: parseInt(minLeadScore || 40, 10),
      dailyLimit: parseInt(dailyLimit || 20, 10),
      customIntroTemplate
    });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 26. Approve Campaign
app.post('/api/outreach/campaigns/:id/approve', (req, res) => {
  try {
    const campaign = approveCampaign(req.params.id);
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 27. Start Campaign
app.post('/api/outreach/campaigns/:id/start', async (req, res) => {
  try {
    const result = await startCampaign(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 28. Pause Campaign
app.post('/api/outreach/campaigns/:id/pause', (req, res) => {
  try {
    const ok = pauseCampaign(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 29. Resume Campaign
app.post('/api/outreach/campaigns/:id/resume', async (req, res) => {
  try {
    const result = await resumeCampaign(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 30. Stop Campaign
app.post('/api/outreach/campaigns/:id/stop', (req, res) => {
  try {
    const ok = stopCampaign(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 31. Send Test Outreach Message
app.post('/api/outreach/test', async (req, res) => {
  try {
    const { testPhone, leadData } = req.body;
    if (!testPhone) return res.status(400).json({ success: false, error: 'testPhone is required' });
    const result = await sendTestOutreachMessage(testPhone, leadData || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 32. View Live Message Logs (Sent, Replies, Opt-outs)
app.get('/api/outreach/messages', (req, res) => {
  try {
    const { leadId, campaignId, remoteJid, role, intent, limit = 50, offset = 0 } = req.query;
    const result = getLeadMessages({
      leadId: leadId ? parseInt(leadId, 10) : null,
      campaignId: campaignId ? parseInt(campaignId, 10) : null,
      remoteJid,
      role,
      intent,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 33. Preview Eligible Leads
app.get('/api/outreach/eligible-leads', (req, res) => {
  try {
    const { country, city, category, minScore = 30, limit = 50 } = req.query;
    const leads = getEligibleLeadsForOutreach({
      country,
      city,
      category,
      minScore: parseInt(minScore, 10),
      limit: parseInt(limit, 10)
    });
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 34. Preview Personalized Template
app.post('/api/outreach/preview-template', (req, res) => {
  try {
    const { template, lead } = req.body;
    const sampleLead = lead || {
      gymName: 'Titan Fitness Club',
      city: 'Indore',
      country: 'India',
      ownerName: 'Rahul',
      gymCategory: 'Gym'
    };
    const rendered = generatePersonalizedIntro(sampleLead, template);
    res.json({ success: true, rendered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 35. WhatsApp Connection Check
app.get('/api/outreach/connection', (req, res) => {
  res.json({ success: true, isConnected: isWhatsAppConnected() });
});

/**
 * Renders the High-Performance HTML/Tailwind Dashboard UI
 */
function renderDashboardHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GymStack Global Research Agent & Lead Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    .badge-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased font-sans">
  
  <!-- Navigation Header -->
  <header class="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xl shadow">
          G
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight">GymStack <span class="text-blue-400 font-semibold text-sm ml-1.5 px-2 py-0.5 bg-blue-900/50 border border-blue-700/50 rounded-full">Global Research Agent</span></h1>
          <p class="text-xs text-slate-400">Targeted Gym Discovery & Lead Generation</p>
        </div>
      </div>
      <div class="flex items-center space-x-3 text-sm">
        <span class="inline-flex items-center text-xs bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2.5 py-1 rounded-md">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span> WhatsApp Connected
        </span>
        <button onclick="refreshData()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center">
          <i class="fa-solid fa-arrows-rotate mr-1.5"></i> Refresh
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

    <!-- KPI Metrics Row -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">Total Gyms</div>
        <div id="stat-total" class="text-2xl font-black text-slate-900 mt-1">-</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">Qualified Leads</div>
        <div id="stat-qualified" class="text-2xl font-black text-blue-600 mt-1">-</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">WhatsApp Ready</div>
        <div id="stat-whatsapp" class="text-2xl font-black text-emerald-600 mt-1">-</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">Verified Emails</div>
        <div id="stat-email" class="text-2xl font-black text-purple-600 mt-1">-</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">Cities Covered</div>
        <div id="stat-cities" class="text-2xl font-black text-amber-600 mt-1">-</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-medium text-slate-500 uppercase">Countries</div>
        <div id="stat-countries" class="text-2xl font-black text-indigo-600 mt-1">-</div>
      </div>
    </div>

    <!-- Research Execution Control Panel -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-satellite-dish text-blue-600 mr-2"></i> Launch New Gym Research Task
          </h2>
          <p class="text-xs text-slate-500">Discover gyms, fitness studios & chains across India & Global Markets</p>
        </div>
        <div id="job-status-pill" class="hidden"></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Target Country</label>
          <select id="research-country" onchange="onCountryChange()" class="w-full text-xs rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="India">India</option>
            <option value="USA">USA</option>
            <option value="UK">UK</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="UAE">UAE</option>
            <option value="Singapore">Singapore</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Netherlands">Netherlands</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">State / Province</label>
          <select id="research-state" onchange="onStateChange()" class="w-full text-xs rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Select State</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Target City</label>
          <input id="research-city" type="text" placeholder="e.g. Indore, Mumbai, Dubai" class="w-full text-xs rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-blue-500 outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Gym Category</label>
          <select id="research-category" class="w-full text-xs rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="Fitness Centre">All Fitness Centres</option>
            <option value="Commercial Gym">Commercial Gyms</option>
            <option value="Independent Gym">Independent Gyms</option>
            <option value="Gym Chain">Gym Chains</option>
            <option value="CrossFit Studio">CrossFit Studios</option>
            <option value="Personal Training Studio">PT Studios</option>
            <option value="Premium Fitness Club">Premium Clubs</option>
            <option value="Boutique Fitness Studio">Boutique Studios</option>
            <option value="Women Fitness Centre">Women Fitness Centres</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Search Limit</label>
          <select id="research-limit" class="w-full text-xs rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="15">15 Gyms</option>
            <option value="30" selected>30 Gyms</option>
            <option value="50">50 Gyms</option>
            <option value="100">100 Gyms</option>
          </select>
        </div>
      </div>

      <!-- Action & Progress Bar -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div class="w-full sm:w-2/3 space-y-1.5">
          <div class="flex justify-between text-xs text-slate-600">
            <span id="progress-label">Ready to research</span>
            <span id="progress-percent" class="font-bold text-blue-600">0%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div id="progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button id="btn-start" onclick="startResearch()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center">
            <i class="fa-solid fa-play mr-1.5"></i> Start Research
          </button>
          <button id="btn-pause" onclick="pauseResearch()" class="hidden bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition">
            <i class="fa-solid fa-pause mr-1"></i> Pause
          </button>
          <button id="btn-resume" onclick="resumeResearch()" class="hidden bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition">
            <i class="fa-solid fa-play mr-1"></i> Resume
          </button>
          <button id="btn-stop" onclick="stopResearch()" class="hidden bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition">
            <i class="fa-solid fa-stop mr-1"></i> Stop
          </button>
        </div>
      </div>
    </div>

    <!-- Leads Management & Filter Table -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      
      <!-- Table Filter Header -->
      <div class="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <div class="relative w-full sm:w-72">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input id="filter-search" oninput="debounceFilter()" type="text" placeholder="Search gym, owner, city..." class="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-2">
            <a id="btn-export-csv" href="/api/leads/export/csv" class="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center shadow-sm">
              <i class="fa-solid fa-file-csv text-emerald-600 mr-1.5 text-sm"></i> Export CSV
            </a>
            <a id="btn-export-json" href="/api/leads/export/json" class="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center shadow-sm">
              <i class="fa-solid fa-code text-blue-600 mr-1.5 text-sm"></i> Export JSON
            </a>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1 text-xs">
          <select id="filter-status" onchange="applyFilters()" class="border border-slate-300 rounded-lg p-1.5 outline-none">
            <option value="">All Lead Statuses</option>
            <option value="New">New</option>
            <option value="Researching">Researching</option>
            <option value="Qualified">Qualified</option>
            <option value="Not Qualified">Not Qualified</option>
            <option value="Ready for Outreach">Ready for Outreach</option>
            <option value="Contacted">Contacted</option>
            <option value="Responded">Responded</option>
            <option value="Interested">Interested</option>
            <option value="Meeting Requested">Meeting Requested</option>
            <option value="Meeting Scheduled">Meeting Scheduled</option>
            <option value="Demo Completed">Demo Completed</option>
            <option value="Follow-up Required">Follow-up Required</option>
            <option value="Converted">Converted</option>
          </select>

          <select id="filter-country" onchange="applyFilters()" class="border border-slate-300 rounded-lg p-1.5 outline-none">
            <option value="">All Countries</option>
            <option value="India">India</option>
            <option value="USA">USA</option>
            <option value="UK">UK</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="UAE">UAE</option>
          </select>

          <select id="filter-category" onchange="applyFilters()" class="border border-slate-300 rounded-lg p-1.5 outline-none">
            <option value="">All Categories</option>
            <option value="Fitness Centre">Fitness Centre</option>
            <option value="Commercial Gym">Commercial Gym</option>
            <option value="Independent Gym">Independent Gym</option>
            <option value="Gym Chain">Gym Chain</option>
            <option value="CrossFit Studio">CrossFit</option>
            <option value="Women Fitness Centre">Women Fitness</option>
          </select>

          <select id="filter-whatsapp" onchange="applyFilters()" class="border border-slate-300 rounded-lg p-1.5 outline-none">
            <option value="">WhatsApp: All</option>
            <option value="true">WhatsApp Available</option>
          </select>

          <select id="filter-email" onchange="applyFilters()" class="border border-slate-300 rounded-lg p-1.5 outline-none">
            <option value="">Email: All</option>
            <option value="true">Email Available</option>
          </select>

          <button onclick="resetFilters()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition">
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Leads Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead class="bg-slate-100/75 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Gym Name & Category</th>
              <th class="py-3 px-4">Location</th>
              <th class="py-3 px-4">Contact Details</th>
              <th class="py-3 px-4">Owner / Management</th>
              <th class="py-3 px-4">Website & Social</th>
              <th class="py-3 px-4">Status & Score</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="leads-table-body" class="divide-y divide-slate-200 bg-white">
            <tr>
              <td colspan="7" class="text-center py-8 text-slate-400">Loading leads...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600">
        <span id="pagination-info">Showing 0 of 0 leads</span>
        <div class="space-x-1" id="pagination-controls"></div>
      </div>
    </div>
  </main>

  <script>
    let locationData = {};
    let activeJobId = null;
    let pollInterval = null;
    let currentPage = 1;

    async function init() {
      await loadLocations();
      await refreshData();
    }

    async function loadLocations() {
      try {
        const res = await fetch('/api/locations');
        const data = await res.json();
        if (data.success) {
          locationData = data.locations;
          onCountryChange();
        }
      } catch (e) {
        console.error(e);
      }
    }

    function onCountryChange() {
      const country = document.getElementById('research-country').value;
      const stateSelect = document.getElementById('research-state');
      stateSelect.innerHTML = '<option value="">All States</option>';

      if (locationData[country]) {
        Object.keys(locationData[country]).forEach(state => {
          const opt = document.createElement('option');
          opt.value = state;
          opt.textContent = state;
          stateSelect.appendChild(opt);
        });
      }
      onStateChange();
    }

    function onStateChange() {
      const country = document.getElementById('research-country').value;
      const state = document.getElementById('research-state').value;
      const cityInput = document.getElementById('research-city');

      if (country && state && locationData[country] && locationData[country][state]) {
        const cities = locationData[country][state];
        if (cities.length > 0) cityInput.value = cities[0];
      }
    }

    async function refreshData() {
      await Promise.all([loadStats(), loadLeads(currentPage)]);
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (data.success) {
          const s = data.stats;
          document.getElementById('stat-total').textContent = s.totalLeads.toLocaleString();
          document.getElementById('stat-qualified').textContent = s.qualifiedLeads.toLocaleString();
          document.getElementById('stat-whatsapp').textContent = s.withWhatsApp.toLocaleString();
          document.getElementById('stat-email').textContent = s.withEmail.toLocaleString();
          document.getElementById('stat-cities').textContent = s.citiesCount.toLocaleString();
          document.getElementById('stat-countries').textContent = s.countriesCount.toLocaleString();
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function loadLeads(page = 1) {
      currentPage = page;
      const params = new URLSearchParams({
        page: page,
        limit: 50,
        search: document.getElementById('filter-search').value,
        country: document.getElementById('filter-country').value,
        category: document.getElementById('filter-category').value,
        status: document.getElementById('filter-status').value,
        hasWhatsApp: document.getElementById('filter-whatsapp').value,
        hasEmail: document.getElementById('filter-email').value,
      });

      document.getElementById('btn-export-csv').href = '/api/leads/export/csv?' + params.toString();
      document.getElementById('btn-export-json').href = '/api/leads/export/json?' + params.toString();

      try {
        const res = await fetch('/api/leads?' + params.toString());
        const data = await res.json();
        if (data.success) {
          renderLeadsTable(data.leads);
          document.getElementById('pagination-info').textContent = \`Showing \${data.leads.length} of \${data.total} leads\`;
        }
      } catch (e) {
        console.error(e);
      }
    }

    function renderLeadsTable(leads) {
      const tbody = document.getElementById('leads-table-body');
      if (!leads || leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">No leads match your search criteria.</td></tr>';
        return;
      }

      tbody.innerHTML = leads.map(l => \`
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">\${escapeHtml(l.gymName)}</div>
            <div class="text-[11px] text-blue-600 font-medium">\${escapeHtml(l.gymCategory || 'Fitness Centre')}</div>
          </td>
          <td class="py-3 px-4">
            <div class="text-slate-800 font-medium">\${escapeHtml(l.city)}, \${escapeHtml(l.country)}</div>
            <div class="text-[11px] text-slate-400 truncate max-w-xs" title="\${escapeHtml(l.fullAddress)}">\${escapeHtml(l.fullAddress || '')}</div>
          </td>
          <td class="py-3 px-4">
            \${l.businessPhone ? \`
              <div class="font-mono text-slate-800 flex items-center">
                <i class="fa-solid fa-phone text-slate-400 mr-1.5 text-[10px]"></i> \${escapeHtml(l.businessPhone)}
                \${l.hasWhatsApp ? '<i class="fa-brands fa-whatsapp text-emerald-500 ml-1.5 text-sm" title="WhatsApp Available"></i>' : ''}
              </div>
            \` : '<span class="text-slate-400">No phone</span>'}
            \${l.businessEmail ? \`
              <div class="text-slate-600 flex items-center mt-0.5">
                <i class="fa-solid fa-envelope text-slate-400 mr-1.5 text-[10px]"></i> \${escapeHtml(l.businessEmail)}
              </div>
            \` : ''}
          </td>
          <td class="py-3 px-4">
            <div class="text-slate-800 font-medium">\${escapeHtml(l.ownerName || l.founderName || l.managerName || 'Not verified')}</div>
            <div class="text-[10px] text-slate-400">\${l.founderName ? 'Founder' : (l.ownerName ? 'Owner' : '')}</div>
          </td>
          <td class="py-3 px-4 space-x-2">
            \${l.website ? \`<a href="\${l.website.startsWith('http') ? l.website : 'https://' + l.website}" target="_blank" class="text-blue-600 hover:text-blue-800" title="Visit Website"><i class="fa-solid fa-globe"></i></a>\` : ''}
            \${l.instagramUrl ? \`<a href="\${l.instagramUrl}" target="_blank" class="text-pink-600 hover:text-pink-800" title="Instagram"><i class="fa-brands fa-instagram"></i></a>\` : ''}
            \${l.facebookUrl ? \`<a href="\${l.facebookUrl}" target="_blank" class="text-blue-700 hover:text-blue-900" title="Facebook"><i class="fa-brands fa-facebook"></i></a>\` : ''}
          </td>
          <td class="py-3 px-4">
            <select onchange="updateLeadStatus(\${l.id}, this.value)" class="text-xs font-semibold rounded-md border border-slate-200 px-2 py-1 outline-none \${getStatusBadgeClass(l.status)}">
              \${getStatusOptions(l.status)}
            </select>
            <div class="text-[10px] text-slate-400 mt-1">Score: <strong class="text-slate-700">\${l.leadScore}/100</strong></div>
          </td>
          <td class="py-3 px-4 text-right">
            \${l.businessPhone ? \`
              <a href="https://wa.me/\${l.businessPhone.replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded text-xs font-semibold transition">
                <i class="fa-brands fa-whatsapp mr-1 text-sm"></i> Chat
              </a>
            \` : ''}
          </td>
        </tr>
      \`).join('');
    }

    function getStatusBadgeClass(status) {
      if (status === 'Qualified' || status === 'Interested') return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      if (status === 'Demo Completed' || status === 'Converted') return 'bg-blue-50 text-blue-800 border-blue-300';
      if (status === 'Not Interested' || status === 'Not Qualified') return 'bg-rose-50 text-rose-800 border-rose-300';
      return 'bg-slate-50 text-slate-800 border-slate-200';
    }

    function getStatusOptions(currentStatus) {
      const statuses = ['New', 'Researching', 'Qualified', 'Not Qualified', 'Ready for Outreach', 'Contacted', 'Responded', 'Interested', 'Meeting Requested', 'Meeting Scheduled', 'Demo Completed', 'Follow-up Required', 'Converted', 'Not Interested', 'Unsubscribed'];
      return statuses.map(s => \`<option value="\${s}" \${s === currentStatus ? 'selected' : ''}>\${s}</option>\`).join('');
    }

    async function updateLeadStatus(id, newStatus) {
      try {
        await fetch('/api/leads/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        loadStats();
      } catch (e) {
        console.error(e);
      }
    }

    async function startResearch() {
      const country = document.getElementById('research-country').value;
      const state = document.getElementById('research-state').value;
      const city = document.getElementById('research-city').value;
      const category = document.getElementById('research-category').value;
      const limit = document.getElementById('research-limit').value;

      if (!city) {
        alert('Please enter a target city');
        return;
      }

      setJobControlButtons('running');
      document.getElementById('progress-label').textContent = \`Researching \${category} in \${city}, \${country}...\`;

      try {
        const res = await fetch('/api/research/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country, state, city, category, limit })
        });
        const data = await res.json();
        if (data.success) {
          activeJobId = data.job.jobId;
          startPolling(activeJobId);
        }
      } catch (e) {
        alert('Error starting research: ' + e.message);
        setJobControlButtons('idle');
      }
    }

    function startPolling(jobId) {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/research/status/' + jobId);
          const data = await res.json();
          if (data.success && data.job) {
            const j = data.job;
            const pct = j.currentProgress || 0;
            document.getElementById('progress-bar').style.width = pct + '%';
            document.getElementById('progress-percent').textContent = pct + '%';
            document.getElementById('progress-label').textContent = \`Discovered: \${j.discoveredCount} | Qualified: \${j.qualifiedCount} (\${j.status})\`;

            if (j.status === 'completed' || j.status === 'stopped' || j.status === 'failed') {
              clearInterval(pollInterval);
              setJobControlButtons(j.status);
              refreshData();
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }

    async function pauseResearch() {
      if (!activeJobId) return;
      await fetch('/api/research/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: activeJobId }) });
      setJobControlButtons('paused');
    }

    async function resumeResearch() {
      if (!activeJobId) return;
      await fetch('/api/research/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: activeJobId }) });
      setJobControlButtons('running');
    }

    async function stopResearch() {
      if (!activeJobId) return;
      await fetch('/api/research/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: activeJobId }) });
      setJobControlButtons('stopped');
      if (pollInterval) clearInterval(pollInterval);
      refreshData();
    }

    function setJobControlButtons(status) {
      document.getElementById('btn-start').classList.toggle('hidden', status === 'running' || status === 'paused');
      document.getElementById('btn-pause').classList.toggle('hidden', status !== 'running');
      document.getElementById('btn-resume').classList.toggle('hidden', status !== 'paused');
      document.getElementById('btn-stop').classList.toggle('hidden', status !== 'running' && status !== 'paused');
    }

    let debounceTimer;
    function debounceFilter() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => applyFilters(), 300);
    }

    function applyFilters() {
      loadLeads(1);
    }

    function resetFilters() {
      document.getElementById('filter-search').value = '';
      document.getElementById('filter-country').value = '';
      document.getElementById('filter-category').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-whatsapp').value = '';
      document.getElementById('filter-email').value = '';
      loadLeads(1);
    }

    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.onload = init;
  </script>
</body>
</html>
  `;
}

export function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`🌐 [Research Dashboard] Running at http://localhost:${port}`);
  });
}

// Start Server if invoked directly or via master runner
if (process.argv[1]?.includes('server.js') || process.argv[1]?.includes('start-all.js')) {
  startServer();
}

export default app;
