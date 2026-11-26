/**
 * Dual WhatsApp & Email Meeting Confirmation Engine
 * 
 * Delivers instant confirmations and reminders through both channels:
 * - WhatsApp confirmation via Baileys socket with Google Meet link
 * - Branded HTML Email confirmation with Google Calendar link and .ics iCalendar invite
 * - 24-hour and 1-hour automated reminders
 */

import { sendWhatsAppMessage, isWhatsAppConnected } from '../outreach/outreachService.js';
import { sendEmail } from '../email/emailService.js';
import { generateGoogleCalendarUrl, generateIcsInvite, formatTime12h } from './googleCalendarService.js';
import { updateMeeting, getMeetingById } from '../database/db.js';

/**
 * Sends meeting confirmation via WhatsApp
 */
export async function sendWhatsAppMeetingConfirmation(meeting) {
  if (!meeting.whatsappNumber) {
    console.log(`ℹ️ [Meeting Notifier] No WhatsApp number for meeting #${meeting.id}. Skipping WhatsApp confirmation.`);
    return { success: false, reason: 'no_whatsapp_number' };
  }

  const time12 = formatTime12h(meeting.startTime);
  const gymName = meeting.gymName || 'your gym';
  const ownerName = meeting.ownerName || 'there';

  const text = `🎉 *GymStack Demo Walkthrough Confirmed!*

Hello ${ownerName}! Your 1-on-1 personalized demonstration for *${gymName}* is locked in.

📅 *Date:* ${meeting.meetingDate}
⏰ *Time:* ${time12} (${meeting.timeZone})
🔗 *Google Meet:* ${meeting.meetingLink}

*Agenda (15-20 mins):*
• Member management & digital registration
• Biometric attendance & turnstile integration
• Automated WhatsApp fee collection with UPI links
• Multi-branch analytics & free member data migration

👉 *Add to Google Calendar:*
${meeting.googleCalendarUrl}

Need to reschedule or invite a colleague? Simply reply to this chat anytime. See you then!`;

  try {
    if (isWhatsAppConnected()) {
      await sendWhatsAppMessage(meeting.whatsappNumber, text);
      console.log(`✅ [Meeting Notifier] WhatsApp confirmation delivered to ${meeting.whatsappNumber}`);
      return { success: true, channel: 'whatsapp' };
    } else {
      console.log(`⚠️ [Meeting Notifier] WhatsApp not connected. Stored message for meeting #${meeting.id}.`);
      return { success: false, reason: 'whatsapp_offline' };
    }
  } catch (err) {
    console.error(`❌ [Meeting Notifier] WhatsApp confirmation error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends meeting confirmation via Email with iCalendar (.ics) attachment
 */
export async function sendEmailMeetingConfirmation(meeting) {
  if (!meeting.email) {
    console.log(`ℹ️ [Meeting Notifier] No email for meeting #${meeting.id}. Skipping email confirmation.`);
    return { success: false, reason: 'no_email' };
  }

  const time12 = formatTime12h(meeting.startTime);
  const gymName = meeting.gymName || 'your fitness facility';
  const ownerName = meeting.ownerName || 'there';

  const icsContent = generateIcsInvite({
    title: `GymStack Demo: 1-on-1 Walkthrough for ${gymName}`,
    description: `Personalized walkthrough of GymStack gym management software for ${gymName}.`,
    meetingDate: meeting.meetingDate,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    meetingLink: meeting.meetingLink,
    organizerEmail: 'sales@gymstack.in',
    organizerName: 'GymStack Demo Team',
    attendeeEmail: meeting.email,
    attendeeName: ownerName
  });

  const subject = `Confirmed: GymStack Live Demo for ${gymName} — ${meeting.meetingDate} at ${time12}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 800;">GymStack Walkthrough Confirmed!</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; color: #bfdbfe;">Your 1-on-1 session is scheduled</p>
    </div>

    <!-- Details Box -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
      <p>Thank you for scheduling a live demonstration of <strong>GymStack</strong> for <strong>${gymName}</strong>. We look forward to meeting you!</p>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin-top: 0; margin-bottom: 12px; color: #1e3a8a; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Meeting Details</h3>
        <p style="margin: 6px 0; font-size: 14px;">📅 <strong>Date:</strong> ${meeting.meetingDate}</p>
        <p style="margin: 6px 0; font-size: 14px;">⏰ <strong>Time:</strong> ${time12} (${meeting.timeZone})</p>
        <p style="margin: 6px 0; font-size: 14px;">📍 <strong>Platform:</strong> Google Meet / Screen Share</p>
        <p style="margin: 12px 0 0 0; font-size: 14px;">
          🔗 <strong>Join Link:</strong> <a href="${meeting.meetingLink}" style="color: #2563eb; font-weight: 700; text-decoration: underline;">${meeting.meetingLink}</a>
        </p>
      </div>

      <!-- Quick Action Buttons -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${meeting.googleCalendarUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 14px; margin-right: 8px;">
          📅 Add to Google Calendar
        </a>
        <a href="${meeting.meetingLink}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 14px;">
          📹 Join Google Meet
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
        <em>An official calendar invite (.ics) has been attached to this email. You can open it to automatically add this meeting to your calendar.</em>
      </p>

      <!-- Agenda -->
      <h4 style="color: #0f172a; margin-top: 24px; font-size: 14px;">What we'll cover in 15-20 minutes:</h4>
      <ul style="font-size: 13px; color: #475569; padding-left: 20px; line-height: 1.6;">
        <li>Automating WhatsApp fee collection reminders with dynamic UPI links.</li>
        <li>Biometric fingerprint & facial recognition access control.</li>
        <li>Member profiles, digital receipts, and trainer payouts.</li>
        <li>Free member database migration and 30-day free trial setup.</li>
      </ul>

      <p style="font-size: 13px; color: #64748b; margin-top: 24px; margin-bottom: 0;">
        Need to change time or have questions? Simply reply directly to this email or WhatsApp us at <strong>+91 83588 26116</strong>.
      </p>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        GymStack Technologies Private Limited • Indore, MP, India • sales@gymstack.in
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Hi ${ownerName},\n\nYour GymStack live demo for ${gymName} is confirmed for ${meeting.meetingDate} at ${time12} (${meeting.timeZone}).\n\nJoin Google Meet: ${meeting.meetingLink}\nAdd to Google Calendar: ${meeting.googleCalendarUrl}\n\nSee you then!\nGymStack Team`;

  try {
    const result = await sendEmail({
      to: meeting.email,
      from: 'sales@gymstack.in',
      subject,
      html,
      text,
      attachments: [
        {
          filename: 'GymStack_Demo_Invite.ics',
          content: icsContent,
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        }
      ],
      leadId: meeting.leadId,
      intent: 'Meeting_Confirmed'
    });

    console.log(`✅ [Meeting Notifier] Email confirmation with .ics delivered to ${meeting.email}`);
    return { success: true, emailId: result.id, channel: 'email' };
  } catch (err) {
    console.error(`❌ [Meeting Notifier] Email confirmation error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches confirmations across both WhatsApp and Email simultaneously
 */
export async function dispatchDualMeetingConfirmation(meeting) {
  const [waResult, emailResult] = await Promise.allSettled([
    sendWhatsAppMeetingConfirmation(meeting),
    sendEmailMeetingConfirmation(meeting)
  ]);

  return {
    whatsapp: waResult.status === 'fulfilled' ? waResult.value : { success: false, error: waResult.reason?.message },
    email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason?.message }
  };
}

/**
 * Sends a 24-hour or 1-hour reminder
 */
export async function sendMeetingReminder(meetingId, reminderType = '24h') {
  const meeting = getMeetingById(meetingId);
  if (!meeting || meeting.status !== 'Scheduled') return;

  const time12 = formatTime12h(meeting.startTime);
  const timeDesc = reminderType === '24h' ? 'tomorrow' : 'in 1 hour';

  const reminderText = `⏰ *Reminder: GymStack Live Demo ${timeDesc}!*

Hello ${meeting.ownerName}! Just a quick reminder that your walkthrough for *${meeting.gymName}* is scheduled for ${meeting.meetingDate} at *${time12}* (${meeting.timeZone}).

🔗 *Join Google Meet:* ${meeting.meetingLink}

Looking forward to showing you the platform!`;

  if (meeting.whatsappNumber && isWhatsAppConnected()) {
    await sendWhatsAppMessage(meeting.whatsappNumber, reminderText).catch(() => {});
  }

  if (reminderType === '24h') {
    updateMeeting(meetingId, { reminderSent24h: 1 });
  } else {
    updateMeeting(meetingId, { reminderSent1h: 1 });
  }
}
