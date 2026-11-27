import { GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import db, { updateLeadStatus, getLeadById, cancelPendingFollowUpsForLead, FEEDBACK_CATEGORIES } from '../database/db.js';

let ai = null;
if (config.geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
}

export const FEEDBACK_QUESTIONS = [
  'How was your Gym Stack demonstration?',
  'Which features did you like most?',
  'Which features would you like to improve?',
  'Do you have any questions?',
  'Are you interested in purchasing Gym Stack?',
  'Would you like to discuss pricing?'
];

/**
 * Generate polite 6-question feedback message for WhatsApp or Email
 */
export function generateFeedbackMessage(lead, meeting, channel = 'whatsapp') {
  const contactName = lead.ownerName || lead.gymName || 'Valued Partner';
  const gymName = lead.gymName || 'your fitness centre';

  if (channel === 'email') {
    return {
      subject: `Gym Stack Demo Feedback - ${gymName}`,
      text: `Hi ${contactName},

Thank you for taking the time to experience the Gym Stack demonstration! We hope it gave you a clear overview of how Gym Stack can automate memberships, attendance, billing, and member engagement for ${gymName}.

To help us serve you better, could you take a quick moment to share your thoughts?

1. How was your Gym Stack demonstration?
2. Which features did you like most?
3. Which features would you like to improve?
4. Do you have any questions regarding the setup or operations?
5. Are you interested in purchasing Gym Stack for ${gymName}?
6. Would you like to discuss custom pricing or plan options?

Simply reply directly to this email with your thoughts or any questions you have. We're here to assist you!

Best regards,
The Gym Stack Team
https://gymstack.in | info@gymstack.in`,
      html: `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;">
    <h2 style="margin: 0;">How was your Gym Stack Demo?</h2>
  </div>
  <div style="padding: 24px;">
    <p>Hi <strong>${contactName}</strong>,</p>
    <p>Thank you for taking the time to experience the <strong>Gym Stack</strong> demonstration! We hope it showed how easy it is to automate memberships, biometric attendance, billing, and member engagement for <strong>${gymName}</strong>.</p>
    <p>To help us serve you better, could you take a quick moment to answer a few quick questions?</p>
    <ol style="background: #f8fafc; padding: 20px 20px 20px 35px; border-radius: 6px; border-left: 4px solid #4f46e5;">
      <li style="margin-bottom: 8px;"><strong>How was your Gym Stack demonstration?</strong></li>
      <li style="margin-bottom: 8px;"><strong>Which features did you like most?</strong></li>
      <li style="margin-bottom: 8px;"><strong>Which features would you like to improve?</strong></li>
      <li style="margin-bottom: 8px;"><strong>Do you have any questions regarding setup or operations?</strong></li>
      <li style="margin-bottom: 8px;"><strong>Are you interested in purchasing Gym Stack for ${gymName}?</strong></li>
      <li style="margin-bottom: 0;"><strong>Would you like to discuss custom pricing or plan options?</strong></li>
    </ol>
    <p>Simply reply directly to this email with your feedback or any questions. We look forward to partnering with you!</p>
    <p style="margin-top: 30px;">Warm regards,<br><strong>The Gym Stack Team</strong><br><a href="https://gymstack.in" style="color: #4f46e5;">gymstack.in</a></p>
  </div>
</div>`
    };
  }

  // Default: WhatsApp formatted message
  return {
    text: `Hello ${contactName}! 👋

Thank you for attending the *Gym Stack* product demonstration for *${gymName}*! 🚀

We hope the walkthrough was insightful. Could you please take 60 seconds to share your quick feedback?

1️⃣ *How was your Gym Stack demonstration?*
2️⃣ *Which features did you like most?*
3️⃣ *Which features would you like to improve?*
4️⃣ *Do you have any questions?*
5️⃣ *Are you interested in purchasing Gym Stack?*
6️⃣ *Would you like to discuss pricing?*

Feel free to reply with your thoughts or voice your questions right here. We'd love to help you scale *${gymName}*! 🏋️‍♂️`
  };
}

/**
 * Classify a prospect's response into 1 of 7 categories and extract key feedback parameters
 */
export async function classifyFeedbackResponse(responseText) {
  if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
    return {
      category: 'Positive feedback',
      sentiment: 'Neutral',
      rating: 4,
      likedFeatures: '',
      improvements: '',
      questions: '',
      purchaseInterest: 'Undecided',
      pricingDiscussionRequested: false,
      promisedCallbackDate: null,
      isHighValue: false,
      summary: 'No response text provided'
    };
  }

  const prompt = `You are the Gym Stack Customer Feedback & Sales Intelligence AI.
Analyze the following post-demo response from a gym owner:

--- PROSPECT RESPONSE ---
"${responseText}"
--- END RESPONSE ---

MANDATORY INSTRUCTIONS:
1. Classify the response into EXACTLY ONE of these 7 categories:
   - "Positive feedback" (Praises software, liked the demo, impressed)
   - "Feature request" (Wants specific integrations, custom reports, mobile app feature, etc.)
   - "Pricing concern" (Thinks it's expensive, asks for discount, asks for custom quote, requests pricing discussion)
   - "Technical concern" (Asks about offline sync, hardware compatibility, biometric integration, data safety)
   - "Interested in purchasing" (Ready to buy, asks how to pay, wants onboarding started, asking for contract/agreement)
   - "Needs more time" (Wants to discuss with partner/owner, busy now, asked to contact next week/month)
   - "Not interested" (Explicitly says no, unneeded, using another tool and happy with it, asks to stop contacting)

2. Determine Sentiment: "Positive", "Neutral", or "Negative".
3. Estimate Rating (1 to 5) based on tone and satisfaction.
4. Extract liked features (if mentioned).
5. Extract improvements requested (if mentioned).
6. Extract questions (if asked).
7. Purchase Interest: "Yes", "No", "Maybe", or "Undecided".
8. Pricing Discussion Requested: true or false.
9. Promised Callback Date: If the prospect mentions a specific day, date or timeframe to contact them (e.g., "call me on Monday", "reach out on 10th December", "message next week"), normalize into a recognizable date string or description (e.g., "Monday", "2026-12-05", "Next week"), else null.
10. Is High Value: true if category is "Interested in purchasing" or "Pricing concern", or if Purchase Interest is "Yes" or Pricing Discussion is true.

Respond ONLY with valid JSON in this format:
{
  "category": "One of the 7 exact strings",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "rating": 1-5,
  "likedFeatures": "string or empty",
  "improvements": "string or empty",
  "questions": "string or empty",
  "purchaseInterest": "Yes" | "No" | "Maybe" | "Undecided",
  "pricingDiscussionRequested": boolean,
  "promisedCallbackDate": "string or null",
  "isHighValue": boolean,
  "summary": "Brief 1-line assessment"
}`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: config.geminiModel || 'gemini-2.5-flash-lite',
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      const parsed = JSON.parse(response.text.trim());
      // Validate category belongs to FEEDBACK_CATEGORIES
      if (!FEEDBACK_CATEGORIES.includes(parsed.category)) {
        parsed.category = matchCategoryFallback(responseText);
      }
      return parsed;
    } catch (err) {
      console.warn('Gemini feedback classification failed, using rule-based fallback:', err.message);
    }
  }

  return ruleBasedFeedbackClassification(responseText);
}

