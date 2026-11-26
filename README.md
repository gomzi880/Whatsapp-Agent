# 🤖 WhatsApp Human-Like AI Auto-Reply Agent

An automated WhatsApp agent built with **Node.js**, **@whiskeysockets/baileys**, and **Google Gemini 2.5 Flash**. It links to your WhatsApp account (like WhatsApp Web) and automatically replies to incoming messages naturally, just like a real person.

---

## 🏋️ Training the GymStack Sales Manager Agent

All knowledge about **GymStack** is stored in [knowledge.js](file:///h:/agent/knowledge.js). You can edit this file anytime to update your actual pricing, features, demo links, and FAQs:

- **Company Info**: Name, tagline, support number, website, and demo booking link.
- **Key Features**: Member management, Biometric/QR attendance, WhatsApp reminders, POS, mobile apps, multi-branch, etc.
- **Packages & Pricing**: Starter, Pro, and Enterprise pricing tiers, member limits, and included features.
- **FAQs**: Answers to common questions (e.g. data migration from Excel, hardware compatibility, free trial).

The agent will automatically use this knowledge base to answer prospect inquiries on WhatsApp, explain features, share pricing, and qualify leads into booking live demos.

---

## ✨ Features

- **Human-like Chat Style**: Keeps replies short, casual, and authentic (1-2 sentences). Never sounds like a robotic customer service bot.
- **Multilingual & Slang Adaptation**: Automatically matches the sender's language (English, Hinglish, Spanish, etc.) and conversational tone.
- **Realistic Typing Simulator**:
  - Displays "typing..." in WhatsApp before responding.
  - Dynamically calculates reading and typing delay so replies don't feel instantaneous or bot-like.
- **Conversation Memory**: Remembers recent conversation history per contact for contextual, continuous replies.
- **Owner Chat Controls**: Control the agent right from your own WhatsApp by sending yourself commands:
  - `#bot off` - Temporarily disable auto-replies globally.
  - `#bot on` - Turn auto-replies back on globally.
  - `#bot status` - Check if the agent is active.
  - `#bot clear` - Reset conversation memory for the current chat.
  - `#takeover` - **Human Takeover**: Pauses AI auto-reply for the current contact so you can chat personally.
  - `#resume` - Resumes AI auto-replies for the current contact.
  - `#takeover 919876543210` - Pause AI for a specific phone number.
  - `#resume 919876543210` - Resume AI for a specific phone number.
  - `#takeover list` - View all currently paused chats.

- **🔥 Instant Lead Alerts**: Automatically emails the owner (`sales@gymstack.in`) whenever a prospect shares their gym name, member count, or email, with a direct 1-click WhatsApp link.
- **📄 Direct WhatsApp PDF Brochure**: Automatically attaches and sends `GymStack_Brochure.pdf` in the chat when requested.
- **⏰ 24-Hour Smart Follow-up Drip**: Background scheduler tracks prospect engagement and sends a gentle re-engagement check-in after 24 hours.
- **Safety Filters**:
  - Automatically ignores group chats by default.
  - Optional Whitelist and Blacklist support.

---

## 🚀 Setup Guide

### 1. Get a Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** and create a new free API key.
3. Open the `.env` file in this directory:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

### 2. Customize Your Identity & Persona
In `.env`, customize your name and personality:
```env
YOUR_NAME=Alex
PERSONA_STYLE=Friendly, casual, concise. Replies like a real human texting on WhatsApp. Never gives long formal essays. Uses natural punctuation, occasional emojis, and speaks in the same language or slang as the sender.
```

### 3. Run the Agent
Run the start command in your terminal:
```bash
npm start
```

### 4. Link WhatsApp
1. A QR code will display in your terminal.
2. Open WhatsApp on your phone.
3. Tap **Settings** (or the three dots in the top right) > **Linked Devices** > **Link a Device**.
4. Scan the QR code shown in the terminal.
5. Once connected, your agent will immediately start listening and auto-replying!

---

## ⚙️ Configuration Options (`.env`)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(Required)* | Google Gemini API key from AI Studio |
| `YOUR_NAME` | `Alex` | Your name/identity the bot represents |
| `PERSONA_STYLE` | Casual & friendly | Description of how the agent should text |
| `AUTO_REPLY_ENABLED` | `true` | Set to `false` to start the bot paused |
| `IGNORE_GROUPS` | `true` | Ignore group messages (`true` / `false`) |
| `MIN_TYPING_DELAY_MS` | `2000` | Minimum simulated typing delay (ms) |
| `MAX_TYPING_DELAY_MS` | `5000` | Maximum simulated typing delay (ms) |
| `WHITELIST_NUMBERS` | *(Empty)* | Comma-separated numbers allowed (leave empty for everyone) |
| `BLACKLIST_NUMBERS` | *(Empty)* | Comma-separated numbers to ignore |

---

## 🔒 Security & Privacy
- All session keys are stored locally in the `./auth_info_baileys/` folder.
- Never share your `./auth_info_baileys/` folder or `.env` file.
