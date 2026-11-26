# 🏋️ GymStack AI: Global Research, Leads, Product Knowledge & WhatsApp Outreach Agent

A unified enterprise AI platform combining **Global Gym Research & Lead Discovery**, an **Administrator-Controlled Dynamic RAG Knowledge Brain**, and an **Autonomous WhatsApp Sales & Outreach Agent**.

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
          └──────────────────────────────────────┴──────────────────────────────────────┘
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │ 🌐 Unified Web Dashboard  │
                                   │  (http://localhost:3000)  │
                                   │ Leads, Knowledge, Outreach│
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
| `npm run dashboard` | Starts only the **Web Dashboard** on [http://localhost:3000](http://localhost:3000) |
| `npm start` | Starts only the **WhatsApp AI Agent** |

---

## 📱 Part 1: Connected WhatsApp AI Outreach & Conversation Intelligence (Step 4)

The system extends your existing working WhatsApp connection (`@whiskeysockets/baileys`) so it can autonomously communicate with qualified gym business prospects. **No separate chatbot is created.**

### 🎯 1. Lead Selection & Exclusion Engine
- **Selection Criteria**:
  - `Qualified` or `Ready for Outreach` status.
  - Verified business WhatsApp number available (`hasWhatsApp = 1` and `normalizedPhone`).
  - Minimum lead score threshold (e.g. 40+).
  - Target country, state, city, and business category filters.
  - Outreach eligibility confirmed by administrator (`isOutreachApproved()`).
- **Exclusion Filters (Strict)**:
  - Excludes duplicates (normalized phone, domain, business name).
  - Excludes unsubscribed / opted-out contacts (`Unsubscribed`, `Not Interested`).
  - Excludes leads contacted within the last 7 days.
  - Excludes contacts with active human takeover.

### ✍️ 2. Individualized Personalized Outreach
Generates a warm, professional, non-aggressive introduction for every gym:
```text
Hello {ownerName}! I came across {gymName} in {city} and wanted to introduce GymStack.

GymStack is an all-in-one gym management platform that helps fitness businesses automate member attendance (biometrics & face scanners), collect fees on WhatsApp, manage trainers, and simplify daily operations.

We would love to show you how GymStack can simplify day-to-day management for {gymName}.

Would you be open to seeing a quick 5-minute product walkthrough or testing our 30-day free trial?

(Reply 'stop' anytime if you prefer not to receive updates)
```

### 🧠 3. Conversation Intelligence & Intent Classification
Every incoming message from a prospect is analyzed in real time:
- **`opt_out`** ("stop", "unsubscribe", "not interested", "don't message"):
  - Advances lead status to `Unsubscribed` or `Not Interested`.
  - Halts all automated outreach immediately.
  - Sends a courteous closing acknowledgment: *"Understood! I have removed your number from our outreach list and won't message you again. Wishing you continued success!"*
- **`demo_requested`** ("demo", "walkthrough", "show me", "zoom", "schedule"):
  - Advances lead status to `Meeting Requested`.
- **`interested`** ("yes", "tell me more", "share details", "batao"):
  - Advances lead status to `Interested`.
- **`pricing`** ("price", "cost", "kitna hai", "packages"):
  - Advances lead status to `Responded` and provides exact plan pricing (Starter ₹499/mo, Gold ₹2,700/mo, Diamond custom).
- **`follow_up_later`** ("busy", "tomorrow", "next week", "kal bat karo"):
  - Advances lead status to `Follow-up Required`.
- **`already_using_other`** ("already using another software"):
  - Highlights GymStack's free 24-hour data migration from Excel/old software.

### 🛡️ 4. Outreach Safety & Administrator Controls
- **Staged Approval Workflow**: New campaigns start in `Pending Approval`. The administrator must click **"Approve"** before any messages can be sent.
- **Pacing & Anti-Spam Delays**: Uses humanized random delays (15 to 30 seconds) between messages.
- **Interactive Campaign Controls**: Start, Pause, Resume, and Stop campaigns at any time from the dashboard.
- **Live Test Outreach Tool**: Administrators can send an individualized test message to their own WhatsApp number to verify formatting and tone before launching campaigns.
- **Live Feed**: Real-time log of sent messages, prospect replies, intent classifications, and opt-outs.

---

## 🧠 Part 2: Product Knowledge Agent & RAG Brain (Step 3)

- **14 Standard Categories**: Product Overview, Gym Management, Member Management, Membership Plans, Attendance Management, Payment Management, Trainer Management, Workout Management, Reports & Analytics, Branch Management, Subscription Pricing, Product Benefits, FAQs, Technical Requirements.
- **Dynamic Context Injection**: Extracts keywords from incoming WhatsApp questions and retrieves matching verified features from SQLite.
- **Zero-Hallucination Policy**: If a prospect asks about an unsupported feature (e.g. pool temperature automation, medical hardware), the AI declines to invent capabilities and escalates to administrator.
- **Document Uploader**: Uploads and extracts text from PDF brochures, manuals, feature lists, pricing sheets, screenshots, and demo links.

---

## 🔍 Part 3: Global Gym Research Agent (Step 2)

- **Locations**: All 28 Indian states & union territories + International markets (USA, UK, Canada, Australia, UAE, Singapore, Germany, France, Netherlands).
- **Gym Categories**: Independent Gyms, Fitness Centres, Gym Chains, CrossFit Studios, PT Studios, Premium Clubs, Boutique Studios, Women's Fitness Centres.
- **Discovery Sources**: OpenStreetMap / Overpass API + Google Places API.
- **Lead Deduplication**: Multi-key matching on normalized business name + city, domain, phone, and email.
- **15 Lifecycle Statuses**: `New`, `Researching`, `Qualified`, `Not Qualified`, `Ready for Outreach`, `Contacted`, `Responded`, `Interested`, `Meeting Requested`, `Meeting Scheduled`, `Demo Completed`, `Follow-up Required`, `Converted`, `Not Interested`, `Unsubscribed`.

---

## 🔌 REST API Endpoints Reference

### Outreach & Campaigns Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/outreach/stats` | `GET` | Outreach metrics: total campaigns, sent, replies, response rate, interested, opt-outs |
| `GET /api/outreach/campaigns` | `GET` | List all outreach campaigns and progress |
| `POST /api/outreach/campaigns` | `POST` | Create a new targeted campaign (staged in `pending_approval`) |
| `POST /api/outreach/campaigns/:id/approve` | `POST` | Approve campaign for execution |
| `POST /api/outreach/campaigns/:id/start` | `POST` | Start campaign background loop |
| `POST /api/outreach/campaigns/:id/pause` | `POST` | Pause campaign |
| `POST /api/outreach/campaigns/:id/resume` | `POST` | Resume paused campaign |
| `POST /api/outreach/campaigns/:id/stop` | `POST` | Permanently terminate campaign |
| `POST /api/outreach/test` | `POST` | Send a test outreach message to administrator's phone number |
| `GET /api/outreach/messages` | `GET` | Paginated live messages log (`role`, `intent`, `leadId`) |
| `GET /api/outreach/eligible-leads` | `GET` | Preview leads eligible for outreach matching filters |
| `POST /api/outreach/preview-template` | `POST` | Render personalized template for a preview lead |
| `GET /api/outreach/connection` | `GET` | Check if Baileys WhatsApp socket is currently connected |

### Leads & Research Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/stats` | `GET` | Aggregated lead metrics |
| `GET /api/leads` | `GET` | Query leads with filters & pagination |
| `PATCH /api/leads/:id` | `PATCH` | Update lead status (`Qualified`, `Meeting Scheduled`, etc.) |
| `GET /api/leads/export/csv` | `GET` | Download leads as CSV |
| `GET /api/leads/export/json` | `GET` | Download leads as JSON |
| `GET /api/locations` | `GET` | Mapped countries, states, cities, categories, statuses |
| `POST /api/research/start` | `POST` | Start gym discovery job |
| `POST /api/research/pause` | `POST` | Pause discovery job |
| `POST /api/research/resume` | `POST` | Resume discovery job |
| `POST /api/research/stop` | `POST` | Terminate discovery job |

### Product Knowledge Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/knowledge/stats` | `GET` | Knowledge base metrics & approval status |
| `GET /api/knowledge/categories` | `GET` | List the 14 mandatory product categories |
| `GET /api/knowledge/items` | `GET` | Query knowledge items |
| `POST /api/knowledge/items` | `POST` | Create a verified knowledge item |
| `PUT /api/knowledge/items/:id` | `PUT` | Update a knowledge item |
| `DELETE /api/knowledge/items/:id` | `DELETE` | Delete a knowledge item |
| `POST /api/knowledge/upload` | `POST` | Upload PDF brochures and manuals |
| `POST /api/knowledge/reindex` | `POST` | Re-index all uploaded documents |
| `POST /api/knowledge/test-query` | `POST` | Test AI RAG retrieval simulation |
