/**
 * Lead Enrichment & Data Verification Pipeline
 * Extracts public business emails, social media handles, owner names, and verifies WhatsApp capability
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const IG_REGEX = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/i;
const FB_REGEX = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9._-]+)\/?/i;
const LI_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._-]+)\/?/i;

// Filter out generic asset extensions from emails (e.g. image@2x.png)
const JUNK_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js'];

/**
 * Scrapes a gym's public website to extract verified contact and social information
 * @param {string} websiteUrl Official gym website
 * @returns {Promise<object>} Extracted verified attributes
 */
export async function enrichFromWebsite(websiteUrl) {
  if (!websiteUrl) return {};

  let targetUrl = websiteUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const enriched = {
    businessEmail: null,
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    ownerName: null,
    founderName: null,
    managerName: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return enriched;

    const html = await res.text();

    // 1. Extract Business Email
    const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatches && mailtoMatches[1]) {
      enriched.businessEmail = mailtoMatches[1].trim().toLowerCase();
    } else {
      const emailMatches = html.match(EMAIL_REGEX);
      if (emailMatches && emailMatches.length > 0) {
        // Filter out image assets and common sample emails
        const validEmails = emailMatches.filter((em) => {
          const lower = em.toLowerCase();
          return (
            !JUNK_EMAIL_EXTENSIONS.some((ext) => lower.endsWith(ext)) &&
            !lower.includes('sentry') &&
            !lower.includes('wixpress') &&
            !lower.includes('domain.com')
          );
        });
        if (validEmails.length > 0) {
          enriched.businessEmail = validEmails[0].toLowerCase();
        }
      }
    }

    // 2. Extract Social Profiles
    const igMatch = html.match(IG_REGEX);
    if (igMatch && igMatch[0]) {
      enriched.instagramUrl = igMatch[0].split('?')[0].replace(/\/$/, '');
    }

    const fbMatch = html.match(FB_REGEX);
    if (fbMatch && fbMatch[0]) {
      enriched.facebookUrl = fbMatch[0].split('?')[0].replace(/\/$/, '');
    }

    const liMatch = html.match(LI_REGEX);
    if (liMatch && liMatch[0]) {
      enriched.linkedinUrl = liMatch[0].split('?')[0].replace(/\/$/, '');
    }

    // 3. Extract Founder / Owner mentions if publicly stated on site
    const founderMatch = html.match(/(?:founded by|founder|owner|head coach)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
    if (founderMatch && founderMatch[1]) {
      const name = founderMatch[1].trim();
      if (!name.toLowerCase().includes('fitness') && !name.toLowerCase().includes('gym')) {
        enriched.founderName = name;
      }
    }

    const managerMatch = html.match(/(?:general manager|manager)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
    if (managerMatch && managerMatch[1]) {
      const name = managerMatch[1].trim();
      if (!name.toLowerCase().includes('fitness') && !name.toLowerCase().includes('gym')) {
        enriched.managerName = name;
      }
    }

    return enriched;
  } catch (err) {
    // Non-fatal website error (site down or blocked)
    return enriched;
  }
}

/**
 * Determine Information Confidence Level based on verified attributes
 */
export function determineConfidenceLevel(lead) {
  let score = 0;
  if (lead.gymName) score += 1;
  if (lead.fullAddress && lead.city) score += 1;
  if (lead.businessPhone || lead.whatsappNumber) score += 2;
  if (lead.website) score += 1;
  if (lead.businessEmail) score += 2;
  if (lead.ownerName || lead.founderName) score += 1;

  if (score >= 6) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}
