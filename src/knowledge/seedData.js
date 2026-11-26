/**
 * Comprehensive Verified Product Knowledge for GymStack Portal
 * Seed data covering all 14 mandatory business and product categories.
 */

export const MANDATORY_CATEGORIES = [
  'Product Overview',
  'Gym Management Features',
  'Member Management',
  'Membership Plans',
  'Attendance Management',
  'Payment Management',
  'Trainer Management',
  'Workout Management',
  'Reports & Analytics',
  'Branch Management',
  'Subscription Pricing',
  'Product Benefits',
  'Frequently Asked Questions',
  'Technical Requirements'
];

export const INITIAL_SETTINGS = [
  { key: 'company_name', value: 'GymStack' },
  { key: 'tagline', value: 'All-in-One Online Gym & Fitness Club Management Software' },
  { key: 'website', value: 'https://gymstack.in' },
  { key: 'demo_link', value: 'https://gymstack.in/register' },
  { key: 'video_demo_url', value: 'https://gymstack.in/demo-video' },
  { key: 'support_phone', value: '+91-8358826116' },
  { key: 'support_email', value: 'support@gymstack.in' },
  { key: 'free_trial_text', value: '30-day free trial with full unrestricted access (no credit card required)' },
  { key: 'outreach_approved', value: '1' } // Default set to 1 after initial seed verification
];

