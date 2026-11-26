import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import { isAuthorizedSender, AUTHORIZED_SENDERS } from './emailTemplates.js';
import { recordLeadEmail, updateLeadEmail, getLeadById, updateLeadStatus } from '../database/db.js';
import { getBrochureAttachment } from './brochureService.js';

// Cache transporters per sender address
const transporters = new Map();

/**
 * Returns a configured nodemailer transporter for the given sender email
 */
export function getTransporterForSender(fromEmail = 'sales@gymstack.in') {
  const safeFrom = isAuthorizedSender(fromEmail) ? fromEmail.toLowerCase().trim() : 'sales@gymstack.in';

  if (!transporters.has(safeFrom)) {
    const t = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    transporters.set(safeFrom, t);
  }

  return transporters.get(safeFrom);
}

/**
 * Verifies SMTP connection
 */
export async function verifySmtpConnection(fromEmail = 'sales@gymstack.in') {
  try {
    const transporter = getTransporterForSender(fromEmail);
    await transporter.verify();
    return { ok: true, message: 'SMTP connection verified successfully' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sends a single email with safety checks and records to DB
 */
export async function sendEmail({
  to,
  from = 'sales@gymstack.in',
  subject,
  html,
  text,
  attachments = [],
  leadId = null,
  campaignId = null,
  inReplyTo = null,
  references = null,
  intent = null,
  status = 'sent'
}) {
  const safeFrom = isAuthorizedSender(from) ? from.toLowerCase().trim() : 'sales@gymstack.in';

  // Safety Check: Verify lead is not unsubscribed
  if (leadId) {
    const lead = getLeadById(leadId);
    if (lead && (lead.status === 'Unsubscribed' || lead.status === 'Not Interested')) {
      throw new Error(`Outreach blocked: Lead #${leadId} has status "${lead.status}" (Opt-Out).`);
    }
  }

  if (!to || !to.includes('@')) {
    throw new Error(`Invalid recipient email address: "${to}".`);
  }

  const transporter = getTransporterForSender(safeFrom);

  const mailOptions = {
    from: `"GymStack" <${safeFrom}>`,
    to: to.trim(),
    subject: subject.trim(),
    html,
    text: text || '',
    attachments,
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
  }
  if (references) {
    mailOptions.references = references;
  }

  // Record initial pending log
  const emailLog = recordLeadEmail({
    leadId,
    campaignId,
    fromEmail: safeFrom,
    toEmail: to.trim(),
    subject,
    bodyHtml: html,
    bodyText: text,
    direction: 'outbound',
    status: 'pending',
    intent,
    hasAttachment: attachments.length > 0,
    attachmentName: attachments.map(a => a.filename || 'attachment').join(', ') || null,
    inReplyTo,
    referencesHeader: references
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Update log with success status and messageId
    updateLeadEmail(emailLog.id, {
      status: 'sent',
      messageId: info.messageId || null,
    });

    // Update lead status to Contacted if still New or Qualified
    if (leadId) {
      const currentLead = getLeadById(leadId);
      if (currentLead && ['New', 'Qualified', 'Ready for Outreach'].includes(currentLead.status)) {
        updateLeadStatus(leadId, 'Contacted');
      }
    }

    return {
      success: true,
      id: emailLog.id,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response
    };
  } catch (err) {
    updateLeadEmail(emailLog.id, {
      status: 'failed',
      errorMessage: err.message
    });

    return {
      success: false,
      id: emailLog.id,
      error: err.message
    };
  }
}

/**
 * Sends a product brochure email with PDF attachment
 */
export async function sendBrochureEmail({ leadId, to, ownerName, gymName, from = 'sales@gymstack.in' }) {
  const brochure = await getBrochureAttachment();
  const { buildEmail } = await import('./emailTemplates.js');
  
  const template = buildEmail({
    templateType: 'product_details',
    lead: { id: leadId, ownerName, gymName },
    fromEmail: from
  });

  return sendEmail({
    to,
    from,
    subject: template.subject,
    html: template.html,
    text: template.text,
    attachments: [brochure],
    leadId,
    templateType: 'product_details'
  });
}
