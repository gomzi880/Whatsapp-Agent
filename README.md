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

### Email Sales Agent & Campaigns Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/email/stats` | `GET` | Email metrics: total campaigns, sent, received, replied, failed, pending, opt-outs, reply rate |
| `GET /api/email/campaigns` | `GET` | List all staged, active, and completed email campaigns |
| `POST /api/email/campaigns` | `POST` | Create a staged email campaign (`pending_approval`) with authorized sender and template |
| `POST /api/email/campaigns/:id/approve` | `POST` | Approve email campaign for dispatch |
| `POST /api/email/campaigns/:id/start` | `POST` | Start background email delivery with pacing and anti-spam protection |
| `POST /api/email/campaigns/:id/pause` | `POST` | Pause active email campaign |
| `POST /api/email/campaigns/:id/cancel` | `POST` | Cancel email campaign |
| `GET /api/email/logs` | `GET` | Live email activity log with filters (sent, received, replied, failed, pending, inbound/outbound) |
| `GET /api/email/senders` | `GET` | List the 3 authorized senders (`sales@`, `info@`, `support@gymstack.in`) and verify SMTP handshake |
| `POST /api/email/send` | `POST` | Send single direct or test email with template and optional brochure PDF |
| `POST /api/email/inbound` | `POST` | Webhook / receiver endpoint for inbound email replies, intent classification, and AI response |
| `GET /api/email/eligible-leads` | `GET` | Preview leads eligible for email outreach with verified email and deduplication |

### Automatic Meeting Scheduling & Google Calendar Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/calendar/stats` | `GET` | Calendar metrics: total, scheduled, waiting confirmation, requested, completed, cancelled, no-show, today's sessions |
| `GET /api/calendar/meetings` | `GET` | Query meetings pipeline with status filters (`Scheduled`, `Waiting for Confirmation`, `Requested`, `Completed`, `Cancelled`, `No Show`) |
| `GET /api/calendar/upcoming` | `GET` | Next upcoming 1-on-1 demo sessions with Google Meet links |
| `GET /api/calendar/slots` | `GET` | Get conflict-free available slots for date and timezone |
| `POST /api/calendar/meetings` | `POST` | Book demo meeting: generates Google Meet link, creates Google Calendar event URL, dispatches WhatsApp & Email (.ics) |
| `PATCH /api/calendar/meetings/:id/status` | `PATCH` | Update meeting status (`Scheduled`, `Rescheduled`, `Completed`, `Cancelled`, `No Show`) — auto-schedules 24h follow-up on Completed |
| `POST /api/calendar/meetings/:id/reschedule` | `POST` | Reschedule demo session to new date/time with updated dual notifications |
| `GET /api/calendar/meetings/:id/ics` | `GET` | Download standards-compliant iCalendar (.ics) invite file |

---

## 💬 Part 7: Customer Feedback & Follow-Up Agent (Step 7)

An intelligent post-demonstration feedback collection, AI response categorization, and nurturing follow-up engine.

### ❓ 1. Six Standard Post-Demo Questions
Dispatched via WhatsApp or Email after any demonstration:
1. **How was your Gym Stack demonstration?**
2. **Which features did you like most?**
3. **Which features would you like to improve?**
4. **Do you have any questions?**
5. **Are you interested in purchasing Gym Stack?**
6. **Would you like to discuss pricing?**

### 🏷️ 2. Seven Mandatory Feedback Categories
Every prospect reply is classified by Gemini (with rule-based fallback) into exactly one category:
- **`Positive feedback`**: Praises the system or walkthrough.
- **`Feature request`**: Requests specific integrations, custom reports, or mobile app features.
- **`Pricing concern`**: Inquires about custom quotes, discounts, or annual subscription tiers.
- **`Technical concern`**: Questions offline operation, hardware, biometric devices, or data security.
- **`Interested in purchasing`**: Ready to buy, requests contract/invoice, wants onboarding.
- **`Needs more time`**: Needs to discuss with partner/trainer, busy now, or requested future contact.
- **`Not interested`**: Explicitly declines; instantly updates lead status to `Unsubscribed` and permanently cancels all future outreach.

### 🛡️ 3. Follow-Up Guardrails & Anti-Spam Protection
- **Frequency Limits**: Maximum **3 follow-up attempts** within a 14-day window.
- **Cooldown Interval**: Minimum **48-hour gap** between subsequent follow-up messages.
- **Opt-Out Compliance**: Immediate and permanent cancellation of pending follow-ups upon opt-out.
- **Promised Callback Tracker (NO Voice Calls)**: When prospects say *"ping me next Tuesday"*, the date is remembered and a courteous WhatsApp/Email check-in is scheduled for that date. **The agent never initiates voice calls.**
- **High-Value Alerts**: Instant email and dashboard alerts to administrators (`sales@gymstack.in`) when high-value prospects (`Interested in purchasing` / `Pricing concern`) are identified.

