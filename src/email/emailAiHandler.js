import { GoogleGenAI } from '@google/genai';
import { config } from '../../config.js';
import { retrieveRelevantKnowledge } from '../knowledge/rag.js';
import db, {
  recordLeadEmail,
  updateLeadEmail,
  getLeadById,
  updateLeadStatus,
  normalizeString
} from '../database/db.js';
import { sendEmail } from './emailService.js';
import { buildEmail, isAuthorizedSender } from './emailTemplates.js';

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set in your .env file!');
    }
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return aiClient;
}

/**
 * Finds or associates an inbound email with an existing lead
 */
export function findLeadForInboundEmail({ fromEmail, inReplyTo, subject }) {
  if (!fromEmail) return null;
  const cleanEmail = fromEmail.toLowerCase().trim();

  // 1. Check by matching inReplyTo with an outbound email
  if (inReplyTo) {
    const parentEmail = db.prepare('SELECT leadId FROM lead_emails WHERE messageId = ? AND leadId IS NOT NULL').get(inReplyTo);
    if (parentEmail && parentEmail.leadId) {
      const lead = getLeadById(parentEmail.leadId);
      if (lead) return lead;
    }
  }

  // 2. Check direct businessEmail match in leads table
  let lead = db.prepare('SELECT * FROM leads WHERE LOWER(businessEmail) = ? LIMIT 1').get(cleanEmail);
  if (lead) return lead;

  // 3. Check normalized email
  const normEmail = normalizeString(cleanEmail);
  lead = db.prepare('SELECT * FROM leads WHERE normalizedEmail = ? LIMIT 1').get(normEmail);
  if (lead) return lead;

  return null;
}

/**
 * Classifies the intent of an inbound email using Gemini
 */
export async function classifyEmailIntent(emailText, subject = '') {
  const combined = `Subject: ${subject}\n\n${emailText}`.toLowerCase();

  // Fast-path keywords for opt-outs
  if (
    combined.includes('unsubscribe') ||
    combined.includes('stop') ||
    combined.includes('remove me') ||
    combined.includes('not interested') ||
    combined.includes('do not email')
  ) {
    return 'Opt_Out';
  }

  try {
    const ai = getAiClient();
    const prompt = `
Analyze this incoming email reply from a gym owner / prospect and classify their intent into exactly ONE category from this list:
- Opt_Out (prospect wants to unsubscribe, stop receiving emails, or is completely not interested)
- Meeting_Requested (prospect wants a demo, call, meeting, consultation, or time to talk)
- Pricing_Inquiry (prospect asks about costs, subscription plans, fees, or discounts)
- Product_Inquiry (prospect asks about specific features, biometrics, mobile app, member limits, or migration)
- Interested (prospect expresses general interest, asks to know more, or wants a trial)
- Question (prospect asks general operational questions)
- Unknown (cannot determine or spam)

Return ONLY the single category name, with no quotes or extra text.

EMAIL:
Subject: ${subject}
Body:
${emailText}
    `.trim();

    const response = await ai.models.generateContent({
      model: config.geminiModel || 'gemini-3.5-flash-lite',
      contents: prompt,
    });

    const classification = response.text?.trim() || 'Question';
    const validIntents = ['Opt_Out', 'Meeting_Requested', 'Pricing_Inquiry', 'Product_Inquiry', 'Interested', 'Question', 'Unknown'];
    return validIntents.includes(classification) ? classification : 'Question';
  } catch (err) {
    console.warn('[Email AI Handler] Intent classification fallback to rule-based:', err.message);
    if (combined.includes('demo') || combined.includes('call') || combined.includes('meet') || combined.includes('timing')) {
      return 'Meeting_Requested';
    }
    if (combined.includes('price') || combined.includes('cost') || combined.includes('charge') || combined.includes('rate')) {
      return 'Pricing_Inquiry';
    }
    if (combined.includes('feature') || combined.includes('biometric') || combined.includes('app') || combined.includes('attendance')) {
      return 'Product_Inquiry';
    }
    return 'Question';
  }
}

/**
 * Generates grounded AI response to prospect inquiry using Dynamic RAG
 */