function matchCategoryFallback(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes('not interested') ||
    lower.includes('stop') ||
    lower.includes('unsubscribe') ||
    lower.includes("don't contact") ||
    lower.includes('do not contact') ||
    lower.includes("don't message") ||
    lower.includes('do not message') ||
    lower.includes('no thanks') ||
    lower.includes('manual register') ||
    lower.includes('no need')
  ) {
    return 'Not interested';
  }
  if (lower.includes('ready to buy') || lower.includes('buy') || lower.includes('purchase') || lower.includes('sign up') || lower.includes('contract') || lower.includes('start subscription')) {
    return 'Interested in purchasing';
  }
  if (lower.includes('price') || lower.includes('cost') || lower.includes('expensive') || lower.includes('discount') || lower.includes('quote') || lower.includes('charge')) {
    return 'Pricing concern';
  }
  if (lower.includes('partner') || lower.includes('next week') || lower.includes('later') || lower.includes('busy') || lower.includes('think about it') || lower.includes('time')) {
    return 'Needs more time';
  }
  if (lower.includes('feature') || lower.includes('would like') || lower.includes('can you add') || lower.includes('add integration') || lower.includes('improvement') || lower.includes('custom')) {
    return 'Feature request';
  }
  if (
    lower.includes('hardware problem') ||
    lower.includes('hardware issue') ||
    lower.includes('biometric issue') ||
    lower.includes('biometric problem') ||
    lower.includes('not working') ||
    lower.includes('offline') ||
    lower.includes('bug') ||
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('technical concern') ||
    lower.includes('technical issue')
  ) {
    return 'Technical concern';
  }
  if (lower.includes('amazing') || lower.includes('loved') || lower.includes('great') || lower.includes('good') || lower.includes('excellent') || lower.includes('wonderful')) {
    return 'Positive feedback';
  }
  return 'Positive feedback';
}

