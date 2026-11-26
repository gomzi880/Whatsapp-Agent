/**
 * Google Calendar Integration & Slot Availability Service
 * 
 * Provides:
 * - Dynamic Google Meet link generation
 * - Direct Google Calendar add-to-calendar URL generation
 * - iCalendar (.ics) RFC 5545 invite generator
 * - Timezone-aware slot generation and collision checking
 * - Natural date & time parsing
 */

import { checkSlotAvailability } from '../database/db.js';

// Standard demo duration in minutes
export const DEFAULT_MEETING_DURATION_MINUTES = 30;

// Standard working slot hours (24h format)
export const STANDARD_SLOT_TIMES = [
  '10:00',
  '11:30',
  '14:00',
  '15:30',
  '17:00',
  '18:30'
];

/**
 * Generates a unique Google Meet link
 */
export function generateGoogleMeetLink() {
  const segment1 = Math.random().toString(36).substring(2, 6);
  const segment2 = Math.random().toString(36).substring(2, 5);
  return `https://meet.google.com/gym-${segment1}-${segment2}`;
}

/**
 * Formats a 24-hour time string ("14:00") into friendly 12-hour format ("02:00 PM")
 */
export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // hour '0' should be '12'
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Computes end time given start time (HH:MM) and duration in minutes
 */
