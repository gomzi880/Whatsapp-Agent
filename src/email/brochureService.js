import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { gymStackKnowledge } from '../../knowledge.js';

const BROCHURE_DIR = path.resolve('public', 'brochure');
const BROCHURE_PATH = path.join(BROCHURE_DIR, 'GymStack_Official_Brochure.pdf');

/**
 * Ensures the brochure directory exists
 */
function ensureDir() {
  if (!fs.existsSync(BROCHURE_DIR)) {
    fs.mkdirSync(BROCHURE_DIR, { recursive: true });
  }
}

/**
 * Generates an official GymStack product brochure PDF using PDFKit
 * Returns the file path of the brochure.
 */
export async function generateBrochurePdf() {
  ensureDir();

  // If already generated and fresh (less than 24h old), return existing
  if (fs.existsSync(BROCHURE_PATH)) {
    const stats = fs.statSync(BROCHURE_PATH);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      return BROCHURE_PATH;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'GymStack - Complete Gym Management Platform',
          Author: 'GymStack Technologies',
          Subject: 'Product Brochure and Feature Guide'
        }
      });

      const writeStream = fs.createWriteStream(BROCHURE_PATH);
      doc.pipe(writeStream);

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill('#1e3a8a');

      doc.fillColor('#ffffff')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('GYMSTACK', 40, 30);

      doc.fontSize(12)
        .font('Helvetica')
        .text('Smart Gym & Fitness Management Platform — All-in-One Operations', 40, 65);

      doc.moveDown(3);

      // Value Proposition
      doc.fillColor('#0f172a')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Simplify Operations. Retain Members. Boost Revenue.', 40, 120);

      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#334155')
        .text(
          'GymStack is India’s leading gym management platform engineered for gym owners, fitness clubs, CrossFit boxes, and boutique studios. Manage your entire fitness facility from a unified cloud dashboard with automated WhatsApp notifications, biometrics, and online payments.',
          40, 145, { width: 515, align: 'justify', lineGap: 3 }
        );

      // Core Features Section
      doc.moveDown(1.5);
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('CORE PLATFORM CAPABILITIES');

      doc.strokeColor('#cbd5e1').lineWidth(1)
        .moveTo(40, doc.y + 2)
        .lineTo(555, doc.y + 2)
        .stroke();

      doc.moveDown(0.8);

      const features = [
        { name: 'Member Management', desc: 'Complete digital profiles, medical history, emergency contacts, photo capture, and digital locker assignment.' },
        { name: 'Automated Fee Collection', desc: 'Integrated UPI and cards with automated WhatsApp payment links and instant GST-compliant digital receipts.' },
        { name: 'Smart Attendance & Access', desc: 'Contactless QR scan check-in and optional biometric fingerprint/facial recognition turnstile integration.' },
        { name: 'Trainer & Class Rostering', desc: 'Schedule personal training sessions, group fitness classes, and track trainer payouts and commissions.' },
        { name: 'Member Mobile Experience', desc: 'Members track their workout regimens, body composition progress, renewal dates, and diet charts.' },
        { name: 'Multi-Branch Analytics', desc: 'Unified owner control tower: switch branches, compare revenue metrics, and view real-time occupancy.' }
      ];

      features.forEach((feat) => {
        doc.fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#1e293b')
          .text(`• ${feat.name}: `, { continued: true })
          .font('Helvetica')
          .fillColor('#475569')
          .text(feat.desc);
        doc.moveDown(0.4);
      });

      // Pricing Packages Box
      doc.moveDown(1);
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('TRANSPARENT SUBSCRIPTION PACKAGES');

      doc.strokeColor('#cbd5e1').lineWidth(1)
        .moveTo(40, doc.y + 2)
        .lineTo(555, doc.y + 2)
        .stroke();

      doc.moveDown(0.8);

      const packages = gymStackKnowledge.packages || [
        { name: 'Starter Plan', price: '₹499 / month', idealFor: 'Single-branch local gyms up to 150 members', features: ['Core member registry', 'Manual attendance', 'WhatsApp reminders', 'Basic reports'] },
        { name: 'Gold Plan (Most Popular)', price: '₹2,700 / month', idealFor: 'Growing gyms & fitness studios up to 600 members', features: ['Everything in Starter', 'Automated UPI payment links', 'Biometric device sync', 'Trainer management', 'Advanced analytics'] },
        { name: 'Diamond Plan', price: 'Custom Pricing', idealFor: 'Multi-branch gym chains & premium fitness franchises', features: ['Unlimited members & branches', 'Centralized owner control tower', 'Custom branded member mobile app', 'Dedicated account manager'] }
      ];

      packages.forEach((pkg) => {
        doc.rect(40, doc.y, 515, 45)
          .fillAndStroke('#f8fafc', '#e2e8f0');

        doc.fillColor('#0f172a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`${pkg.name} — ${pkg.price}`, 50, doc.y - 38);

        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(`Best for: ${pkg.idealFor} | Key: ${pkg.features.slice(0, 3).join(', ')}`, 50, doc.y - 24, { width: 495 });

        doc.moveDown(1.5);
      });

      // Footer / CTA Box
      doc.moveDown(0.5);
      const ctaY = doc.y;
      doc.rect(40, ctaY, 515, 65).fill('#eff6ff');

      doc.fillColor('#1e3a8a')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('START YOUR 30-DAY UNRESTRICTED FREE TRIAL', 55, ctaY + 12);

      doc.fillColor('#334155')
        .fontSize(9)
        .font('Helvetica')
        .text('Instant setup in 2 minutes. No credit card required. Import existing member data easily.', 55, ctaY + 28);

      doc.fillColor('#2563eb')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Free Trial: https://gymstack.in/register  |  Support: sales@gymstack.in  |  WhatsApp: +91 83588 26116`, 55, ctaY + 44);

      doc.end();

      writeStream.on('finish', () => resolve(BROCHURE_PATH));
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns brochure metadata for attachments
 */
export async function getBrochureAttachment() {
  const filePath = await generateBrochurePdf();
  return {
    filename: 'GymStack_Product_Brochure.pdf',
    path: filePath,
    contentType: 'application/pdf'
  };
}
