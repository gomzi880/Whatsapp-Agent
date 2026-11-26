/**
 * GymStack Knowledge Base
 * 
 * You can edit all details below: add your real pricing, features, demo links, 
 * discounts, and contact info. The AI will use this exact data to answer 
 * all customer questions.
 */

export const gymStackKnowledge = {
  company: {
    name: "GymStack",
    tagline: "All-in-One Online Gym & Fitness Club Management Software",
    website: "https://gymstack.in", // update with your website
    demoLink: "https://gymstack.in/register", // update with your demo link
    supportPhone: "+91-8358826116",
    freeTrial: "30-day free trial with full access (no credit card required)",
  },

  about: `GymStack is a cloud-based gym management software designed for gym owners, fitness studios, CrossFit boxes, and multi-branch chains. It automates day-to-day operations like member registrations, fee collection, attendance, and member retention.`,

  keyFeatures: [
    {
      name: "Member Management",
      details: "Digital member profiles, KYC/documents, membership renewal tracking, expiry alerts, and freeze/transfer options."
    },
    {
      name: "Automated Billing & WhatsApp Reminders",
      details: "Generates digital GST invoices, sends automatic fee due and overdue reminders on WhatsApp with direct payment links (UPI, Cards, Netbanking)."
    },
    {
      name: "Attendance System",
      details: "Supports Biometric fingerprint machines, facial recognition scanners, and QR code check-in via the member mobile app."
    },
    {
      name: "Member Mobile App (Android)",
      details: "Members can view workout plans, diet charts, renewal dates, pay fees online, and book personal training sessions."
    },
    {
      name: "Trainer & Staff Management",
      details: "Staff attendance, salary & commission calculation for personal trainers (PT), trainer client allocation."
    },
    {
      name: "POS & Inventory",
      details: "Sell supplements, gym merchandise, water/drinks with built-in stock tracking and receipts."
    },
    {
      name: "Diet & Workout Planner",
      details: "Pre-built and customizable diet plans and exercise routines assignable to members via mobile app."
    },
    {
      name: "Multi-Branch Management",
      details: "Manage multiple gym locations from a single admin master dashboard with centralized financial reporting."
    },
    {
      name: "Reports & Analytics",
      details: "Revenue reports, active vs expired members, churn rate, monthly expense vs profit tracking."
    }
  ],

  packages: [
    {
      name: "Starter Plan",
      idealFor: "Small gyms & personal studios (up to 150 active members)",
      price: "₹499 / month (or ₹9,999 / year)",
      features: [
        "Up to 150 members",
        "Member management & renewals",
        "Automated WhatsApp fee reminders",
        "Basic financial & attendance reports",
        "Free setup & onboarding"
      ]
    },
    {
      name: "Gold Plan (Most Popular)",
      idealFor: "Growing gyms & fitness centers (up to 500 active members)",
      price: "₹2700 / month",
      features: [
        "Up to 500 members",
        "Everything in Starter",
        "Biometric & Face Scanner integration",
        "Branded Member Mobile App",
        "Diet & Workout planner",
        "Trainer commissions & PT tracking",
        "POS & Supplement inventory"
      ]
    },
    {
      name: "Diamond Plan",
      // idealFor: "Large clubs & multi-branch gym chains (Unlimited members)",
      price: "Custom quote / ₹5,499 / Year",
      features: [
        "Unlimited members",
        "Multi-branch master dashboard",
        "Dedicated account manager & 24/7 priority support",
        "Custom API integrations & custom branding",
        "Data migration from old software free of cost"
      ]
    }
  ],

  faq: [
    {
      q: "Can I transfer my existing data from Excel or another software?",
      a: "Yes! Our team migrates all your existing member data from Excel or old software to GymStack for free within 24 hours. You don't have to enter anything manually."
    },
    {
      q: "Does GymStack work on mobile phones?",
      a: "Yes, gym owners can manage everything from their smartphone or laptop, and members get an Android mobile app to check their profile, attendance, and diet plans."
    },
    {
      q: "Does it support biometric fingerprint or facial recognition machines?",
      a: "Yes! We integrate with major biometric, RFID, and facial recognition devices (eSSL, Realtime, ZKTeco, Mantra, etc.). Check-in logs sync automatically in real-time."
    },
    {
      q: "Can GymStack automatically lock or block attendance if a member's fees are unpaid?",
      a: "Yes! If integrated with a biometric machine or turnstile/tripod gate, GymStack can automatically deny entry or alert the front desk when an expired member tries to check in."
    },
    {
      q: "How do automated WhatsApp fee reminders work?",
      a: "GymStack sends automated WhatsApp messages before expiry (e.g., 3 days and 1 day prior) and on the due date with a direct online payment link. You never have to manually remind members again!"
    },
    {
      q: "Can members pay their fees online via UPI, Google Pay, PhonePe, or cards?",
      a: "Yes! Invoices sent on WhatsApp contain secure payment links. Once the member pays, the receipt is sent automatically on WhatsApp and their membership updates instantly."
    },
    {
      q: "Can members pause or freeze their membership if they travel or get injured?",
      a: "Yes, you can easily freeze a membership for a set number of days. The system automatically extends their expiry date by those exact days."
    },
    {
      q: "Does GymStack allow partial or installment payments?",
      a: "Yes! Members can pay in partial installments (e.g., half upfront and half next week). GymStack tracks pending balances and sends reminders for the remaining amount."
    },
    {
      q: "Can I assign diet plans and workout routines to members?",
      a: "Yes! You can choose from pre-built fitness/diet templates or create customized workout and nutrition plans and assign them directly to members on their Android app."
    },
    {
      q: "Can I track Personal Training (PT) packages and trainer commissions?",
      a: "Yes! GymStack tracks PT packages, sessions remaining, and automatically calculates trainer commissions and monthly staff payroll."
    },
    {
      q: "Is our member data secure? Can staff or trainers steal client phone numbers?",
      a: "GymStack uses bank-grade cloud security and Role-Based Access Control. You can restrict receptionists or trainers so they cannot export or see full contact numbers."
    },
    {
      q: "Why should I use GymStack instead of Excel or pen-and-paper registers?",
      a: "Registers and Excel lead to missed renewal fees, attendance cheating, and hours of manual calls. GymStack prevents revenue leakage, automates WhatsApp collection, and usually recovers 20-30% more fees in the first month."
    },
    {
      q: "My gym is small with under 50 members. Is GymStack worth it for me?",
      a: "Definitely! Our Starter Plan at just ₹499/month gives you a professional digital setup with automated WhatsApp reminders. It pays for itself if it saves you just one member's missed fee!"
    },
    {
      q: "How does the 30-day free trial work?",
      a: "You get full, unrestricted access to GymStack for 30 days without entering any credit card. You can test member registrations, WhatsApp reminders, and reports completely risk-free at https://gymstack.in/register."
    },
    {
      q: "How can I see a live demo?",
      a: "I can arrange a quick 10-15 minute live screen demo over Google Meet/Zoom to show you how GymStack works for your gym. You can also self-register right now at https://gymstack.in/register. What time works best for you today or tomorrow?"
    }
  ]
};
