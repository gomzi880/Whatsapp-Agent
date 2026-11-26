import nodemailer from 'nodemailer';
import { config } from './config.js';
import { gymStackKnowledge } from './knowledge.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

/**
 * Builds a clean, professional HTML email containing ONLY GymStack packages and features
 */
function buildPackageEmailHtml() {
  const k = gymStackKnowledge;

  const packagesHtml = k.packages
    .map(
      (pkg) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #f8fafc;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">${pkg.name} — <span style="color: #2563eb;">${pkg.price}</span></h3>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 12px;"><strong>Best for:</strong> ${pkg.idealFor}</p>
        <ul style="color: #334155; font-size: 14px; line-height: 1.6; padding-left: 20px;">
          ${pkg.features.map((f) => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `
    )
    .join('');

  const featuresHtml = k.keyFeatures
    .map(
      (f) => `
      <li style="margin-bottom: 10px; color: #334155;">
        <strong style="color: #0f172a;">${f.name}:</strong> ${f.details}
      </li>
    `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>GymStack - Package & Feature Details</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
    <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 30px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">GymStack</h1>
        <p style="margin: 8px 0 0 0; font-size: 15px; opacity: 0.9;">${k.company.tagline}</p>
      </div>

      <!-- Content -->
      <div style="padding: 30px;">
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Hello,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Thank you for inquiring about <strong>GymStack</strong> on WhatsApp! Below are the complete package options and core features to help you automate and grow your gym.
        </p>

        <!-- Packages Section -->
        <h2 style="font-size: 20px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">
          📦 Subscription Packages & Pricing
        </h2>
        ${packagesHtml}

        <!-- Features Section -->
        <h2 style="font-size: 20px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">
          ⚡ Core System Features
        </h2>
        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.6;">
          ${featuresHtml}
        </ul>

        <!-- Free Trial CTA -->
        <div style="text-align: center; margin: 40px 0 20px 0; padding: 25px; background: #eff6ff; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #1e3a8a; font-size: 18px;">Start Your 30-Day Free Trial Today</h3>
          <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">No credit card required. Full unrestricted access to test member registrations, attendance, and WhatsApp reminders.</p>
          <a href="${k.company.demoLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Register Free Trial Now
          </a>
        </div>

        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-top: 30px;">
          Need a quick 1-on-1 demo or have questions about migrating your existing member data? Feel free to reply to this email or chat with us on WhatsApp at <strong>${k.company.supportPhone}</strong>.
        </p>

        <p style="font-size: 14px; color: #334155; margin-top: 25px;">
          Warm regards,<br>
          <strong>Sales & Support Team</strong><br>
          GymStack — <a href="${k.company.website}" style="color: #2563eb;">${k.company.website}</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
        © ${new Date().getFullYear()} GymStack. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Sends the official GymStack package & feature email to the customer
 * @param {string} recipientEmail Customer's email address
 * @returns {Promise<boolean>}
 */
export async function sendPackageAndFeatureEmail(recipientEmail) {
  const mail = getTransporter();

  const mailOptions = {
    from: `"GymStack Sales" <${config.smtp.user}>`,
    to: recipientEmail.trim(),
    subject: 'GymStack - Complete Package & Feature Details',
    html: buildPackageEmailHtml(),
  };

  try {
    const info = await mail.sendMail(mailOptions);
    console.log(`📧 Package details email sent successfully to ${recipientEmail} (MessageId: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${recipientEmail}:`, error.message);
    throw error;
  }
}

/**
 * Sends an instant lead notification alert to the GymStack Admin / Owner
 * @param {object} leadData Information about the captured lead
 */
export async function sendAdminLeadNotification(leadData) {
  const mail = getTransporter();
  const phone = (leadData.phone || 'Unknown').replace(/[^0-9]/g, '');
  const gymName = leadData.gymName || 'Not mentioned';
  const members = leadData.members || 'Not mentioned';
  const email = leadData.email || 'Not provided yet';
  const notes = leadData.notes || 'Inquired on WhatsApp';
  const waLink = `https://wa.me/${phone}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">🔥 Hot New GymStack Lead!</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">A gym owner is actively inquiring on WhatsApp</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569; width: 35%;">WhatsApp Number:</td>
              <td style="padding: 12px; color: #0f172a;"><a href="${waLink}" style="color: #2563eb; font-weight: bold; text-decoration: none;">+${phone} 💬</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Gym Name:</td>
              <td style="padding: 12px; color: #0f172a; font-weight: bold;">${gymName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Member Count:</td>
              <td style="padding: 12px; color: #0f172a;">${members}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Email ID:</td>
              <td style="padding: 12px; color: #0f172a;">${email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Latest Inquiry:</td>
              <td style="padding: 12px; color: #334155; font-style: italic;">"${notes}"</td>
            </tr>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${waLink}" style="background-color: #25D366; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">
              💬 Open WhatsApp Chat with Lead
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8;">
          Sent by GymStack AI Assistant Alert System
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mail.sendMail({
      from: `"GymStack Lead Alert" <${config.smtp.user}>`,
      to: config.adminEmail,
      subject: `🔥 New Lead Alert: ${gymName !== 'Not mentioned' ? gymName : '+' + phone} (${members !== 'Not mentioned' ? members + ' members' : 'WhatsApp Inquiry'})`,
      html,
    });
    console.log(`🚨 Admin Lead Notification sent for ${phone} (MessageId: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`Failed to send Admin Lead Notification:`, err.message);
    return false;
  }
}
