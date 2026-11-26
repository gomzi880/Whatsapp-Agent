import { config } from '../../config.js';
import db from '../database/db.js';

/**
 * Notify administrator about high-value prospects (Interested in Purchasing / Pricing Concern)
 */
export async function notifyAdminHighValueLead(lead, feedback, meeting = null) {
  const alertSubject = `🔥 HIGH-VALUE PROSPECT ALERT: ${lead.gymName} (${feedback.feedbackCategory})`;
  
  const alertMessage = `High-Value Prospect Detected!

Gym: ${lead.gymName}
Owner / Contact: ${lead.ownerName || 'Not specified'}
Phone / WhatsApp: ${lead.whatsappNumber || lead.phone || 'N/A'}
Email: ${lead.email || 'N/A'}
Location: ${lead.city || ''}, ${lead.state || ''}, ${lead.country || ''}

Feedback Category: ${feedback.feedbackCategory}
Sentiment: ${feedback.sentiment || 'Positive'}
Rating: ${feedback.rating || 5}/5
Purchase Interest: ${feedback.purchaseInterest || 'Yes'}
Pricing Discussion Requested: ${feedback.pricingDiscussionRequested ? 'YES' : 'No'}

Prospect Message:
"${feedback.rawResponseText || 'Expressed strong interest during demonstration'}"

Liked Features: ${feedback.likedFeatures || 'All features'}
Improvements / Notes: ${feedback.improvements || 'None'}
Questions Asked: ${feedback.questions || 'None'}

Please reach out directly or schedule an immediate closing conversation.`;

  console.log(`[Admin Notifier] ${alertSubject}`);
  console.log(alertMessage);

  // Check if admin email or whatsapp is available to send
  const adminEmail = config.adminEmail || 'sales@gymstack.in';
  let emailSent = false;
  let whatsappSent = false;

  try {
    const { emailSender } = await import('../email/emailSender.js');
    if (emailSender && emailSender.isConfigured && emailSender.isConfigured()) {
      await emailSender.sendEmail({
        from: 'sales@gymstack.in',
        to: adminEmail,
        subject: alertSubject,
        text: alertMessage,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; border: 2px solid #10b981; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #10b981; color: white; padding: 15px; font-weight: bold; font-size: 18px;">
    🔥 High-Value Prospect Alert
  </div>
  <div style="padding: 20px; line-height: 1.6; color: #1f2937;">
    <h3 style="margin-top: 0; color: #111827;">${lead.gymName}</h3>
    <p><strong>Contact:</strong> ${lead.ownerName || 'N/A'} | <strong>Phone:</strong> ${lead.whatsappNumber || lead.phone || 'N/A'} | <strong>Email:</strong> ${lead.email || 'N/A'}</p>
    <p><strong>Category:</strong> <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${feedback.feedbackCategory}</span></p>
    <p><strong>Purchase Interest:</strong> ${feedback.purchaseInterest || 'Yes'} | <strong>Pricing Discussion:</strong> ${feedback.pricingDiscussionRequested ? 'Requested' : 'No'}</p>
    <div style="background: #f3f4f6; padding: 12px; border-left: 4px solid #10b981; margin: 15px 0;">
      <em>"${feedback.rawResponseText || 'Direct feedback received'}"</em>
    </div>
    <p style="font-size: 13px; color: #6b7280;">Action Required: Follow up with prospect to finalize proposal and onboarding.</p>
  </div>
</div>`
      });
      emailSent = true;
    }
  } catch (err) {
    console.warn('[Admin Notifier] Failed to send email alert to admin:', err.message);
  }

  // Update adminNotified flag in feedbacks table
  if (feedback.id) {
    try {
      db.updateFeedback(feedback.id, { adminNotified: 1 });
    } catch (e) {
      // Ignore if update helper isn't present
    }
  }

  return {
    alertSubject,
    emailSent,
    whatsappSent,
    adminNotified: true
  };
}

export default {
  notifyAdminHighValueLead
};
