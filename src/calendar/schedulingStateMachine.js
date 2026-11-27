/**
 * Automatic Meeting Scheduling State Machine
 * 
 * Enforces the 12-Step Meeting Workflow:
 * 1. Identify the interested lead
 * 2. Ask their preferred meeting date
 * 3. Ask their preferred time
 * 4. Identify their time zone
 * 5. Check available calendar slots
 * 6. Offer suitable time slots
 * 7. Wait for the prospect's confirmation
 * 8. Create the meeting in Google Calendar
 * 9. Save the meeting against the lead
 * 10. Send confirmation through WhatsApp
 * 11. Send confirmation through email
 * 12. Send configured reminders
 * 
 * CRITICAL RULE: Never create or change a meeting without the required confirmation.
 */

import {
  createMeeting,
  updateMeeting,
  getMeetingById,
  getLeadMeetings,
  checkSlotAvailability,
  updateLeadStatus,
  resolvePhoneNumber,
  db
} from '../database/db.js';
import {
  generateGoogleMeetLink,
  generateGoogleCalendarUrl,
  getAvailableSlots,
  parseNaturalDate,
  parseNaturalTime,
  detectTimezone,
  formatTime12h,
  computeEndTime
} from './googleCalendarService.js';
import { dispatchDualMeetingConfirmation } from './meetingNotifier.js';

/**
 * Checks if prospect's text represents explicit confirmation
 */
export function isConfirmationText(text) {
  if (!text) return false;
  const clean = text.toLowerCase().trim();
  return (
    /^(yes|confirm|confirmed|sure|ok|okay|sounds good|done|lock it|book it|book|theek hai|ha|haan|chalega|perfect|agree|fine|yes please)$/i.test(clean) ||
    /\b(yes please|confirm it|confirm|book this|lock this|this works|time works|perfect time|works for me|works perfectly)\b/i.test(clean) ||
    /^(yes|haan|ha|sure|ok|okay)\b/i.test(clean)
  );
}

/**
 * Checks if prospect's text represents a cancellation request
 */
export function isCancellationText(text) {
  if (!text) return false;
  const clean = text.toLowerCase().trim();
  return (
    /^(cancel|cancel demo|cancel meeting|mat karo|nahi chahiye demo|don't want demo)$/i.test(clean) ||
    /\b(cancel the meeting|cancel my demo|cancel demo|cancel meeting|cancel|cannot attend|not interested in demo|drop the demo)\b/i.test(clean)
  );
}

/**
 * Checks if prospect's text represents a reschedule request
 */
export function isRescheduleText(text) {
  if (!text) return false;
  const clean = text.toLowerCase().trim();
  return (
    /^(reschedule|change time|postpone|dusra time|koi aur time)$/i.test(clean) ||
    /\b(change the time|reschedule the demo|reschedule|another time|different date|shift the meeting|can we do later|dusra time)\b/i.test(clean)
  );
}

/**
 * Finds active pending/waiting meeting for a lead or phone/JID
 */
export function getActiveLeadMeeting(leadId, remoteJid = null) {
  if (leadId) {
    const meetings = getLeadMeetings(leadId);
    const active = meetings.find(m => ['Waiting for Confirmation', 'Requested', 'Scheduled', 'Rescheduled'].includes(m.status));
    if (active) return active;
  }
  if (remoteJid) {
    const clean = String(remoteJid).replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '').trim();
    const resolved = resolvePhoneNumber ? resolvePhoneNumber(remoteJid) : null;
    const phone = (resolved || clean).replace(/[^0-9]/g, '');
    if (phone) {
      const active = db.prepare(`
        SELECT * FROM meetings
        WHERE (whatsappNumber LIKE ? OR whatsappNumber LIKE ?)
          AND status IN ('Waiting for Confirmation', 'Requested', 'Scheduled', 'Rescheduled')
        ORDER BY id DESC LIMIT 1
      `).get(`%${phone}%`, `%${phone.slice(-10)}%`);
      if (active) return active;
    }
  }
  return null;
}

