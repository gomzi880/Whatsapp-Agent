import sharp from 'sharp';
import fs from 'fs';
import { gymStackKnowledge } from './knowledge.js';

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function createBrochureImage(outputPath = './GymStack_Brochure.png') {
  const k = gymStackKnowledge;
  const tagline = escapeXml(k.company.tagline);

  const svg = `
  <svg width="1080" height="1520" viewBox="0 0 1080 1520" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1080" height="1520" fill="#f8fafc"/>

    <!-- Header Banner -->
    <rect width="1080" height="220" fill="url(#headerGrad)"/>
    <text x="540" y="90" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">GymStack</text>
    <text x="540" y="140" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#e0e7ff" text-anchor="middle">${tagline}</text>
    <rect x="340" y="165" width="400" height="34" rx="17" fill="#ffffff" fill-opacity="0.2"/>
    <text x="540" y="188" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">🎉 30-DAY FREE TRIAL AVAILABLE</text>

    <!-- Packages Section Title -->
    <text x="540" y="275" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#0f172a" text-anchor="middle">Subscription Packages &amp; Pricing</text>

    <!-- Plan 1: Starter -->
    <g transform="translate(60, 305)" filter="url(#shadow)">
      <rect width="960" height="150" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="25" y="22" width="130" height="30" rx="6" fill="#f1f5f9"/>
      <text x="90" y="42" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#475569" text-anchor="middle">STARTER PLAN</text>
      <text x="25" y="85" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" fill="#0f172a">₹499 <tspan font-size="18" fill="#64748b" font-weight="normal">/ month</tspan></text>
      <text x="25" y="118" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#64748b">Best for: Small gyms &amp; studios (Up to 150 members)</text>
      <text x="520" y="55" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ Member Profiles &amp; Digital Renewals</text>
      <text x="520" y="85" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ Automated WhatsApp Fee Reminders</text>
      <text x="520" y="115" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ Financial &amp; Attendance Reports</text>
    </g>

    <!-- Plan 2: Gold (Highlighted) -->
    <g transform="translate(60, 480)" filter="url(#shadow)">
      <rect width="960" height="175" rx="14" fill="#ffffff" stroke="#2563eb" stroke-width="3"/>
      <rect x="800" y="0" width="160" height="34" rx="8" fill="#2563eb"/>
      <text x="880" y="23" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">🔥 MOST POPULAR</text>
      <rect x="25" y="22" width="110" height="30" rx="6" fill="#eff6ff"/>
      <text x="80" y="42" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#2563eb" text-anchor="middle">GOLD PLAN</text>
      <text x="25" y="88" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="#2563eb">₹2,700 <tspan font-size="18" fill="#64748b" font-weight="normal">/ month</tspan></text>
      <text x="25" y="122" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#64748b">Best for: Growing gyms (Up to 500 members)</text>
      <text x="520" y="52" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#1e293b" font-weight="bold">✓ Everything in Starter Plan</text>
      <text x="520" y="82" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#1e293b">✓ Biometric &amp; Facial Scanner Integration</text>
      <text x="520" y="112" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#1e293b">✓ Branded Member Mobile App (Android)</text>
      <text x="520" y="142" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#1e293b">✓ Diet &amp; Workout Planner + POS Store</text>
    </g>

    <!-- Plan 3: Diamond -->
    <g transform="translate(60, 680)" filter="url(#shadow)">
      <rect width="960" height="150" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="25" y="22" width="140" height="30" rx="6" fill="#fef3c7"/>
      <text x="95" y="42" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#b45309" text-anchor="middle">DIAMOND PLAN</text>
      <text x="25" y="85" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" fill="#0f172a">₹5,499 <tspan font-size="18" fill="#64748b" font-weight="normal">/ Year</tspan></text>
      <text x="25" y="118" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#64748b">Best for: Large clubs &amp; multi-branch chains</text>
      <text x="520" y="55" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ Unlimited Active Members</text>
      <text x="520" y="85" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ Multi-Branch Master Dashboard</text>
      <text x="520" y="115" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#334155">✓ 24/7 Dedicated Support &amp; Free Migration</text>
    </g>

    <!-- Core Features Grid -->
    <text x="540" y="880" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#0f172a" text-anchor="middle">⚡ Powerful Features Included</text>

    <!-- Feature 1 -->
    <g transform="translate(60, 915)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">🔐 Biometric &amp; Face Recognition</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Syncs with eSSL, Realtime, ZKTeco devices.</text>
    </g>

    <!-- Feature 2 -->
    <g transform="translate(555, 915)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">📲 Automated WhatsApp Reminders</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Automatic fee alerts with direct UPI payment links.</text>
    </g>

    <!-- Feature 3 -->
    <g transform="translate(60, 1035)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">📱 Member Mobile App (Android)</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Members view workout &amp; diet charts, renewals &amp; bills.</text>
    </g>

    <!-- Feature 4 -->
    <g transform="translate(555, 1035)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">🥗 Diet &amp; Workout Planners</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Pre-built fitness templates assignable to members.</text>
    </g>

    <!-- Feature 5 -->
    <g transform="translate(60, 1155)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">🏋️‍♂️ Personal Trainer (PT) Tracking</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Track client sessions and trainer payroll commissions.</text>
    </g>

    <!-- Feature 6 -->
    <g transform="translate(555, 1155)">
      <rect width="465" height="100" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="25" y="40" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#1e3a8a">🏢 Multi-Branch &amp; POS Store</text>
      <text x="25" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#64748b">Manage supplement inventory and multiple locations.</text>
    </g>

    <!-- Footer Action Box -->
    <rect x="60" y="1290" width="960" height="180" rx="16" fill="url(#headerGrad)"/>
    <text x="540" y="1340" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">Start Your 30-Day Free Trial Today!</text>
    <text x="540" y="1375" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#e0e7ff" text-anchor="middle">Visit gymstack.in/register • No Credit Card Required</text>
    <text x="540" y="1425" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#fef08a" text-anchor="middle">📞 WhatsApp / Call: +91-8358826116  |  ✉️ sales@gymstack.in</text>
    <text x="540" y="1455" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#cbd5e1" text-anchor="middle">Website: https://gymstack.in</text>
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png({ quality: 100 })
    .toFile(outputPath);

  console.log('✅ Brochure Image generated:', outputPath);
  return outputPath;
}

// Auto-run if executed directly
if (process.argv[1]?.includes('generate-brochure-image.js')) {
  createBrochureImage().catch(console.error);
}
