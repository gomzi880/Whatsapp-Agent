import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { gymStackKnowledge } from './knowledge.js';
import { retrieveRelevantKnowledge, getAllKnowledgeForPrompt } from './src/knowledge/rag.js';
import { sendPackageAndFeatureEmail, sendAdminLeadNotification } from './mailer.js';

// Memory cache to hold recent conversation turns per sender (JID)
const conversationMemory = new Map();
const notifiedLeadJids = new Set();
const MAX_HISTORY_PER_CHAT = 12;

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    if (!config.geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set in your .env file! Please obtain a key from https://aistudio.google.com/'
      );
    }
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return aiClient;
}

/**
 * Formats dynamic GymStack knowledge base into prompt text
 * Uses SQLite dynamic knowledge base with fallback to knowledge.js
 */
function formatGymStackKnowledge(userMessage = '') {
  try {
    if (userMessage && userMessage.trim()) {
      const rag = retrieveRelevantKnowledge(userMessage);
      return rag.formattedContext;
    }
    return getAllKnowledgeForPrompt();
  } catch (err) {
    console.warn('[Knowledge RAG Fallback]: Using static knowledge base:', err.message);
    const k = gymStackKnowledge;
    return `
COMPANY: ${k.company.name} - ${k.company.tagline}
ABOUT: ${k.about}
FREE TRIAL: ${k.company.freeTrial}
CONTACT / SUPPORT: ${k.company.supportPhone}

KEY FEATURES:
${k.keyFeatures.map((f) => `- ${f.name}: ${f.details}`).join('\n')}

PACKAGES & PRICING:
${k.packages
  .map(
    (p) =>
      `• ${p.name} (${p.price}): Best for ${p.idealFor}.\n  Includes: ${p.features.join(', ')}`
  )
  .join('\n')}

FREQUENTLY ASKED QUESTIONS:
${k.faq.map((item) => `Q: ${item.q}\nA: ${item.a}`).join('\n')}
`;
  }
}

/**
 * Builds the GymStack Sales Manager persona prompt with dynamic RAG context
 */
function buildSystemPrompt(userMessage = '') {
  return `You are ${config.yourName}, the Senior Sales & Product Consultant at GymStack.
You are chatting with gym owners, fitness trainers, or prospects on WhatsApp who are inquiring about GymStack.

YOUR OBJECTIVES:
1. Act as a friendly, professional, knowledgeable human Sales Manager.
2. Answer all feature questions, package pricing, attendance systems, and trial details accurately based on the Verified GymStack Knowledge below.
3. Consult with the prospect to understand their gym's requirements and guide them toward a free 30-day trial or a quick 10-minute live demo.

STRICT PRODUCT KNOWLEDGE & TRUTH RULES:
- SIMPLE PROFESSIONAL LANGUAGE: Use clear, friendly, conversational wording. Avoid corporate jargon.
- AVOID UNSUPPORTED CLAIMS: ONLY state capabilities that are explicitly verified in the knowledge base.
- WHEN UNSURE OR ASKED ABOUT UNVERIFIED CAPABILITIES:
  If a customer asks about a feature, integration, or custom hardware that is NOT confirmed in the knowledge base below (or flagged as unsupported):
  DO NOT INVENT an answer! Say:
  "I want to make sure I give you 100% accurate information on this — let me check with our product specialist and get back to you right away!"
- PROVIDE DEMO LINK APPROPRIATELY: When a prospect shows interest or asks to see the software, share the official demo/registration link (https://gymstack.in/register).

WHATSAPP CHATTING RULES:
- TEXT LIKE A HUMAN: Do NOT talk like a robotic chatbot or corporate FAQ. Never say "As an AI..." or "How may I assist you today?". Be warm, respectful, and direct.
- KEEP REPLIES SNAPPY & CONCISE: WhatsApp users do not read long essays. Keep your replies to 2-4 sentences or clean bullet points.
- ALWAYS QUALIFY WITH A QUESTION: After answering their question, ask a natural qualifying question (e.g. "How many active members do you currently have at your gym?", "Are you managing things manually in Excel right now, or using another software?", "Would you like me to book a quick 10-min live demo for you?").
- PRICING INQUIRIES: Be completely transparent about prices. Use the exact plans and prices listed in the Knowledge Base below (Starter, Gold, Diamond) and ask their active member count so you can recommend the best plan for their gym.
- OFF-TOPIC / UNRELATED QUESTIONS:
  If a user asks about random subjects completely unrelated to fitness, gyms, or GymStack (e.g., general trivia, homework, politics, crypto, personal chit-chat, or random tech support):
  Do NOT act like ChatGPT giving a long essay on that off-topic subject. Politely and casually deflect with a bit of human warmth or light humor, and steer the conversation back to GymStack!
- BROCHURE / IMAGE / PDF REQUESTS:
  If a customer asks for a brochure, image, price card, PDF, or catalog on WhatsApp:
  Confirm cheerfully that you have attached the official GymStack visual brochure image right below in the chat for them to view directly, and ask how many active members they currently manage at their gym.
- EMAIL REQUESTS FOR PACKAGES / FEATURES:
  If a customer asks to receive package or feature details by email:
  a) If they have NOT provided their email address yet: Politely ask them for their email ID.
  b) If they HAVE provided an email address: Confirm that details have been dispatched to that specific email and suggest scheduling a live demo.
- MULTILINGUAL: Match the prospect's language. If they text in Hindi/Hinglish, reply naturally in friendly Hinglish. If in English, reply in English.

${formatGymStackKnowledge(userMessage)}
`;
}