/**
 * Processes incoming scheduling dialogue turns and drives the state machine
 */
export async function processSchedulingTurn({
  lead,
  incomingText,
  channel = 'whatsapp',
  remoteJid = null,
  senderEmail = null
}) {
  const gymName = lead?.gymName || 'your gym';
  const ownerName = lead?.ownerName || 'there';
  const leadId = lead?.id || null;
  const timeZone = detectTimezone(lead?.country || incomingText);

  let activeMeeting = getActiveLeadMeeting(leadId, remoteJid);

  // -------------------------------------------------------------
  // BRANCH 1: PROSPECT REQUESTS CANCELLATION
  // -------------------------------------------------------------
  if (isCancellationText(incomingText)) {
    if (activeMeeting) {
      updateMeeting(activeMeeting.id, { status: 'Cancelled' });
    }
    if (leadId) {
      updateLeadStatus(leadId, 'Contacted');
    }

    return {
      action: 'cancelled',
      replyText: `Understood, ${ownerName}. I have cancelled the demo session for ${gymName}. Whenever you are ready to explore automating your gym operations, feel free to reach out anytime!`,
      meeting: activeMeeting ? { ...activeMeeting, status: 'Cancelled' } : null
    };
  }

  // -------------------------------------------------------------
  // BRANCH 2: PROSPECT CONFIRMS PROPOSED SLOT
  // -------------------------------------------------------------
  if (isConfirmationText(incomingText) && activeMeeting && activeMeeting.status === 'Waiting for Confirmation') {
    const meetingDate = activeMeeting.meetingDate;
    const startTime = activeMeeting.startTime;
    const endTime = activeMeeting.endTime || computeEndTime(startTime);
    const meetingLink = generateGoogleMeetLink();
    const googleCalendarUrl = generateGoogleCalendarUrl({
      title: `GymStack 1-on-1 Demo for ${gymName}`,
      meetingDate,
      startTime,
      endTime,
      meetingLink
    });

    // Update meeting status to SCHEDULED with full links
    updateMeeting(activeMeeting.id, {
      status: 'Scheduled',
      meetingLink,
      googleCalendarUrl,
      confirmedAt: new Date().toISOString()
    });

    const scheduledMeeting = getMeetingById(activeMeeting.id);

    // Update lead CRM status
    if (leadId) {
      updateLeadStatus(leadId, 'Meeting Scheduled');
    }

    // STEP 10 & 11: Dispatch Dual WhatsApp and Email Confirmations
    dispatchDualMeetingConfirmation(scheduledMeeting).catch(err => {
      console.warn('[Meeting Notifier Dispatch Error]:', err.message);
    });

    const time12 = formatTime12h(startTime);

    return {
      action: 'confirmed_and_scheduled',
      replyText: `🎉 *Confirmed!* Your 1-on-1 GymStack live walkthrough for *${gymName}* is officially scheduled.

📅 *Date:* ${meetingDate}
⏰ *Time:* ${time12} (${activeMeeting.timeZone})
🔗 *Google Meet:* ${meetingLink}
📅 *Add to Calendar:* ${googleCalendarUrl}

I have also dispatched your calendar invite (.ics) to your email. Looking forward to showing you GymStack in action!`,
      meeting: scheduledMeeting
    };
  }

  // -------------------------------------------------------------
  // BRANCH 3: PROSPECT PROPOSES OR CHANGES DATE/TIME
  // -------------------------------------------------------------
  const parsedDate = parseNaturalDate(incomingText);
  const parsedTime = parseNaturalTime(incomingText);

  // If prospect specified date or time (or asks to reschedule)
  if (isRescheduleText(incomingText) || incomingText.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|pm|am|at\s+\d|\d\s*baje)\b/i)) {
    const targetDate = parsedDate;
    const targetTime = parsedTime || '15:30';
    const isFree = checkSlotAvailability(targetDate, targetTime);

    if (isFree) {
      const time12 = formatTime12h(targetTime);
      const endTime = computeEndTime(targetTime);
      const meetingLink = generateGoogleMeetLink();
      const googleCalendarUrl = generateGoogleCalendarUrl({
        title: `GymStack 1-on-1 Demo for ${gymName}`,
        meetingDate: targetDate,
        startTime: targetTime,
        endTime,
        meetingLink
      });

      const resolvedContactPhone = lead?.whatsappNumber || (remoteJid ? (resolvePhoneNumber(remoteJid) || remoteJid) : null);

      let meetingRecord;
      if (activeMeeting) {
        updateMeeting(activeMeeting.id, {
          meetingDate: targetDate,
          startTime: targetTime,
          endTime,
          timeZone,
          meetingLink: activeMeeting.meetingLink || meetingLink,
          googleCalendarUrl: activeMeeting.googleCalendarUrl || googleCalendarUrl,
          status: 'Waiting for Confirmation'
        });
        meetingRecord = getMeetingById(activeMeeting.id);
      } else {
        meetingRecord = createMeeting({
          leadId,
          gymName,
          ownerName,
          email: lead?.businessEmail || senderEmail,
          whatsappNumber: resolvedContactPhone,
          meetingDate: targetDate,
          startTime: targetTime,
          endTime,
          timeZone,
          meetingLink,
          googleCalendarUrl,
          status: 'Waiting for Confirmation',
          channel
        });
      }

      if (leadId) {
        updateLeadStatus(leadId, 'Meeting Requested');
      }

      return {
        action: 'waiting_for_confirmation',
        replyText: `Great! We have *${targetDate} at ${time12} (${timeZone})* open for your GymStack demo walkthrough.

Please reply with *"Yes"* or *"Confirm"* to lock in this slot and receive your Google Meet link!`,
        meeting: meetingRecord
      };
    } else {
      // Slot collision: Offer suitable alternative slots
      const available = getAvailableSlots(targetDate, timeZone);
      const slotList = available.slots.slice(0, 3).map(s => `• *${s.time12}*`).join('\n');

      return {
        action: 'slot_taken_offer_alternatives',
        replyText: `That specific time on ${targetDate} is currently booked. We have these open slots available on ${targetDate}:

${slotList}

Which of these times works best for you?`,
        meeting: activeMeeting
      };
    }
  }

  // -------------------------------------------------------------
  // BRANCH 4: INITIAL DEMO INTEREST / NO SPECIFIC TIME YET
  // -------------------------------------------------------------
  const tomorrowSlots = getAvailableSlots(null, timeZone);
  const suggestedTimes = tomorrowSlots.slots.slice(0, 3).map(s => `• *${s.time12}*`).join('\n');

  let meetingRecord = activeMeeting;
  if (!meetingRecord) {
    const slotTime = tomorrowSlots.slots[0]?.time24 || '15:30';
    const endTime = computeEndTime(slotTime);
    const meetingLink = generateGoogleMeetLink();
    const googleCalendarUrl = generateGoogleCalendarUrl({
      title: `GymStack 1-on-1 Demo for ${gymName}`,
      meetingDate: tomorrowSlots.date,
      startTime: slotTime,
      endTime,
      meetingLink
    });
    const resolvedContactPhone = lead?.whatsappNumber || (remoteJid ? (resolvePhoneNumber(remoteJid) || remoteJid) : null);

    meetingRecord = createMeeting({
      leadId,
      gymName,
      ownerName,
      email: lead?.businessEmail || senderEmail,
      whatsappNumber: resolvedContactPhone,
      meetingDate: tomorrowSlots.date,
      startTime: slotTime,
      endTime,
      timeZone,
      meetingLink,
      googleCalendarUrl,
      status: 'Requested',
      channel
    });
  }

  if (leadId) {
    updateLeadStatus(leadId, 'Meeting Requested');
  }

  return {
    action: 'requested_slots_offered',
    replyText: `We would love to give you a 15-minute live screen share walkthrough of GymStack for *${gymName}*!

We have slots open tomorrow (${tomorrowSlots.date}) at:
${suggestedTimes}
(Timezone: ${timeZone})

Does one of these times suit you, or what day and time do you prefer?`,
    meeting: meetingRecord
  };
}
