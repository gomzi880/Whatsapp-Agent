/**
 * GymStack Dynamic RAG Knowledge Retrieval Engine
 * 
 * Retrieves verified product knowledge for incoming user inquiries,
 * calculates confidence scores, and prevents hallucination of unsupported features.
 */

import db, {
  getKnowledgeItems,
  getKnowledgeSettings
} from '../database/db.js';

// Common stop words to strip during keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have',
  'has', 'had', 'can', 'could', 'will', 'would', 'should', 'may', 'might',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'kya', 'hai', 'kaise', 'hoga', 'mera',
  'meri', 'aap', 'aapka', 'bhai', 'sir', 'please', 'tell', 'batao',
  'gymstack', 'gym', 'stack', 'software', 'system'
]);

/**
 * Tokenizes text into search keywords
 */
function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Retrieves the most relevant knowledge items for an incoming question
 * @param {string} userQuery The customer's inquiry
 * @param {object} options Filter options { category, topK, minScore }
 * @returns {object} { relevantItems, confidence, formattedContext, demoLink }
 */
export function retrieveRelevantKnowledge(userQuery, { category = null, topK = 5, minScore = 2 } = {}) {
  const settings = getKnowledgeSettings();
  const demoLink = settings.demo_link || 'https://gymstack.in/register';
  const allItems = db.prepare(`
    SELECT * FROM knowledge_items 
    WHERE isVerified = 1
    ${category ? 'AND category = ?' : ''}
  `).all(...(category ? [category] : []));

  if (!userQuery || userQuery.trim() === '') {
    // Return high-level summary if query is empty
    const overviewItems = allItems.filter(i => i.category === 'Product Overview' || i.category === 'Subscription Pricing');
    return {
      relevantItems: overviewItems,
      confidence: 'medium',
      score: 10,
      formattedContext: formatItemsForPrompt(overviewItems, settings),
      demoLink
    };
  }

  const queryKeywords = extractKeywords(userQuery);
  const scoredItems = [];

  for (const item of allItems) {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();
    const tagsLower = (item.tags || '').toLowerCase();
    const categoryLower = item.category.toLowerCase();

    for (const kw of queryKeywords) {
      if (titleLower.includes(kw)) score += 5;
      if (tagsLower.includes(kw)) score += 4;
      if (categoryLower.includes(kw)) score += 3;
      if (contentLower.includes(kw)) score += 1;
    }

    // Direct phrase matching bonus
    const queryLower = userQuery.toLowerCase().trim();
    if (titleLower.includes(queryLower)) score += 15;
    if (contentLower.includes(queryLower)) score += 8;

    if (score >= minScore) {
      scoredItems.push({ ...item, matchScore: score });
    }
  }

  // Sort descending by score
  scoredItems.sort((a, b) => b.matchScore - a.matchScore);
  const topItems = scoredItems.slice(0, topK);

  // Calculate overall confidence
  let confidence = 'high';
  const highestScore = topItems[0]?.matchScore || 0;

  if (highestScore === 0) {
    confidence = 'unsupported'; // No matching feature found in verified knowledge base
  } else if (highestScore < 5) {
    confidence = 'low';
  } else if (highestScore < 12) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }

  const contextFormatted = formatItemsForPrompt(topItems, settings, confidence);

  return {
    relevantItems: topItems,
    items: topItems,
    confidence,
    highestScore,
    formattedContext: contextFormatted,
    contextText: contextFormatted,
    demoLink
  };
}

/**
 * Formats knowledge items into structured context for AI prompt
 */
export function formatItemsForPrompt(items, settings = {}, confidence = 'high') {
  const demoLink = settings.demo_link || 'https://gymstack.in/register';
  const supportPhone = settings.support_phone || '+91-8358826116';
  const trialText = settings.free_trial_text || '30-day free trial (no credit card required)';

  let context = `--- VERIFIED GYMSTACK PRODUCT KNOWLEDGE ---\n`;
  context += `Company: ${settings.company_name || 'GymStack'} | ${settings.tagline || 'All-in-One Gym Software'}\n`;
  context += `Official Self-Registration & Demo Link: ${demoLink}\n`;
  context += `Free Trial: ${trialText}\n`;
  context += `Support Phone: ${supportPhone}\n\n`;

  if (confidence === 'unsupported' || items.length === 0) {
    context += `[CRITICAL NOTICE: The user is asking about a capability or feature NOT confirmed in the GymStack knowledge base]\n`;
    context += `- DO NOT invent or assume that GymStack supports this.\n`;
    context += `- Tell the user politely: "I want to be 100% transparent and make sure I give you exact information on this — let me quickly check with our technical team/product specialist and get back to you right away!"\n`;
    context += `- Offer to book a quick demo or share the registration link: ${demoLink}\n`;
    return context;
  }

  context += `MATCHED KNOWLEDGE & FEATURES:\n`;
  for (const item of items) {
    context += `• [${item.category}] ${item.title}\n`;
    context += `  Details: ${item.content}\n`;
  }

  context += `\nSTRICT GUIDELINES:\n`;
  context += `1. State only facts confirmed in the points above.\n`;
  context += `2. If user asks for pricing, provide exact prices from the points above.\n`;
  context += `3. Share the demo link (${demoLink}) when appropriate.\n`;
  context += `4. Keep WhatsApp responses concise (2-4 sentences max).\n`;

  return context;
}

/**
 * Returns formatted complete knowledge base for full-context prompt fallback
 */
export function getAllKnowledgeForPrompt() {
  const settings = getKnowledgeSettings();
  const { items } = getKnowledgeItems({ verifiedOnly: true, limit: 100 });

  // Group by category
  const grouped = {};
  for (const it of items) {
    if (!grouped[it.category]) grouped[it.category] = [];
    grouped[it.category].push(it);
  }

  let text = `COMPANY: ${settings.company_name || 'GymStack'} - ${settings.tagline || 'All-in-One Gym Software'}\n`;
  text += `WEBSITE: ${settings.website || 'https://gymstack.in'}\n`;
  text += `DEMO & REGISTRATION: ${settings.demo_link || 'https://gymstack.in/register'}\n`;
  text += `SUPPORT: ${settings.support_phone || '+91-8358826116'}\n`;
  text += `FREE TRIAL: ${settings.free_trial_text || '30-day free trial'}\n\n`;

  for (const [cat, list] of Object.entries(grouped)) {
    text += `\n== ${cat.toUpperCase()} ==\n`;
    for (const item of list) {
      text += `• ${item.title}: ${item.content}\n`;
    }
  }

  return text;
}