/**
 * Generate a human-like reply for an incoming message
 * @param {string} jid Sender's WhatsApp ID
 * @param {string} userMessage Text message received
 * @returns {Promise<string>}
 */
export async function generateHumanReply(jid, userMessage) {
  const ai = getAiClient();

  if (!conversationMemory.has(jid)) {
    conversationMemory.set(jid, []);
  }

  const history = conversationMemory.get(jid);

  // Append new user message to history
  history.push({ role: 'user', text: userMessage });

  // Limit memory to the most recent turns
  if (history.length > MAX_HISTORY_PER_CHAT) {
    history.splice(0, history.length - MAX_HISTORY_PER_CHAT);
  }

  // Detect email address for package/feature brochure dispatch
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const emailMatch = userMessage.match(emailRegex);
  let emailDeliveryNote = '';

  if (emailMatch) {
    const detectedEmail = emailMatch[0];
    const fullRecentContext = history
      .map((m) => m.text)
      .join(' ')
      .toLowerCase();
    const isRelevantToDetails =
      /mail|email|send|package|feature|brochure|detail|price|pricing|plan|pdf|share|quote/.test(
        fullRecentContext
      ) || userMessage.trim() === detectedEmail;

    if (isRelevantToDetails) {
      try {
        console.log(`[Mailer]: Auto-dispatching package & feature email to ${detectedEmail}...`);
        await sendPackageAndFeatureEmail(detectedEmail);
        emailDeliveryNote = `\n\n[SYSTEM UPDATE: The official GymStack package and feature details email was JUST successfully delivered to ${detectedEmail}. Confirm this warmly in 1-2 friendly sentences, tell them to check their inbox and promotions folder, and ask if they would like a quick live demo.]`;
      } catch (err) {
        console.error(`[Mailer Error]:`, err.message);
        emailDeliveryNote = `\n\n[SYSTEM UPDATE: Failed to send email to ${detectedEmail}. Politely ask the customer to double-check their email address.]`;
      }
    }
  }

  // --- FEATURE 1: Instant Lead Alert to Admin ---
  if (!notifiedLeadJids.has(jid)) {
    const rawText = userMessage.toLowerCase();
    const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '');

    const gymNameMatch =
      userMessage.match(/(?:gym\s*name\s*is|gym\s*ka\s*naam\s*hai|mera\s*gym)\s*[:=]?\s*([a-zA-Z0-9\s]{2,30})/i) ||
      userMessage.match(/([a-zA-Z0-9\s]{2,25}\s+gym)/i);

    const memberMatch = userMessage.match(/(\d+)\s*(?:member|members|active member|log)/i);

    const isHotInquiry =
      gymNameMatch ||
      memberMatch ||
      emailMatch ||
      /demo|pricing|package|cost|price|software|biometric/.test(rawText);

    if (isHotInquiry) {
      const extractedGymName = gymNameMatch ? gymNameMatch[1]?.trim() : 'Not mentioned';
      const extractedMembers = memberMatch ? memberMatch[1] : 'Not mentioned';

      notifiedLeadJids.add(jid);
      sendAdminLeadNotification({
        phone,
        gymName: extractedGymName,
        members: extractedMembers,
        email: emailMatch ? emailMatch[0] : 'Not provided yet',
        notes: userMessage,
      }).catch((e) => console.error('[Admin Alert Error]:', e.message));
    }
  }

  // --- FEATURE 2: Detect Brochure / Image / PDF Request ---
  const isBrochureRequested =
    /brochure|pdf|catalog|catalogue|pamphlet|image|photo|pic|card/.test(
      userMessage.toLowerCase()
    ) &&
    /send|share|give|bhej|de do|chaahiye|want|need|mil|attach|download|karo|dikhao|dekho/.test(
      userMessage.toLowerCase()
    );

  let brochureDeliveryNote = '';
  if (isBrochureRequested) {
    brochureDeliveryNote = `\n\n[SYSTEM UPDATE: The GymStack Product Brochure Image is being attached directly to this WhatsApp message so the customer can view it inline. Confirm cheerfully to the customer that you've attached the visual brochure right below in the chat, and ask how many members they currently have at their gym.]`;
  }

  // Format history for the Gemini API
  const contents = history.map((msg, index) => {
    let text = msg.text;
    // Append context updates to the latest user message
    if (index === history.length - 1) {
      if (emailDeliveryNote) text += emailDeliveryNote;
      if (brochureDeliveryNote) text += brochureDeliveryNote;
    }
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text }],
    };
  });

  // Candidate models with automatic fallback in case of high demand (503) or unavailability
  const candidateModels = [
    config.geminiModel,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ].filter((v, i, a) => a.indexOf(v) === i); // unique

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: buildSystemPrompt(userMessage),
          temperature: 0.75,
          maxOutputTokens: 1000,
        },
      });

      const replyText = response.text ? response.text.trim() : '';

      if (replyText) {
        // Save bot reply to history
        history.push({ role: 'model', text: replyText });
        return {
          text: replyText,
          sendBrochurePdf: isBrochureRequested,
          toString() {
            return this.text;
          },
        };
      }
    } catch (error) {
      lastError = error;
      // If 503 (high demand) or 404 (model retired), wait 1200ms and try next model
      if (
        error.status === 503 ||
        error.status === 404 ||
        error.message?.includes('503') ||
        error.message?.includes('404') ||
        error.message?.includes('high demand')
      ) {
        console.warn(`[AI Warning]: ${modelName} unavailable (${error.status || error.message}). Trying backup model...`);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      throw error;
    }
  }

  // Graceful fallback if email was sent but all models experienced momentary 503 spike
  if (emailDeliveryNote && emailMatch) {
    const fallbackEmailReply = `I have just sent the complete GymStack package and feature details to your email (${emailMatch[0]})! 📩 Please check your inbox and promotions folder. Let me know if you have any questions or want to see a live demo!`;
    history.push({ role: 'model', text: fallbackEmailReply });
    return fallbackEmailReply;
  }

  console.error(`[AI Error for ${jid}]:`, lastError?.message || lastError);
  throw lastError;
}

/**
 * Clear memory for a specific chat or all chats
 */
export function clearMemory(jid = null) {
  if (jid) {
    conversationMemory.delete(jid);
  } else {
    conversationMemory.clear();
  }
}
