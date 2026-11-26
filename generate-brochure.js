import PDFDocument from 'pdfkit';
import fs from 'fs';
import { gymStackKnowledge } from './knowledge.js';

export function createBrochurePdf(outputPath = './GymStack_Brochure.pdf') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const k = gymStackKnowledge;

    // Header Background
    doc.rect(0, 0, 595.28, 90).fill('#1e3a8a');

    // Header Title
    doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold').text('GymStack', 40, 25);
    doc.fontSize(12).font('Helvetica').text(k.company.tagline, 40, 56);

    doc.moveDown(3);

    // About Section
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('About GymStack', 40, 115);
    doc.fillColor('#334155').fontSize(10.5).font('Helvetica').text(k.about, 40, 138, { width: 515, lineGap: 3 });

    // Packages & Pricing Section
    let y = 195;
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('Subscription Packages & Pricing', 40, y);
    y += 25;

    k.packages.forEach((pkg) => {
      doc.rect(40, y, 515, 65).fillAndStroke('#f8fafc', '#cbd5e1');

      doc.fillColor('#1e3a8a').fontSize(13).font('Helvetica-Bold').text(pkg.name, 55, y + 10);
      doc.fillColor('#2563eb').fontSize(13).font('Helvetica-Bold').text(pkg.price, 400, y + 10, { width: 140, align: 'right' });

      doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Oblique').text(`Best for: ${pkg.idealFor}`, 55, y + 27);
      doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(`Includes: ${pkg.features.slice(0, 4).join(' • ')}`, 55, y + 43, { width: 480 });

      y += 75;
    });

    // Key Features Section
    y += 10;
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('Core System Features', 40, y);
    y += 24;

    k.keyFeatures.forEach((feat) => {
      doc.fillColor('#2563eb').fontSize(10).font('Helvetica-Bold').text(`• ${feat.name}: `, 45, y, { continued: true });
      doc.fillColor('#334155').font('Helvetica').text(feat.details, { width: 505 });
      y = doc.y + 4;
    });

    // Footer / Call to Action Box
    y = Math.max(y + 10, 720);
    doc.rect(40, y, 515, 65).fill('#eff6ff');

    doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold').text('Start Your 30-Day Free Trial Today!', 55, y + 12);
    doc.fillColor('#475569').fontSize(9.5).font('Helvetica').text(`Visit ${k.company.demoLink} (No Credit Card Required)`, 55, y + 28);
    doc.fillColor('#2563eb').fontSize(9.5).font('Helvetica').text(`Support / Inquiries: ${k.company.supportPhone} | ${k.company.website}`, 55, y + 44);

    doc.end();

    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
}

// Auto-run if executed directly
if (process.argv[1]?.includes('generate-brochure.js')) {
  createBrochurePdf().then((path) => console.log('✅ Brochure generated:', path));
}
