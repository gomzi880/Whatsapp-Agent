# 🏋️ GymStack AI: Global Research, Leads Database & Product Knowledge Agent

A unified enterprise AI platform combining **Global Gym Research & Lead Generation**, a **Dynamic Product Knowledge & RAG Brain**, and a **Conversational WhatsApp Sales Automation Agent**.

---

## 🌟 System Architecture Overview

```text
                                  ┌─────────────────────────────┐
                                  │   GymStack System Platform  │
                                  └──────────────┬──────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          ▼                                      ▼                                      ▼
┌───────────────────┐                  ┌───────────────────┐                  ┌───────────────────┐
│ 🔍 Global Research│                  │ 🧠 Knowledge RAG  │                  │ 📱 WhatsApp Agent │
│   (OSM + Google)  │                  │  (14 Categories)  │                  │(Baileys + Gemini) │
└─────────┬─────────┘                  └─────────┬─────────┘                  └─────────┬─────────┘
          │                                      │                                      │
          ▼                                      ▼                                      ▼
┌───────────────────┐                  ┌───────────────────┐                  ┌───────────────────┐
│  Leads Repository │                  │ Knowledge Items & │                  │ Live Inquiries &  │
│ (Deduplication)   │                  │ Uploaded Manuals  │                  │ Sales Follow-ups  │
└─────────┬─────────┘                  └─────────┬─────────┘                  └─────────┬─────────┘
          │                                      │                                      │
          └──────────────────────────────────────┼──────────────────────────────────────┘
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │ 🌐 Unified Web Dashboard  │
                                   │  (http://localhost:3000)  │
                                   │ Leads, Knowledge & Safety │
                                   └───────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Installation
```bash
npm install
```

### 2. Execution Options
| Command | Action |
|---|---|
| `npm run all` | Starts **both** the WhatsApp AI Sales Agent and the Web Dashboard concurrently |
| `npm run dashboard` | Starts only the **Web Dashboard** on [http://localhost:3000](http://localhost:3000) (Leads & Knowledge) |
| `npm start` | Starts only the **WhatsApp AI Agent** |

---

## 🧠 Part 1: Product Knowledge Agent & AI Brain (Step 3)

The Product Knowledge Agent provides an administrator-controlled brain for the AI. It guarantees the agent only makes accurate, verified claims and escalates unknown questions to an administrator rather than inventing answers.

### 📚 14 Mandatory Product Knowledge Categories
Every GymStack feature is systematically organized across 14 verified categories:
1. **Product Overview**: Cloud-based gym & health club ERP platform for gyms, studios, CrossFit boxes, and chains.
2. **Gym Management Features**: Front-desk operations, role-based staff access (with number masking), inventory & supplement POS, locker management.
3. **Member Management**: Digital paperless registration, KYC documentation, renewal tracking, membership freeze & transfer rules.
4. **Membership Plans**: Monthly, quarterly, annual, and custom packages; multi-service bundle add-ons (Steam, Sauna, Zumba, PT).
5. **Attendance Management**: Biometric fingerprint devices, RFID, AI facial recognition scanners, dynamic QR code mobile check-in, automated door/turnstile gate locking for unpaid members.
6. **Payment Management**: Automated WhatsApp payment reminders (before & on due date), online payment links (UPI, Google Pay, PhonePe, Cards), instant PDF invoices/receipts, partial/installment payments.
7. **Trainer Management**: Personal training (PT) package session countdowns, automated trainer commission calculations, staff payroll.
8. **Workout Management**: 500+ exercise library with muscle targeting, custom workout routine builder, personalized diet and nutrition charts.
9. **Reports & Analytics**: Real-time collections and MRR, churn rate and retention analytics, profit/loss tracking, attendance heatmaps.
10. **Branch Management**: Centralized master dashboard for 2 to 50+ gym branches, cross-branch attendance, multi-gym financial reporting.
11. **Subscription Pricing**:
    - **Starter Plan**: ₹499 / month (or ₹9,999 / year) for up to 150 members.
    - **Gold Plan**: ₹2,700 / month for up to 500 members (Includes biometric hardware sync, branded mobile app, diet/workout builder).
    - **Diamond Plan**: Custom Quote / ₹5,499 / year for unlimited members and multi-branch chains.
12. **Product Benefits**: 20-30% revenue recovery in Month 1, saves 3-4 hours of daily manual paperwork, eliminates proxy attendance.
13. **Frequently Asked Questions**: Free 24-hour data migration from Excel/old software, 30-day risk-free trial, demo scheduling, data privacy.
14. **Technical Requirements**: 100% cloud-hosted (runs on Windows, Mac, iPad, Android), lightweight Windows background biometric sync utility.

### 🛡️ Truth & Anti-Hallucination Protocol
- **Keyword RAG Retrieval**: Tokenizes user questions and matches them against titles, tags, and verified contents with match scoring.
- **Confidence Scoring**: High, Medium, Low, or Unsupported.
- **Unsupported Feature Escalation**: When a prospect asks about an unsupported or unknown capability (e.g. pool temperature automation, medical equipment):
  - The AI explicitly declines to invent capabilities.
  - Politely states: *"I want to make sure I give you 100% accurate information on this — let me check with our product specialist and get back to you right away!"*
  - Recommends the official self-registration/demo link: `https://gymstack.in/register`.

