# 🏋️ GymStack AI: Global Gym Research, Lead Generation & WhatsApp Sales Automation

A unified AI ecosystem for gym business intelligence, automated lead research, and conversational sales automation.

This system combines:
1. **Global Gym Research Agent & Web Dashboard**: Discovers fitness centres across India and international markets, automatically enriches verified contact information, prevents duplicates, computes lead quality scores, and provides interactive research controls and exports.
2. **Conversational WhatsApp Sales Agent**: Connects via `@whiskeysockets/baileys` and Google Gemini (`gemini-3.5-flash-lite`) to answer inquiries, share pricing/features, deliver PDF brochures, notify sales reps of hot leads, and qualify prospects.

---

## ⚡ Quick Start

### 1. Installation & Environment
Ensure Node.js (v18+) is installed, then install dependencies:
```bash
npm install
```

Configure your `.env` file (copied or configured from your API keys):
```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# WhatsApp Agent Persona
YOUR_NAME=Alex
PERSONA_STYLE=Friendly, casual, concise sales manager for GymStack

# Research Dashboard Port (Optional, defaults to 3000)
PORT=3000

# Google Places API Key (Optional fallback; OpenStreetMap is enabled out-of-the-box)
GOOGLE_PLACES_API_KEY=your_optional_key
```

### 2. Running the System

You have three flexible execution options:

| Command | Description |
|---|---|
| `npm run dashboard` | Starts the **Global Research Agent & Lead Dashboard** on [http://localhost:3000](http://localhost:3000) |
| `npm start` | Starts the **WhatsApp Sales AI Agent** (terminal QR code pairing) |
| `npm run all` | Runs **both** WhatsApp Agent and the Research Dashboard concurrently |

---

## 🌐 Part 1: Global Gym Research Agent & Dashboard

### 📍 Target Locations
- **India**: All 28 states & 8 Union Territories (Madhya Pradesh, Maharashtra, Delhi, Uttar Pradesh, Gujarat, Rajasthan, Karnataka, Tamil Nadu, Telangana, West Bengal, Punjab, Haryana, Kerala, Goa, etc.) with pre-mapped major cities.
- **International**: USA, UK, Canada, Australia, UAE, Singapore, Germany, France, Netherlands, and additional global markets.

### 🏢 Target Business Categories
- Gym Owners & Fitness Centres
- Independent Gyms & Gym Chains
- CrossFit Studios & Functional Fitness
- Personal Training Studios
- Premium Fitness Clubs & Boutique Studios
- Women's Fitness Centres

### 🔍 Authorized Discovery & Enrichment Sources
- **OpenStreetMap & Overpass API / Nominatim**: Full global coverage without mandatory paid API keys.
- **Google Places API**: Integrated as an optional high-accuracy discovery source when API key is provided.
- **Web Enrichment Pipeline**: Analyzes official websites to extract publicly listed emails, Instagram, Facebook, and LinkedIn links, owner/founder mentions, and computes an information confidence level (`High`, `Medium`, `Low`).
- **Zero-Hallucination Policy**: Missing emails or phone numbers are never fabricated.

### 📊 Lead Pipeline & Deduplication
Every lead is validated and deduplicated in SQLite (`gymstack.db`):
- **Deduplication Matrix**: Matches on normalized name + city/country, cleaned website domain, normalized phone numbers, and normalized email.
- **Lead Quality Scoring (0 - 100)**: Automatically calculates points based on presence of direct phone (+25), WhatsApp (+20), business email (+25), verified website (+15), social profiles (+10), and owner name (+15).
- **15 Standard Lead Statuses**:
  - `New`, `Researching`, `Qualified`, `Not Qualified`, `Ready for Outreach`
  - `Contacted`, `Responded`, `Interested`, `Meeting Requested`, `Meeting Scheduled`
  - `Demo Completed`, `Follow-up Required`, `Converted`, `Not Interested`, `Unsubscribed`
- **Strict Compliance**: Newly discovered leads are saved for review and outreach preparation. **The system never sends unsolicited automated messages.**

### 🖥️ Interactive Web Dashboard ([http://localhost:3000](http://localhost:3000))
- **Live Filtering**: Search by Country, State, City, Category, Business Name, Owner Name, Lead Status, Minimum Lead Score, WhatsApp availability, and Email availability.
- **Research Automation Controls**:
  - **Start Research**: Select target country, state, city, category, and limit.
  - **Pause Research**: Temporarily halt execution mid-job.
  - **Resume Research**: Continue discovery from where it paused.
  - **Stop Research**: Terminate the current job safely.
  - **Real-Time Progress Bar**: Displays discovery count, qualified count, and percentage completion.
- **One-Click Export**:
  - **Export to CSV**: Filtered or complete dataset ready for CRM ingestion.
  - **Export to JSON**: Formatted JSON array for developer workflows and automations.

---

## 💬 Part 2: WhatsApp Sales & Support Agent

- **Conversational Memory**: Tracks per-contact conversation history for fluid, natural dialogue.
- **Human-Like Chatting**: Realistic reading and typing delays so replies feel authentic.
- **Owner Takeover & Control Commands** (sent directly via WhatsApp):
  - `#takeover`: Pause AI for the active chat to talk directly.
  - `#resume`: Unpause AI for the active chat.
  - `#bot off` / `#bot on`: Globally disable or enable auto-replies.
  - `#bot status`: Check agent uptime and status.
- **Instant Hot Lead Email Alerts**: Sends immediate notification to sales reps when a prospect shares gym details or contact information.
- **Direct PDF Brochure Delivery**: Sends the official GymStack brochure dynamically upon request.

---

## 🔌 REST API Endpoints

The dashboard server exposes the following REST API:

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Interactive Single-Page Research & Lead Management Dashboard |
| `/api/stats` | `GET` | Aggregated lead counts, qualification stats, and breakdown by status/country |
| `/api/leads` | `GET` | Paginated query of leads with filters (`country`, `state`, `city`, `category`, `status`, `search`, `hasWhatsApp`, `hasEmail`, `minScore`, `page`, `limit`) |
| `/api/leads/:id` | `GET` | Retrieve complete details for a single lead |
| `/api/leads/:id/status`| `PATCH` | Update status (`status`, `notes`) of a specific lead |
| `/api/leads/export/csv` | `GET` | Download filtered leads as a CSV spreadsheet |
| `/api/leads/export/json`| `GET` | Download filtered leads as a JSON document |
| `/api/locations` | `GET` | Pre-mapped countries, states, cities, categories, and valid lead statuses |
| `/api/research/start` | `POST` | Start a new research job (`{ country, state, city, category, limit }`) |
| `/api/research/pause` | `POST` | Pause an active research job (`{ jobId }`) |
| `/api/research/resume`| `POST` | Resume a paused research job (`{ jobId }`) |
| `/api/research/stop` | `POST` | Stop a research job (`{ jobId }`) |
| `/api/research/jobs` | `GET` | Retrieve list and history of research jobs |
| `/api/research/status/:id`| `GET` | Check real-time progress and counts for an ongoing job |

---

## 🛡️ WhatsApp Session & Data Protection
- WhatsApp credentials reside securely in `./auth_info_baileys/` and are preserved independently.
- Local SQLite database resides in `./gymstack.db` (automatically created and migrated on startup, excluded from git).
- All sensitive credentials (`.env`, `auth_info_baileys/`) are strictly git-ignored.