function ruleBasedFeedbackClassification(text) {
  const lower = text.toLowerCase();
  const category = matchCategoryFallback(text);
  
  let sentiment = 'Neutral';
  let rating = 3;
  let purchaseInterest = 'Undecided';
  let pricingDiscussion = false;
  let isHighValue = false;
  let promisedDate = null;

  if (category === 'Not interested') {
    sentiment = 'Negative';
    rating = 1;
    purchaseInterest = 'No';
  } else if (category === 'Interested in purchasing') {
    sentiment = 'Positive';
    rating = 5;
    purchaseInterest = 'Yes';
    isHighValue = true;
  } else if (category === 'Pricing concern') {
    sentiment = 'Neutral';
    rating = 3;
    pricingDiscussion = true;
    isHighValue = true;
    purchaseInterest = 'Maybe';
  } else if (category === 'Positive feedback') {
    sentiment = 'Positive';
    rating = 4;
  }

  // Check for callback cues
  const callbackMatch = text.match(/(call|contact|message|reach out|ping)\s+(me\s+)?(on|by|next|after)?\s*([a-zA-Z0-9\s]+)/i);
  if (callbackMatch && (lower.includes('call') || lower.includes('contact') || lower.includes('reach'))) {
    promisedDate = callbackMatch[4] ? callbackMatch[4].trim().slice(0, 30) : 'Requested future date';
  }

  return {
    category,
    sentiment,
    rating,
    likedFeatures: lower.includes('liked') || lower.includes('great') ? 'General features & demo' : '',
    improvements: lower.includes('improve') || lower.includes('add') ? text.slice(0, 100) : '',
    questions: text.includes('?') ? text : '',
    purchaseInterest,
    pricingDiscussionRequested: pricingDiscussion,
    promisedCallbackDate: promisedDate,
    isHighValue,
    summary: `Rule-classified as ${category} (${sentiment})`
  };
}

/**
 * Process inbound feedback reply, persist to database, update lead status and handle triggers
 */
export async function processInboundFeedback({ lead, responseText, channel = 'whatsapp', meetingId = null }) {
  if (!lead) throw new Error('Lead is required to process feedback');

  const classification = await classifyFeedbackResponse(responseText);

  // Store in database
  const feedbackRecord = db.recordFeedback({
    leadId: lead.id,
    meetingId: meetingId || null,
    gymName: lead.gymName,
    ownerName: lead.ownerName,
    channel,
    rating: classification.rating,
    likedFeatures: classification.likedFeatures,
    improvements: classification.improvements,
    questions: classification.questions,
    purchaseInterest: classification.purchaseInterest,
    pricingDiscussionRequested: classification.pricingDiscussionRequested,
    feedbackCategory: classification.category,
    sentiment: classification.sentiment,
    rawResponseText: responseText,
    highValueProspect: classification.isHighValue
  });

  // Action based on category
  if (classification.category === 'Not interested') {
    // Respect opt-out: unsubscribe lead and cancel pending follow-ups
    updateLeadStatus(lead.id, 'Unsubscribed');
    cancelPendingFollowUpsForLead(lead.id);
    console.log(`[Feedback] Lead #${lead.id} (${lead.gymName || ''}) opted out. Marked Unsubscribed, cancelled follow-ups.`);
  } else if (classification.isHighValue) {
    // High-value prospect alert
    updateLeadStatus(lead.id, 'Interested');
    console.log(`[Feedback] HIGH-VALUE PROSPECT: Lead #${lead.id} (${lead.gymName}) marked Interested! Category: ${classification.category}`);
  } else if (classification.category === 'Needs more time' || classification.promisedCallbackDate) {
    // Schedule a reminder based on promised callback or 5 days out
    const callbackTarget = classification.promisedCallbackDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.createFollowUp({
      leadId: lead.id,
      meetingId: meetingId || null,
      feedbackId: feedbackRecord.id,
      scheduledDate: callbackTarget.includes('-') ? callbackTarget : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      scheduledTime: '11:00 AM',
      channel,
      followUpType: 'Promised Callback',
      customMessage: `Gentle check-in regarding Gym Stack discussion as requested on ${callbackTarget}.`,
      promisedCallbackDate: classification.promisedCallbackDate || callbackTarget
    });
    console.log(`[Feedback] Follow-up scheduled for lead #${lead.id} on ${callbackTarget} (Text reminder only, no voice calls).`);
  }

  return {
    feedback: feedbackRecord,
    classification
  };
}

export const recordCustomerFeedback = processInboundFeedback;

export default {
  FEEDBACK_QUESTIONS,
  generateFeedbackMessage,
  classifyFeedbackResponse,
  processInboundFeedback,
  recordCustomerFeedback
};
