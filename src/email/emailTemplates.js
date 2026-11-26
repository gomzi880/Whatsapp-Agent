import { gymStackKnowledge } from '../../knowledge.js';

export const AUTHORIZED_SENDERS = [
  'info@gymstack.in',
  'sales@gymstack.in',
  'support@gymstack.in'
];

/**
 * Validates whether an email is one of the three authorized accounts
 */
export function isAuthorizedSender(email) {
  if (!email) return false;
  return AUTHORIZED_SENDERS.includes(email.toLowerCase().trim());
}

/**
 * Renders anti-spam and footer block
 */
function renderFooter({ gymName, city, fromEmail }) {
  const unsubText = `You received this message because ${gymName || 'your fitness facility'} is listed as a gym or health club in ${city || 'India'}. To opt out of future emails, reply with "STOP" or "UNSUBSCRIBE" and we will permanently remove your email address immediately.`;

  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
      <p style="margin: 0 0 6px 0;">
        <strong>GymStack Technologies Private Limited</strong><br>
        HQ: Sector 14, Commercial Complex, Indore, MP, India 452001<br>
        Web: <a href="https://gymstack.in" style="color: #64748b; text-decoration: underline;">gymstack.in</a> | Support: <a href="mailto:${fromEmail}" style="color: #64748b;">${fromEmail}</a> | WhatsApp: +91 83588 26116
      </p>
      <p style="margin: 8px 0 0 0; color: #a1a1aa;">
        ${unsubText}
      </p>
    </div>
  `;
}

/**
 * Standard email HTML shell
 */
function wrapHtml({ content, gymName, city, fromEmail, title }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'GymStack'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 32px; color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">GymStack</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; color: #bfdbfe;">Smart Fitness & Gym Management Platform</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 32px; font-size: 15px; line-height: 1.65; color: #334155;">
      ${content}
      ${renderFooter({ gymName, city, fromEmail })}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds email subject, HTML, plain text, and attachment flag based on templateType
 */
export function buildEmail({ templateType = 'introductory', lead = {}, customMessage, fromEmail = 'sales@gymstack.in' }) {
  const safeFrom = isAuthorizedSender(fromEmail) ? fromEmail : 'sales@gymstack.in';
  const gymName = lead.gymName || 'your gym';
  const ownerName = lead.ownerName || lead.founderName || 'Gym Owner';
  const city = lead.city || 'your city';
  const k = gymStackKnowledge;

  let subject = '';
  let content = '';
  let plainText = '';
  let attachBrochure = false;

  switch (templateType) {
    case 'introductory': {
      subject = `A smarter way to run ${gymName} — GymStack`;
      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>I came across <strong>${gymName}</strong> in ${city} and wanted to reach out directly.</p>
        
        <p>Running a fitness facility comes with daily headaches — chasing overdue membership fees, manual attendance registers, scheduling trainer shifts, and member drop-offs.</p>
        
        <p>We built <strong>GymStack</strong> to solve exactly that. It is an all-in-one gym management platform that automates your day-to-day operations:</p>
        
        <ul style="padding-left: 20px; margin: 16px 0;">
          <li><strong>Automated WhatsApp Fee Reminders:</strong> Collect renewals 3x faster with instant UPI payment links.</li>
          <li><strong>Smart Attendance & Biometrics:</strong> QR scan or biometric check-in with real-time occupancy.</li>
          <li><strong>Member & Trainer Management:</strong> Workout logs, diet charts, and trainer commission tracking.</li>
          <li><strong>Complete Owner Tower:</strong> Revenue analytics, expense tracking, and GST invoicing.</li>
        </ul>

        ${customMessage ? `<div style="background: #f1f5f9; padding: 14px; border-left: 4px solid #2563eb; margin: 16px 0; font-size: 14px; color: #1e293b;">${customMessage}</div>` : ''}

        <p>We would love to show you how GymStack can simplify operations at ${gymName}. You can start a completely unrestricted <strong>30-day free trial</strong> (no credit card needed) below:</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${k.company.demoLink}" style="background-color: #2563eb; color: #ffffff; padding: 13px 28px; text-decoration: none; font-weight: 600; border-radius: 8px; display: inline-block; font-size: 15px;">
            Start 30-Day Free Trial
          </a>
        </div>

        <p style="margin-bottom: 0;">Would you be open to a quick 10-minute walkthrough this week? Simply reply to this email, or chat with us on WhatsApp at <strong>${k.company.supportPhone}</strong>.</p>
      `;

      plainText = `Hi ${ownerName},\n\nI came across ${gymName} in ${city} and wanted to introduce GymStack.\n\nGymStack is an all-in-one gym management platform that helps fitness businesses automate member records, fee renewals via WhatsApp UPI, biometric attendance, and trainer payouts.\n\nStart your 30-day free trial: ${k.company.demoLink}\n\nWould you be open to a quick 10-minute demo this week? Simply reply to this email or reach us on WhatsApp at ${k.company.supportPhone}.\n\nBest regards,\nGymStack Sales Team\nhttps://gymstack.in`;
      break;
    }

    case 'product_details': {
      subject = `GymStack Feature Guide & Product Details for ${gymName}`;
      attachBrochure = true;

      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>Thank you for your interest in <strong>GymStack</strong> for <strong>${gymName}</strong>! Attached with this email is the official <strong>GymStack Product Brochure (PDF)</strong> detailing all system features and specifications.</p>

        <h3 style="color: #1e3a8a; margin-top: 24px; font-size: 17px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Core Modules Overview:</h3>
        
        <div style="margin: 16px 0;">
          <p style="margin: 6px 0;"><strong>1. Member Lifecycle:</strong> Digital onboarding, medical records, digital photo ID, and membership freeze/transfer.</p>
          <p style="margin: 6px 0;"><strong>2. Automated Renewals:</strong> Scheduled WhatsApp messages with UPI dynamic payment links and automated PDF tax invoices.</p>
          <p style="margin: 6px 0;"><strong>3. Access & Attendance:</strong> Biometric turnstiles, RFID cards, and contactless QR mobile check-ins.</p>
          <p style="margin: 6px 0;"><strong>4. Trainer & Class Scheduling:</strong> Manage PT packages, class capacities, and automated commission payouts.</p>
          <p style="margin: 6px 0;"><strong>5. Member Mobile App:</strong> Workout plans, diet charts, attendance history, and payment receipts.</p>
          <p style="margin: 6px 0;"><strong>6. Multi-Branch Control:</strong> Centralized dashboard for multiple fitness outlets with role-based staff access.</p>
        </div>

        <div style="background: #eff6ff; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <h4 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 16px;">Test GymStack Live for 30 Days Free</h4>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #475569;">Import your current member list and see WhatsApp fee reminders in action.</p>
          <a href="${k.company.demoLink}" style="background-color: #2563eb; color: #ffffff; padding: 10px 22px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Register Free Trial
          </a>
        </div>

        <p style="margin-bottom: 0;">Please check the attached PDF for full technical specifications. If you have any specific feature requirements for ${gymName}, feel free to hit reply!</p>
      `;

      plainText = `Hi ${ownerName},\n\nHere are the complete product details for GymStack for ${gymName}.\n\nAttached is our official Product Brochure (PDF) with full specifications across Member Management, WhatsApp Fee Renewals, Biometric Attendance, Trainer Scheduling, and Multi-Branch Analytics.\n\nFree 30-day trial: ${k.company.demoLink}\n\nReply directly to this email if you would like a live 1-on-1 walkthrough.\n\nBest regards,\nGymStack Product Team`;
      break;
    }

    case 'pricing': {
      subject = `GymStack Transparent Pricing & Package Options for ${gymName}`;

      const packagesHtml = k.packages.map(p => `
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 14px; background: #f8fafc;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <strong style="font-size: 16px; color: #1e293b;">${p.name}</strong>
            <span style="font-size: 16px; font-weight: 700; color: #2563eb;">${p.price}</span>
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">Best for: ${p.idealFor}</p>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #334155; line-height: 1.5;">
            ${p.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>Here is our official, transparent pricing breakdown for <strong>${gymName}</strong>. Unlike other platforms, we have <strong>no hidden setup fees, no per-member penalties, and free data migration</strong>:</p>

        <div style="margin: 20px 0;">
          ${packagesHtml}
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <strong style="color: #166534; font-size: 14px;">💡 Why GymStack Pays for Itself:</strong>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #15803d; line-height: 1.5;">
            Gyms using automated WhatsApp renewal reminders recover an average of 15% more memberships in the first 30 days — covering the cost of GymStack many times over.
          </p>
        </div>

        <p>You can test any plan with our 30-day free trial:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${k.company.demoLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Start 30-Day Free Trial
          </a>
        </div>

        <p style="margin-bottom: 0;">Which plan looks best suited for ${gymName}? Let me know and I will be happy to assist with onboarding.</p>
      `;

      plainText = `Hi ${ownerName},\n\nHere is our official pricing for ${gymName}:\n\n1. Starter Plan: ₹499/mo (Ideal for single gyms up to 150 members)\n2. Gold Plan: ₹2,700/mo (Most popular - up to 600 members, biometric sync, automated WhatsApp links)\n3. Diamond Plan: Custom (Multi-branch gym chains, custom branded app)\n\nNo setup fees. Free data import. 30-day free trial: ${k.company.demoLink}\n\nBest regards,\nGymStack Sales Team`;
      break;
    }

    case 'meeting_invite': {
      subject = `Invitation: 15-Min Live GymStack Demo for ${gymName}`;
      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>I would like to invite you to a short, 15-minute live screen share demo of <strong>GymStack</strong> tailored specifically for <strong>${gymName}</strong>.</p>
        
        <p>In this quick session, we will cover:</p>
        <ul style="padding-left: 20px; margin: 12px 0;">
          <li>How WhatsApp payment links automate your fee collection.</li>
          <li>How biometric and QR check-in prevents unauthorized entries.</li>
          <li>How easy it is to import your existing member spreadsheet.</li>
          <li>Q&A to address your exact operational needs.</li>
        </ul>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <strong style="color: #1e40af; font-size: 15px;">Book Your Demo Time:</strong>
          <p style="font-size: 13px; color: #475569; margin: 6px 0 16px 0;">Reply with a time that works for you, or book instantly:</p>
          <a href="https://gymstack.in/book-demo" style="background-color: #2563eb; color: #ffffff; padding: 10px 22px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Pick Demo Slot on Google Meet
          </a>
        </div>

        <p style="margin-bottom: 0;">Alternatively, just reply with <em>"Tomorrow 3 PM"</em> or what fits your schedule, and I will send the calendar invite immediately.</p>
      `;

      plainText = `Hi ${ownerName},\n\nI would love to give you a 15-minute live screen share demo of GymStack for ${gymName}.\n\nWe will show you WhatsApp fee reminders, biometric attendance, and seamless member data import.\n\nReply with a day/time that works for you, or schedule here: https://gymstack.in/book-demo\n\nBest regards,\nGymStack Team`;
      break;
    }

    case 'meeting_confirmation': {
      subject = `Confirmed: GymStack Demo for ${gymName}`;
      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>Your product walkthrough for <strong>${gymName}</strong> is confirmed!</p>
        
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Platform:</strong> Google Meet / Screen share</p>
          <p style="margin: 0 0 8px 0;"><strong>Meeting Link:</strong> <a href="https://meet.google.com/gym-stck-dmo" style="color: #2563eb;">meet.google.com/gym-stck-dmo</a></p>
          <p style="margin: 0 0 8px 0;"><strong>Agenda:</strong> Live system tour, WhatsApp automation setup, member import walkthrough, pricing review.</p>
        </div>

        <p>If you need to reschedule or invite any partners or managers, please reply to this email anytime.</p>
      `;

      plainText = `Hi ${ownerName},\n\nYour GymStack product walkthrough for ${gymName} is confirmed.\n\nMeeting link: https://meet.google.com/gym-stck-dmo\n\nLooking forward to speaking with you!\n\nBest regards,\nGymStack Team`;
      break;
    }

    case 'follow_up': {
      subject = `Quick follow-up for ${gymName} — GymStack`;
      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>I wanted to follow up briefly regarding <strong>${gymName}</strong> to see if you had a chance to review our earlier message about GymStack.</p>
        
        <p>We know how busy running a fitness centre can be. If you have questions about moving away from your current system or importing existing member files, our team handles all migration <strong>100% free of charge</strong>.</p>

        <p>Would you like me to share a 3-minute video overview or set up a test account for ${gymName}?</p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${k.company.demoLink}" style="background-color: #2563eb; color: #ffffff; padding: 11px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">
            Explore Free Trial
          </a>
        </div>

        <p style="margin-bottom: 0;">Looking forward to your thoughts!</p>
      `;

      plainText = `Hi ${ownerName},\n\nFollowing up briefly regarding ${gymName} to see if you had a chance to look at GymStack.\n\nWe provide free member data migration and a 30-day free trial: ${k.company.demoLink}\n\nLet me know if you would like a quick demo or test account.\n\nBest regards,\nGymStack Team`;
      break;
    }

    case 'feedback': {
      subject = `Quick question about gym operations at ${gymName}`;
      content = `
        <p style="font-size: 16px; margin-top: 0;">Hi <strong>${ownerName}</strong>,</p>
        
        <p>As someone managing fitness operations at <strong>${gymName}</strong> in ${city}, we would love your quick feedback.</p>
        
        <p>What is currently your single biggest operational challenge?</p>
        <ul style="padding-left: 20px; margin: 12px 0;">
          <li>1. Tracking overdue fees and chasing payment reminders.</li>
          <li>2. Member attendance accuracy and biometric sync.</li>
          <li>3. Managing trainer schedules and member diet plans.</li>
          <li>4. Member retention and drop-off prevention.</li>
        </ul>

        <p>Simply reply with 1, 2, 3, or 4 — your insights help us refine our software for gym owners like you across India.</p>

        <p style="margin-bottom: 0;">Thank you for your time!</p>
      `;

      plainText = `Hi ${ownerName},\n\nQuick question about ${gymName}: What is your biggest daily challenge right now?\n1. Overdue fees\n2. Attendance & access\n3. Trainer schedules\n4. Member retention\n\nReply with 1, 2, 3, or 4 — we would love your quick input!\n\nBest regards,\nGymStack Team`;
      break;
    }

    default: {
      subject = `GymStack Information for ${gymName}`;
      content = `<p>Hi ${ownerName},</p><p>${customMessage || 'Thank you for connecting with GymStack.'}</p>`;
      plainText = `Hi ${ownerName},\n\n${customMessage || 'Thank you for connecting with GymStack.'}`;
      break;
    }
  }

  const html = wrapHtml({ content, gymName, city, fromEmail: safeFrom, title: subject });

  return {
    subject,
    html,
    text: plainText,
    attachBrochure,
    fromEmail: safeFrom
  };
}