export function computeEndTime(startTime24, durationMinutes = DEFAULT_MEETING_DURATION_MINUTES) {
  const [hStr, mStr] = startTime24.split(':');
  const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

/**
 * Formats date into YYYY-MM-DD
 */
export function formatDateYmd(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates a 1-click Google Calendar Add-to-Calendar URL
 */
export function generateGoogleCalendarUrl({
  title = 'GymStack Live Product Demonstration',
  details = '1-on-1 walkthrough of GymStack gym management software, automated WhatsApp fee renewals, and biometric attendance.',
  meetingDate,
  startTime,
  endTime,
  meetingLink
}) {
  const [startH, startM] = startTime.split(':');
  const [endH, endM] = (endTime || computeEndTime(startTime)).split(':');
  const [y, m, d] = meetingDate.split('-');

  // Format YYYYMMDDTHHMMSS
  const startIso = `${y}${m}${d}T${startH}${startM}00`;
  const endIso = `${y}${m}${d}T${endH}${endM}00`;

  const fullDetails = `${details}\n\nJoin Google Meet: ${meetingLink}\nSupport: sales@gymstack.in\nWebsite: https://gymstack.in`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startIso}/${endIso}`,
    details: fullDetails,
    location: meetingLink
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an iCalendar (.ics) invite string (RFC 5545)
 */
export function generateIcsInvite({
  title = 'GymStack 1-on-1 Product Walkthrough',
  description = 'Live screen share demo of GymStack software with gym owner.',
  meetingDate,
  startTime,
  endTime,
  meetingLink,
  organizerEmail = 'sales@gymstack.in',
  organizerName = 'GymStack Demo Team',
  attendeeEmail,
  attendeeName
}) {
  const [startH, startM] = startTime.split(':');
  const [endH, endM] = (endTime || computeEndTime(startTime)).split(':');
  const [y, m, d] = meetingDate.split('-');

  const dtStart = `${y}${m}${d}T${startH}${startM}00`;
  const dtEnd = `${y}${m}${d}T${endH}${endM}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `gymstack-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@gymstack.in`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GymStack Technologies//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')} - Google Meet: ${meetingLink}`,
    `LOCATION:${meetingLink}`,
    `ORGANIZER;CN="${organizerName}":mailto:${organizerEmail}`,
    attendeeEmail ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="${attendeeName || 'Gym Owner'}":mailto:${attendeeEmail}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: GymStack Demo starting in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

/**
 * Finds available slots for a specific date, checking against database conflicts
 */
export function getAvailableSlots(meetingDate, timeZone = 'Asia/Kolkata (IST)') {
  const targetDate = meetingDate || formatDateYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const availableSlots = [];

  const now = new Date();
  const isToday = targetDate === formatDateYmd(now);
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  for (const slotTime of STANDARD_SLOT_TIMES) {
    const [slotH, slotM] = slotTime.split(':').map(Number);

    // If target date is today, exclude past slots
    if (isToday) {
      if (slotH < currentHours || (slotH === currentHours && slotM <= currentMinutes + 30)) {
        continue;
      }
    }

    // Check collision in database
    const isFree = checkSlotAvailability(targetDate, slotTime);
    if (isFree) {
      availableSlots.push({
        date: targetDate,
        time24: slotTime,
        time12: formatTime12h(slotTime),
        endTime24: computeEndTime(slotTime),
        endTime12: formatTime12h(computeEndTime(slotTime)),
        timeZone
      });
    }
  }

  return {
    date: targetDate,
    timeZone,
    slots: availableSlots,
    availableSlots
  };
}

/**
 * Parses natural date strings like "tomorrow", "Friday", "28 Nov", etc.
 */
export function parseNaturalDate(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();
  const today = new Date();

  if (clean.includes('today') || clean.includes('aaj')) {
    return formatDateYmd(today);
  }

  if (clean.includes('tomorrow') || clean.includes('kal')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDateYmd(tomorrow);
  }

  if (clean.includes('day after tomorrow') || clean.includes('parso')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    return formatDateYmd(dayAfter);
  }

  // Weekdays matching
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (clean.includes(days[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // next week's day
      const target = new Date(today);
      target.setDate(today.getDate() + diff);
      return formatDateYmd(target);
    }
  }

  // Direct date regex: YYYY-MM-DD
  const ymdMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Direct date regex: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Fallback to tomorrow if prospect wants demo
  const def = new Date(today);
  def.setDate(today.getDate() + 1);
  return formatDateYmd(def);
}

/**
 * Parses natural time strings like "3 PM", "11:30 am", "morning", "evening", etc.
 */
export function parseNaturalTime(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // 12-hour pattern e.g. "3:30 pm", "4pm", "11 am"
  const time12Match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (time12Match) {
    let h = parseInt(time12Match[1], 10);
    const m = time12Match[2] || '00';
    const ampm = time12Match[3].toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  // 24-hour pattern e.g. "15:00", "14:30"
  const time24Match = clean.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time24Match) {
    return `${time24Match[1].padStart(2, '0')}:${time24Match[2]}`;
  }

  // Generic periods
  if (clean.includes('morning') || clean.includes('subah')) return '10:00';
  if (clean.includes('afternoon') || clean.includes('dopahar')) return '14:00';
  if (clean.includes('evening') || clean.includes('shaam')) return '17:00';

  // Match bare hour "3 baje", "at 4", "around 5"
  const bareMatch = clean.match(/\b([1-9]|1[0-2])\s*(?:baje|o'clock|pm|\s|$)/);
  if (bareMatch) {
    let h = parseInt(bareMatch[1], 10);
    if (h >= 1 && h <= 7) h += 12; // Assume afternoon/evening for gym owners
    return `${h.toString().padStart(2, '0')}:00`;
  }

  return '15:30'; // Standard default demo slot
}

/**
 * Detects timezone from country or text
 */
export function detectTimezone(countryOrText) {
  if (!countryOrText) return 'Asia/Kolkata (IST)';
  const clean = countryOrText.toLowerCase();

  if (clean.includes('usa') || clean.includes('united states') || clean.includes('est') || clean.includes('new york')) {
    return 'America/New_York (EST)';
  }
  if (clean.includes('california') || clean.includes('pst') || clean.includes('pacific')) {
    return 'America/Los_Angeles (PST)';
  }
  if (clean.includes('uk') || clean.includes('london') || clean.includes('gmt') || clean.includes('united kingdom')) {
    return 'Europe/London (GMT)';
  }
  if (clean.includes('uae') || clean.includes('dubai') || clean.includes('gst')) {
    return 'Asia/Dubai (GST)';
  }
  if (clean.includes('australia') || clean.includes('sydney')) {
    return 'Australia/Sydney (AEST)';
  }
  if (clean.includes('singapore') || clean.includes('sgt')) {
    return 'Asia/Singapore (SGT)';
  }
  if (clean.includes('germany') || clean.includes('france') || clean.includes('cet')) {
    return 'Europe/Berlin (CET)';
  }

  return 'Asia/Kolkata (IST)';
}