### 🛑 Outreach Safety Guardrail
- Automated marketing outreach is kept on hold until the administrator reviews and approves the product information.
- A prominent toggle banner in the dashboard allows the administrator to authorize or pause outreach at any time.

---

## 🔍 Part 2: Global Gym Research Agent (Step 2)

- **Target Locations**:
  - **India**: All 28 states & union territories (Madhya Pradesh, Maharashtra, Delhi, Uttar Pradesh, Gujarat, Rajasthan, Karnataka, Tamil Nadu, Telangana, West Bengal, Punjab, etc.).
  - **International**: USA, UK, Canada, Australia, UAE, Singapore, Germany, France, Netherlands, and European markets.
- **Gym Categories**: Independent Gyms, Fitness Centres, Gym Chains, CrossFit Studios, PT Studios, Premium Fitness Clubs, Boutique Studios, Women's Fitness Centres.
- **Data Providers**: OpenStreetMap Overpass API + Google Places API fallback.
- **Web Contact Enrichment**: Scrapes official websites for owner/founder names, emails, phones, and social media handles.
- **Deduplication Engine**: Multi-key matching prevents duplicate leads based on normalized name + city, domain, phone, or email.
- **15 Standard Lead Statuses**: `New`, `Researching`, `Qualified`, `Not Qualified`, `Ready for Outreach`, `Contacted`, `Responded`, `Interested`, `Meeting Requested`, `Meeting Scheduled`, `Demo Completed`, `Follow-up Required`, `Converted`, `Not Interested`, `Unsubscribed`.
- **Intelligent Lead Scoring (0-100)**: Automatically scores lead quality based on verified contact channels.

---

## 📱 Part 3: Conversational WhatsApp Sales Agent (Step 1)

- **Engine**: `@whiskeysockets/baileys` directly integrated with Gemini LLM (`gemini-3.5-flash-lite` / `gemini-3.5-flash`).
- **Dynamic RAG Context**: Injects matching GymStack knowledge items directly into the prompt for every incoming message.
- **Human-like Chat Style**: Keeps replies short (1-2 sentences), casual, and natural. Multilingual in English, Hindi, and Hinglish.
- **Owner In-Chat Commands**: `#bot off`, `#bot on`, `#takeover`, `#resume`, `#takeover list`.
- **Instant Hot Lead Email Alerts**: Alerts `sales@gymstack.in` immediately when a prospect shares gym details or contact info.
- **Instant Brochure Delivery**: Attaches and sends `GymStack_Brochure.pdf` in chat upon request.

---

## 🔌 Complete REST API Endpoints

### Leads & Research Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/stats` | `GET` | Aggregated lead counts, qualification rates, status breakdown |
| `GET /api/leads` | `GET` | Filtered, paginated leads (`country`, `status`, `hasWhatsApp`, etc.) |
| `PATCH /api/leads/:id` | `PATCH` | Update lead status (`Qualified`, `Meeting Scheduled`, etc.) |
| `GET /api/leads/export/csv` | `GET` | Download leads as CSV spreadsheet |
| `GET /api/leads/export/json` | `GET` | Download leads as JSON document |
| `GET /api/locations` | `GET` | List mapped countries, states, cities, categories, statuses |
| `POST /api/research/start` | `POST` | Start discovery job (`{ country, state, city, category, limit }`) |
| `POST /api/research/pause` | `POST` | Pause running job (`{ jobId }`) |
| `POST /api/research/resume` | `POST` | Resume paused job (`{ jobId }`) |
| `POST /api/research/stop` | `POST` | Terminate running job (`{ jobId }`) |
| `GET /api/research/jobs` | `GET` | List recent research jobs and discovery statistics |
| `GET /api/research/status/:id` | `GET` | Real-time progress percentage of active job |

### Product Knowledge Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/knowledge/stats` | `GET` | Metrics: total items, categories covered, documents count, approval status |
| `GET /api/knowledge/categories` | `GET` | List the 14 mandatory product knowledge categories |
| `GET /api/knowledge/items` | `GET` | Query knowledge items with category and search filters |
| `GET /api/knowledge/items/:id` | `GET` | Retrieve single knowledge item details |
| `POST /api/knowledge/items` | `POST` | Create a new verified feature or FAQ item |
| `PUT /api/knowledge/items/:id` | `PUT` | Update an existing knowledge item |
| `DELETE /api/knowledge/items/:id` | `DELETE` | Remove a knowledge item |
| `GET /api/knowledge/settings` | `GET` | Retrieve company info, demo links, support contacts |
| `POST /api/knowledge/settings` | `POST` | Update setting key/value pair |
| `POST /api/knowledge/approval` | `POST` | Toggle automated outreach approval status (`{ approved: true/false }`) |
| `POST /api/knowledge/upload` | `POST` | Upload PDF brochures, manuals, feature docs (`multipart/form-data`) |
| `GET /api/knowledge/documents` | `GET` | List all uploaded documents and indexing status |
| `POST /api/knowledge/reindex` | `POST` | Re-index all uploaded files in `./uploads/knowledge/` |
| `POST /api/knowledge/test-query` | `POST` | Test AI RAG retrieval simulation for any user question |