### Customer Feedback & Follow-Up Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/feedback/stats` | `GET` | Feedback metrics: total responses, high-value buyers, positive, pricing concerns, feature requests, pending follow-ups |
| `GET /api/feedback/items` | `GET` | Query customer feedback entries with filters for category (7 types), sentiment, and high-value |
| `POST /api/feedback/request` | `POST` | Send 6-question feedback request to any lead via WhatsApp or Email |
| `POST /api/feedback/log` | `POST` | Ingest prospect response, run AI classification, flag high-value leads, and schedule follow-ups |
| `GET /api/feedback/followups` | `GET` | Query follow-up schedule and promised callback calendar |
| `POST /api/feedback/followups` | `POST` | Schedule custom follow-up or promised callback date with frequency checks |
| `POST /api/feedback/followups/:id/cancel` | `POST` | Cancel a scheduled follow-up item |
| `POST /api/feedback/run-due` | `POST` | Execute due follow-ups immediately with guardrails |
| `GET /api/feedback/high-value` | `GET` | List closing-ready high-value prospects for immediate sales action |
| `GET /api/feedback/unresponsive` | `GET` | Surface unresponsive leads past threshold for gentle nurturing |

---

## 📊 Part 8: Global Gym Sales Dashboard & Command Center (Step 8)

A unified executive command center and multi-agent operations hub without disturbing existing workflows.

### 📈 1. Sixteen Mandatory Dashboard Widgets
1. **Total Gyms Discovered**: Real-time count of gyms across India & international target markets.
2. **Total Qualified Leads**: Leads meeting qualification criteria (`Qualified` or score $\ge 60$).
3. **High-Priority Leads**: High-scoring leads (score $\ge 75$) primed for immediate outreach.
4. **Leads with Verified WhatsApp**: Validated WhatsApp contacts ready for chat campaigns.
5. **Leads with Verified Email**: Corporate and facility business email addresses.
6. **Messages Sent**: Aggregated outbound volume across WhatsApp and Email.
7. **WhatsApp Replies**: Inbound prospect chats received and routed.
8. **Email Replies**: Inbound prospect email queries processed.
9. **Interested Gym Owners**: Prospects exhibiting buying or demonstration interest.
10. **Meetings Requested**: Prospect-initiated demonstration inquiries.
11. **Meetings Scheduled**: Confirmed Google Meet sessions with synced calendar links.
12. **Demonstrations Completed**: Conducted 1-on-1 walkthroughs.
13. **Customer Feedback Received**: Completed post-demo review submissions.
14. **Converted Customers**: Successfully closed gym software accounts.
15. **Opt-Outs**: Unsubscribed or opted-out facilities permanently excluded from outreach.
16. **Failed Messages**: Delivery errors, bouncebacks, or unreachable recipients.

### 📉 2. Ten Analytical Sales Charts (Chart.js Engine)
- **Country-Wise Leads**: Bar chart of lead distribution across target global markets.
- **State-Wise Leads**: Regional market penetration (e.g. Maharashtra, Delhi, Karnataka, MP).
- **City-Wise Leads**: Horizontal bar chart of top metropolitan hubs.
- **Leads by Gym Category**: Segment share (CrossFit, chains, boutique, PT studios, independent).
- **Outreach Performance**: Comparative breakdown of sent messages vs replies received.
- **WhatsApp Response Rate**: Percentage reply performance on WhatsApp.
- **Email Response Rate**: Percentage reply performance on Email.
- **Interest Conversion Rate**: Percentage of contacted facilities that express interest.
- **Meeting Conversion Rate**: Percentage of interested prospects that book a demonstration.
- **Country-Wise Sales Performance**: Multi-metric pipeline by country (leads, qualified, contacted, interested).

### 🤖 3. Multi-Agent Monitoring & Telemetry
Live telemetry table tracking all 5 platform agents:
* **Global Gym Research Agent**: Market discovery and business verification.
* **WhatsApp AI Sales Agent**: Real-time conversation handling, objection handling, and pitch pacing.
* **Autonomous Email Sales Agent**: Template building, brochure dispatch, and inbound classification.
* **Google Calendar Meeting Scheduler**: Slot negotiation, Google Meet links, and `.ics` files.
* **Customer Feedback & Follow-Up Agent**: 6-question reviews, promised callback tracker, and anti-spam limits.
* **Telemetry Fields**: Running status (`Active`, `Paused`, `Stopped`), current task, last execution, next scheduled execution, tasks completed/failed, API errors, total execution time, and inline admin controls (`Start`, `Stop`, `Pause`, `Resume`).

### 🛠️ 4. Admin Overrides & Immutable Audit Trail
* **Global System Controls**: Administrators can adjust daily WhatsApp limits, email limits, cooldown intervals, and target countries.
* **Audit Trail Engine**: Persists an immutable log of every autonomous action, status advance, and administrative override with timestamps and actor attribution.

### Executive Dashboard REST Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `GET /api/dashboard/overview-stats` | `GET` | Returns all 16 executive sales KPI metrics |
| `GET /api/dashboard/analytics` | `GET` | Returns all 10 analytical chart datasets |
| `GET /api/dashboard/agents` | `GET` | Live telemetry for all 5 platform agents |
| `POST /api/dashboard/agents/:agentName/action` | `POST` | Agent control action (`start`, `stop`, `pause`, `resume`) |
| `GET /api/dashboard/audit-logs` | `GET` | Query and search the immutable audit trail |
| `POST /api/dashboard/audit-logs` | `POST` | Log administrative or automated actions |
| `GET /api/dashboard/settings` | `GET` | Retrieve global system and rate-limit settings |
| `POST /api/dashboard/settings` | `POST` | Update global settings and record audit log |
