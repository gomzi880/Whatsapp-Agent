/**
 * Knowledge Service: Document indexing, manual knowledge management, and outreach safety
 */

import fs from 'fs';
import path from 'path';
import db, {
  saveKnowledgeDocument,
  getKnowledgeDocuments,
  createKnowledgeItem,
  getKnowledgeItems,
  getKnowledgeSettings,
  updateKnowledgeSetting
} from '../database/db.js';

const UPLOADS_DIR = path.resolve('./uploads/knowledge');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Checks if the administrator has approved automated outreach
 */
export function isOutreachApproved() {
  const settings = getKnowledgeSettings();
  return settings.outreach_approved === '1' || settings.outreach_approved === true;
}

/**
 * Set outreach approval status
 */
export function setOutreachApproval(approved) {
  return updateKnowledgeSetting('outreach_approved', approved ? '1' : '0');
}

/**
 * Ingest an uploaded file and extract knowledge items
 */
export async function processUploadedDocument({ file, category = 'General', title = '' }) {
  const filePath = file.path;
  const originalName = file.originalname;
  const fileName = file.filename;
  const fileType = path.extname(originalName).replace('.', '').toLowerCase();
  const fileSize = file.size;

  let extractedText = '';

  try {
    if (fileType === 'txt' || fileType === 'md' || fileType === 'csv' || fileType === 'json') {
      extractedText = fs.readFileSync(filePath, 'utf-8');
    } else if (fileType === 'pdf') {
      // Basic text extraction for PDF text streams
      const buffer = fs.readFileSync(filePath);
      const rawString = buffer.toString('binary');
      // Extract text within stream blocks or parentheses
      const matches = rawString.match(/\((.*?)\)|\[(.*?)\]/g);
      if (matches && matches.length > 0) {
        extractedText = matches
          .map(m => m.replace(/[()\[\]]/g, ''))
          .filter(t => t.length > 3 && !t.includes('\\'))
          .join(' ')
          .slice(0, 8000);
      } else {
        extractedText = `PDF Document uploaded: ${originalName} (Size: ${Math.round(fileSize / 1024)} KB)`;
      }
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) {
      extractedText = `Screenshot / Image Reference: ${originalName}. Visual documentation available in system.`;
    } else {
      extractedText = `Uploaded document: ${originalName}`;
    }
  } catch (err) {
    console.error('Error extracting text from file:', err);
    extractedText = `Uploaded document: ${originalName} (Extraction partial)`;
  }

  // Create document entry
  const doc = saveKnowledgeDocument({
    originalName,
    fileName,
    fileType,
    fileSize,
    category,
    extractedText,
    status: 'indexed',
    itemCount: 1
  });

  // Create corresponding knowledge item so it becomes searchable immediately
  const itemTitle = title || path.parse(originalName).name.replace(/[-_]/g, ' ');
  const itemContent = extractedText.trim().length > 20
    ? extractedText.slice(0, 2000)
    : `Verified document uploaded by administrator: ${originalName}. Category: ${category}.`;

  const item = createKnowledgeItem({
    category: category || 'Gym Management Features',
    title: `[Doc] ${itemTitle}`,
    content: itemContent,
    sourceType: 'document',
    sourceDocumentId: doc.id,
    tags: `document, ${fileType}, ${itemTitle.toLowerCase()}`,
    isVerified: 1,
    sortOrder: 50
  });

  return { doc, item };
}

/**
 * Re-indexes all existing uploaded documents
 */
export async function reindexAllDocuments() {
  const docs = getKnowledgeDocuments();
  let reindexedCount = 0;

  for (const doc of docs) {
    const fullPath = path.join(UPLOADS_DIR, doc.fileName);
    if (fs.existsSync(fullPath)) {
      try {
        let text = '';
        if (['txt', 'md', 'json', 'csv'].includes(doc.fileType)) {
          text = fs.readFileSync(fullPath, 'utf-8');
        } else {
          text = doc.extractedText || `Document: ${doc.originalName}`;
        }

        db.prepare("UPDATE knowledge_documents SET extractedText = ?, status = 'indexed' WHERE id = ?").run(
          text.slice(0, 10000),
          doc.id
        );

        // Update corresponding knowledge item if exists
        db.prepare(`
          UPDATE knowledge_items
          SET content = ?, updatedAt = datetime('now')
          WHERE sourceDocumentId = ?
        `).run(text.slice(0, 2000), doc.id);

        reindexedCount++;
      } catch (err) {
        console.warn(`Failed to re-index document #${doc.id}:`, err.message);
      }
    }
  }

  return { total: docs.length, reindexedCount };
}