export const INITIAL_KNOWLEDGE_ITEMS = [
  // 1. Product Overview
  {
    category: 'Product Overview',
    title: 'GymStack Software Introduction',
    content: 'GymStack is a modern, cloud-based gym and health club management ERP platform designed specifically for gym owners, fitness clubs, CrossFit boxes, yoga studios, and multi-branch fitness chains. It automates front-desk check-in, member registration, automated fee collections with WhatsApp notifications, biometric access control, trainer commissions, and real-time business financial analytics.',
    sourceType: 'manual',
    tags: 'overview, about, introduction, cloud, software, gymstack',
    isVerified: 1,
    sortOrder: 1
  },
  {
    category: 'Product Overview',
    title: 'Target Audience & Studio Types',
    content: 'GymStack supports single-facility independent gyms, boutique fitness studios, functional training centers, CrossFit boxes, women-only fitness centers, and multi-location corporate fitness chains.',
    sourceType: 'manual',
    tags: 'audience, gym types, crossfit, boutique, chains',
    isVerified: 1,
    sortOrder: 2
  },

  // 2. Gym Management Features
  {
    category: 'Gym Management Features',
    title: 'Front-Desk Operations & Role-Based Access',
    content: 'Centralized web dashboard with role-based permissions (Super Admin, Branch Manager, Receptionist, Trainer). Restricts sensitive data like member phone numbers or financial reports from staff to prevent client poaching and data theft.',
    sourceType: 'manual',
    tags: 'frontdesk, permissions, roles, security, staff access',
    isVerified: 1,
    sortOrder: 3
  },
  {
    category: 'Gym Management Features',
    title: 'POS & Supplement Inventory Management',
    content: 'Built-in Point of Sale (POS) system to sell gym supplements, protein powders, branded merchandise, water, and fitness gear. Tracks stock in real time, alerts on low inventory, and prints or WhatsApps digital sales receipts.',
    sourceType: 'manual',
    tags: 'pos, inventory, supplements, merchandise, stock',
    isVerified: 1,
    sortOrder: 4
  },
  {
    category: 'Gym Management Features',
    title: 'Locker & Asset Management',
    content: 'Assign, track, and manage gym locker allotments with automatic renewal reminders linked to member plans.',
    sourceType: 'manual',
    tags: 'locker, assets, facilities, equipment',
    isVerified: 1,
    sortOrder: 5
  },

  // 3. Member Management
  {
    category: 'Member Management',
    title: 'Digital Member Profiles & KYC',
    content: 'Paperless onboarding with digital photo capture, identity document upload (Aadhaar/ID), emergency contacts, medical history, blood group, and fitness goals.',
    sourceType: 'manual',
    tags: 'member profile, kyc, digital registration, onboarding, documents',
    isVerified: 1,
    sortOrder: 6
  },
  {
    category: 'Member Management',
    title: 'Membership Lifecycle & Renewal Automation',
    content: 'Tracks active, expired, upcoming expiry, and churned members. Sends automated renewal alerts before and on expiry with instant renewal links.',
    sourceType: 'manual',
    tags: 'lifecycle, renewals, expiry, alerts, retention',
    isVerified: 1,
    sortOrder: 7
  },
  {
    category: 'Member Management',
    title: 'Membership Freeze & Transfer Options',
    content: 'Allows temporary pausing or freezing of memberships for travel or medical injury with configurable rules, automatically extending the expiry date by exact paused days. Also supports transferring balances to family members.',
    sourceType: 'manual',
    tags: 'freeze, pause, transfer, suspension, medical leave',
    isVerified: 1,
    sortOrder: 8
  },

  // 4. Membership Plans
  {
    category: 'Membership Plans',
    title: 'Flexible Custom Packages & Billing Cycles',
    content: 'Create unlimited customizable membership packages: Monthly, Quarterly, Half-Yearly, Annual, or session-based passes. Configure admission fees, seasonal discount codes, and couple/group package deals.',
    sourceType: 'manual',
    tags: 'packages, plans, discounts, admissions, annual, monthly',
    isVerified: 1,
    sortOrder: 9
  },
  {
    category: 'Membership Plans',
    title: 'Multi-Service Add-ons',
    content: 'Bundle general gym access with specialized add-ons like Personal Training (PT), Steam/Sauna bath, Zumba classes, Cross-training, or Nutrition consulting in one unified invoice.',
    sourceType: 'manual',
    tags: 'addons, zumba, steam, sauna, bundle',
    isVerified: 1,
    sortOrder: 10
  },

  // 5. Attendance Management
  {
    category: 'Attendance Management',
    title: 'Biometric & Facial Recognition Integration',
    content: 'Seamless real-time integration with biometric fingerprint scanners, RFID card readers, and AI facial recognition terminals (eSSL, Realtime, ZKTeco, Mantra, etc.). Check-in logs synchronize instantly over the cloud.',
    sourceType: 'manual',
    tags: 'biometric, fingerprint, face scanner, essl, zkteco, rfid, attendance',
    isVerified: 1,
    sortOrder: 11
  },
  {
    category: 'Attendance Management',
    title: 'Automated Access Gate Blocking for Defaulters',
    content: 'Integrates with turnstile, flap barriers, and electromagnetic doors to automatically deny entry or trigger audio alarms if a member has unpaid or expired membership fees.',
    sourceType: 'manual',
    tags: 'gate access, turnstile, block defaulters, barrier, automated lock',
    isVerified: 1,
    sortOrder: 12
  },
  {
    category: 'Attendance Management',
    title: 'QR Code Mobile Check-In',
    content: 'Contactless check-in option via member mobile app using dynamic encrypted QR codes displayed at the reception counter.',
    sourceType: 'manual',
    tags: 'qr code, contactless, mobile checkin',
    isVerified: 1,
    sortOrder: 13
  },

  // 6. Payment Management
  {
    category: 'Payment Management',
    title: 'Automated WhatsApp Fee Reminders',
    content: 'Automated schedule sends polite payment reminders directly to members on WhatsApp (e.g., 3 days before, 1 day before, and on the due date) complete with an online UPI/card payment link.',
    sourceType: 'manual',
    tags: 'whatsapp reminders, automated billing, fee collection, payment links',
    isVerified: 1,
    sortOrder: 14
  },
  {
    category: 'Payment Management',
    title: 'Instant Online Payment Gateway (UPI, Cards, Netbanking)',
    content: 'Members can pay their dues via UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards, or Netbanking. Payments automatically reconcile, update membership validity, and dispatch an instant receipt on WhatsApp.',
    sourceType: 'manual',
    tags: 'upi, payment gateway, phonepe, gpay, netbanking, cards, receipts',
    isVerified: 1,
    sortOrder: 15
  },
  {
    category: 'Payment Management',
    title: 'Partial Payments & Installment Tracking',
    content: 'Supports split and installment fee collections (e.g., ₹5,000 upfront and ₹5,000 next month). Tracks outstanding ledger balances and sends automated partial balance reminders.',
    sourceType: 'manual',
    tags: 'partial payment, installments, split payment, outstanding, ledger',
    isVerified: 1,
    sortOrder: 16
  },
  {
    category: 'Payment Management',
    title: 'GST-Compliant Digital Invoices',
    content: 'Generates professional, branded PDF invoices with GST calculations, HSN codes, gym logo, and breakdown of taxes, automatically sent to member email and WhatsApp.',
    sourceType: 'manual',
    tags: 'gst, invoices, taxes, pdf bills, compliance',
    isVerified: 1,
    sortOrder: 17
  },

  // 7. Trainer Management
  {
    category: 'Trainer Management',
    title: 'Personal Training (PT) Session Tracking',
    content: 'Tracks purchased PT sessions, session countdown (e.g. 12 of 20 completed), attendance punch for PT sessions, and client transformation logs.',
    sourceType: 'manual',
    tags: 'personal training, pt, sessions, trainer tracking',
    isVerified: 1,
    sortOrder: 18
  },
  {
    category: 'Trainer Management',
    title: 'Automated Trainer Commission & Payroll Calculation',
    content: 'Automatically calculates trainer commissions based on PT packages sold, session completions, or supplement sales. Generates monthly trainer salary sheets.',
    sourceType: 'manual',
    tags: 'commission, payroll, trainer salary, incentives',
    isVerified: 1,
    sortOrder: 19
  },

  // 8. Workout Management
  {
    category: 'Workout Management',
    title: 'Customized Workout Routine Builder',
    content: 'Pre-loaded database of 500+ exercises with GIF demonstrations and muscle group targeting. Trainers can build personalized workout routines (Hypertrophy, Fat Loss, Strength) and assign them directly to members.',
    sourceType: 'manual',
    tags: 'workout, exercise library, gym routine, hypertrophy, fatloss',
    isVerified: 1,
    sortOrder: 20
  },
  {
    category: 'Workout Management',
    title: 'Diet & Nutrition Plan Creator',
    content: 'Custom diet charts with calorie, protein, carb, and macro breakdown for Veg, Non-Veg, and Vegan diets. Members view daily meal plans on their mobile app.',
    sourceType: 'manual',
    tags: 'diet, nutrition, macros, calories, meal plans',
    isVerified: 1,
    sortOrder: 21
  },

  // 9. Reports & Analytics
  {
    category: 'Reports & Analytics',
    title: 'Real-Time Financial & Revenue Dashboard',
    content: 'Live analytics tracking daily collections, monthly recurring revenue (MRR), pending fee balances, expense tracking, and net profit margins.',
    sourceType: 'manual',
    tags: 'financial reports, revenue, mrr, profit, collections, analytics',
    isVerified: 1,
    sortOrder: 22
  },
  {
    category: 'Reports & Analytics',
    title: 'Member Retention & Churn Analytics',
    content: 'Identifies members at risk of quitting (e.g. absent for more than 7 consecutive days) so reception staff can proactively call and re-engage them.',
    sourceType: 'manual',
    tags: 'churn, retention, inactive members, attendance analytics',
    isVerified: 1,
    sortOrder: 23
  },

  // 10. Branch Management
  {
    category: 'Branch Management',
    title: 'Multi-Location Centralized Master Dashboard',
    content: 'Manage 2 to 50+ gym branches from a single master dashboard. Compare branch performance, track overall revenue, and allow members cross-gym access if permitted.',
    sourceType: 'manual',
    tags: 'multi-branch, chains, franchises, central dashboard, multi-gym',
    isVerified: 1,
    sortOrder: 24
  },
  {
    category: 'Branch Management',
    title: 'Inter-Branch Transfer & Roaming Memberships',
    content: 'Transfer member profiles and active subscriptions seamlessly between branches without re-registering or manual data entry.',
    sourceType: 'manual',
    tags: 'branch transfer, roaming membership, multi-location',
    isVerified: 1,
    sortOrder: 25
  },

  // 11. Subscription Pricing
  {
    category: 'Subscription Pricing',
    title: 'Starter Plan - ₹499 / Month (or ₹9,999 / Year)',
    content: 'Ideal for small gyms & boutique studios up to 150 active members. Includes digital member management, automated WhatsApp fee reminders, payment tracking, attendance logging, and free onboarding assistance.',
    sourceType: 'pricing',
    tags: 'starter, pricing, 499, small gym, budget, cheap, cost',
    isVerified: 1,
    sortOrder: 26
  },
  {
    category: 'Subscription Pricing',
    title: 'Gold Plan - ₹2,700 / Month (Most Popular)',
    content: 'Ideal for growing gyms and fitness clubs up to 500 active members. Includes everything in Starter, plus Biometric & Face Scanner hardware integration, Branded Member Android App, Diet & Workout routine planner, POS supplement inventory, and Trainer commissions.',
    sourceType: 'pricing',
    tags: 'gold, pricing, 2700, popular, medium gym, biometric included',
    isVerified: 1,
    sortOrder: 27
  },
  {
    category: 'Subscription Pricing',
    title: 'Diamond Plan - Custom Quote / ₹5,499 / Year',
    content: 'Designed for large clubs, health clubs, and multi-branch gym chains with unlimited members. Includes multi-branch master dashboard, dedicated account manager, custom API integrations, custom branding, and free data migration from old software.',
    sourceType: 'pricing',
    tags: 'diamond, pricing, enterprise, unlimited members, multi-branch',
    isVerified: 1,
    sortOrder: 28
  },

  // 12. Product Benefits
  {
    category: 'Product Benefits',
    title: '20-30% Revenue Recovery in Month 1',
    content: 'Eliminates revenue leakage and forgotten renewals. Automated WhatsApp reminders collect outstanding fees effortlessly without embarrassing face-to-face arguments.',
    sourceType: 'manual',
    tags: 'roi, benefits, revenue recovery, stop leakage, value',
    isVerified: 1,
    sortOrder: 29
  },
  {
    category: 'Product Benefits',
    title: 'Saves 3-4 Hours of Daily Manual Paperwork',
    content: 'Eliminates messy paper registers and fragile Excel spreadsheets. Registration, fee receipts, expiry alerts, and attendance are 100% automated.',
    sourceType: 'manual',
    tags: 'time saving, automation, replace excel, save hours',
    isVerified: 1,
    sortOrder: 30
  },
  {
    category: 'Product Benefits',
    title: 'Eliminates Proxy Attendance & Free Workouts',
    content: 'Biometric and turnstile gate blocking ensures that only members with an active, paid-up subscription can enter the facility.',
    sourceType: 'manual',
    tags: 'stop proxy, turnstile, paid members only, entry security',
    isVerified: 1,
    sortOrder: 31
  },

  // 13. Frequently Asked Questions
  {
    category: 'Frequently Asked Questions',
    title: 'Can I transfer existing data from Excel or another software?',
    content: 'Yes! Our support team handles free data migration from Excel sheets or your existing gym software within 24 hours. You will not lose any member records or renewal histories.',
    sourceType: 'faq',
    tags: 'excel migration, import data, switch software, data transfer',
    isVerified: 1,
    sortOrder: 32
  },
  {
    category: 'Frequently Asked Questions',
    title: 'Does GymStack work on mobile phones?',
    content: 'Yes. Gym owners and staff can operate the complete software from any smartphone or tablet via browser, and members get an Android mobile app to check workout charts, attendance, and pay renewal fees.',
    sourceType: 'faq',
    tags: 'mobile app, smartphone, android, ios, phone support',
    isVerified: 1,
    sortOrder: 33
  },
  {
    category: 'Frequently Asked Questions',
    title: 'How does the 30-day free trial work?',
    content: 'You get complete, unrestricted access to GymStack for 30 days without entering any credit card or payment. You can register your gym in 2 minutes at https://gymstack.in/register.',
    sourceType: 'faq',
    tags: 'free trial, 30 days, registration, signup, test',
    isVerified: 1,
    sortOrder: 34
  },
  {
    category: 'Frequently Asked Questions',
    title: 'How do I book a live screen demo?',
    content: 'We can arrange a quick 10-15 minute live screen walkthrough on Google Meet or Zoom at your preferred time. You can also self-register right now at https://gymstack.in/register.',
    sourceType: 'faq',
    tags: 'demo, live demo, zoom, google meet, walkthrough',
    isVerified: 1,
    sortOrder: 35
  },
  {
    category: 'Frequently Asked Questions',
    title: 'Can staff steal client phone numbers from the software?',
    content: 'No. GymStack features strict Role-Based Access Control and number masking. Staff can perform daily actions without having permission to view full phone numbers or export member lists.',
    sourceType: 'faq',
    tags: 'security, data protection, privacy, staff stealing numbers',
    isVerified: 1,
    sortOrder: 36
  },

  // 14. Technical Requirements
  {
    category: 'Technical Requirements',
    title: 'System Requirements & Device Compatibility',
    content: 'GymStack is 100% cloud-hosted. Works smoothly on Google Chrome, Safari, Edge, and Firefox on Windows PCs, Macs, iPads, Android tablets, and smartphones. Requires standard internet connection (works fine even on 4G/hotspot).',
    sourceType: 'manual',
    tags: 'system requirements, browser, internet, hardware, compatibility',
    isVerified: 1,
    sortOrder: 37
  },
  {
    category: 'Technical Requirements',
    title: 'Biometric Machine Synchronization Utility',
    content: 'Connects to local biometric devices using a lightweight Windows background sync utility that forwards device punch logs to GymStack cloud servers in real time.',
    sourceType: 'manual',
    tags: 'biometric sync, local machine, windows utility, drivers',
    isVerified: 1,
    sortOrder: 38
  }
];