export async function generateEmailReply({ lead, inboundText, subject, intent, fromEmail = 'sales@gymstack.in' }) {
  const gymName = lead?.gymName || 'your gym';
  const ownerName = lead?.ownerName || 'there';

  // RAG retrieval based on prospect's actual questions
  const rag = retrieveRelevantKnowledge(inboundText);
  const ai = getAiClient();

  const systemInstruction = `
You are the AI Sales & Support Executive for GymStack (gymstack.in) writing an email reply.
Company: GymStack Technologies.
Sender email: ${fromEmail}.
Prospect: ${ownerName} from ${gymName}.
Inquiry Intent: ${intent}.

RULES:
1. Reply professionally, concisely, and politely.
2. Rely strictly on the VERIFIED GYMSTACK KNOWLEDGE provided below.
3. NEVER invent or claim unsupported features.
4. If asked about pricing: Starter is ₹499/mo, Gold is ₹2,700/mo, Diamond is custom. Mention free 30-day trial (https://gymstack.in/register).
5. If asked for a demo or meeting: Provide the Google Meet booking link (https://gymstack.in/book-demo) or suggest scheduling a 15-minute screen share.
6. Format response with clean paragraphs. Do not use markdown headers (no # or ##), keep it natural like a high-touch email.
7. End with a polite sign-off:
Best regards,
GymStack Team
https://gymstack.in

VERIFIED KNOWLEDGE:
${rag.formattedContext}
  `.trim();

  const userPrompt = `
Incoming Email:
Subject: ${subject}
Message:
${inboundText}

Please write the email response body. Do not include subject line or header wrapper, only the email body paragraphs.
  `.trim();

  const response = await ai.models.generateContent({
    model: config.geminiModel || 'gemini-3.5-flash-lite',
    contents: [
      { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
    ]
  });

  return response.text?.trim() || `Thank you for reaching out, ${ownerName}! We received your inquiry regarding GymStack for ${gymName}. You can explore our complete features and start your 30-day free trial at https://gymstack.in/register. Let us know if you would like a quick live walkthrough!`;
}

/**
 * Processes an incoming email end-to-end:
 * 1. Matches or creates lead
 * 2. Classifies intent
 * 3. Records inbound email
 * 4. Executes appropriate sales action (Opt-out, Meeting, or AI Answer)
 * 5. Updates CRM status
 */
export async function processInboundEmail({
  fromEmail,
  toEmail = 'sales@gymstack.in',
  subject = '',
  bodyText = '',
  bodyHtml = '',
  messageId = null,
  inReplyTo = null,
  references = null
}) {
  console.log(`📥 [Email Agent] Processing incoming email from: ${fromEmail} | Subject: "${subject}"`);

  // Find lead in CRM
  let lead = findLeadForInboundEmail({ fromEmail, inReplyTo, subject });
  const leadId = lead ? lead.id : null;

  // Classify Intent
  const intent = await classifyEmailIntent(bodyText || bodyHtml, subject);
  console.log(`🎯 [Email Agent] Detected intent: ${intent} for lead: ${lead?.gymName || fromEmail}`);

  // Record inbound email in lead_emails
  const inboundRecord = recordLeadEmail({
    leadId,
    campaignId: null,
    fromEmail,
    toEmail,
    subject,
    bodyHtml: bodyHtml || `<p>${bodyText}</p>`,
    bodyText,
    direction: 'inbound',
    status: 'replied',
    intent,
    messageId,
    inReplyTo,
    referencesHeader: references
  });

  // Action 1: Opt-Out / Stop
  if (intent === 'Opt_Out') {
    if (leadId) {
      updateLeadStatus(leadId, 'Unsubscribed');
      console.log(`🛑 [Email Agent] Lead #${leadId} (${lead.gymName}) marked as Unsubscribed.`);
    }

    // Send opt-out confirmation email
    const replySubject = `Unsubscribed: GymStack Communications`;
    const replyBody = `Hello,\n\nYou have been successfully unsubscribed and removed from GymStack's outreach list. You will not receive any further communications from us.\n\nBest regards,\nGymStack Support Team\nhttps://gymstack.in`;

    await sendEmail({
      to: fromEmail,
      from: toEmail,
      subject: replySubject,
      text: replyBody,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #334155;"><p>Hello,</p><p>You have been successfully unsubscribed and removed from GymStack's outreach list. You will not receive any further communications from us.</p><p>Best regards,<br><strong>GymStack Support Team</strong><br><a href="https://gymstack.in">gymstack.in</a></p></div>`,
      leadId,
      inReplyTo: messageId,
      references: messageId,
      intent: 'Opt_Out'
    });

    return {
      status: 'unsubscribed',
      leadId,
      intent,
      inboundRecordId: inboundRecord.id
    };
  }

  // Action 2: Meeting Requested & Automatic Scheduling Flow
  if (intent === 'Meeting_Requested' || (lead && (lead.status === 'Meeting Requested' || lead.status === 'Meeting Scheduled'))) {
    const { processSchedulingTurn } = await import('../calendar/schedulingStateMachine.js');
    const schedulingResult = await processSchedulingTurn({
      lead: lead || { gymName: 'your gym', ownerName: 'there', businessEmail: fromEmail },
      incomingText: bodyText || bodyHtml,
      channel: 'email',
      senderEmail: fromEmail
    });

    const replyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 600px;">
        ${schedulingResult.replyText.split('\n\n').map(p => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
        <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          GymStack Technologies Pvt Ltd • https://gymstack.in • sales@gymstack.in
        </div>
      </div>
    `;

    const reply = await sendEmail({
      to: fromEmail,
      from: toEmail,
      subject: `Re: ${subject.replace(/^re:\s*/i, '')}`,
      html: replyHtml,
      text: schedulingResult.replyText,
      leadId,
      inReplyTo: messageId,
      references: messageId,
      intent: 'Meeting_Requested'
    });

    return {
      status: schedulingResult.action,
      leadId,
      intent,
      inboundRecordId: inboundRecord.id,
      outboundEmailId: reply.id,
      meeting: schedulingResult.meeting
    };
  }

  // Action 3: General Question, Product Inquiry, or Pricing
  if (leadId) {
    updateLeadStatus(leadId, 'Responded');
  }

  // Generate grounded AI response
  const aiAnswerText = await generateEmailReply({
    lead,
    inboundText: bodyText || bodyHtml,
    subject,
    intent,
    fromEmail: toEmail
  });

  const replyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 600px;">
      ${aiAnswerText.split('\n\n').map(p => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
      <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        GymStack Technologies Pvt Ltd • https://gymstack.in • sales@gymstack.in<br>
        To opt out of future emails, reply STOP or UNSUBSCRIBE.
      </div>
    </div>
  `;

  const reply = await sendEmail({
    to: fromEmail,
    from: toEmail,
    subject: `Re: ${subject.replace(/^re:\s*/i, '')}`,
    html: replyHtml,
    text: aiAnswerText,
    leadId,
    inReplyTo: messageId,
    references: messageId,
    intent
  });

  return {
    status: 'replied',
    leadId,
    intent,
    inboundRecordId: inboundRecord.id,
    outboundEmailId: reply.id
  };
}
