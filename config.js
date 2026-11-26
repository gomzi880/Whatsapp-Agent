import dotenv from 'dotenv';
dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  phoneNumber: process.env.PHONE_NUMBER ? process.env.PHONE_NUMBER.replace(/[^0-9]/g, '') : '',
  yourName: process.env.YOUR_NAME || 'Alex',
  personaStyle:
    process.env.PERSONA_STYLE ||
    'Friendly, casual, concise. Replies like a real human texting on WhatsApp. Never gives long formal essays. Uses natural punctuation, occasional emojis, and speaks in the same language or slang as the sender.',
  autoReplyEnabled: process.env.AUTO_REPLY_ENABLED !== 'false',
  ignoreGroups: process.env.IGNORE_GROUPS !== 'false',
  minTypingDelayMs: parseInt(process.env.MIN_TYPING_DELAY_MS || '2000', 10),
  maxTypingDelayMs: parseInt(process.env.MAX_TYPING_DELAY_MS || '5000', 10),
  whitelistNumbers: (process.env.WHITELIST_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean),
  blacklistNumbers: (process.env.BLACKLIST_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL || 'sales@gymstack.in',
  adminPhone: process.env.ADMIN_PHONE || '918358826116',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_PORT || '587') === '465',
    user: process.env.SMTP_USER || 'sales@gymstack.in',
    pass: process.env.SMTP_PASS || '',
  },
};
