# 🌸 PetalPal

> **A Social Mood Garden Where Moments Bloom into Memories**

PetalPal is a privacy-first social reflection application that turns everyday moments into a growing virtual garden.

Users can record their day, grow mood-inspired flowers, revisit meaningful moments, interact with friends, and build a private history over time.

PetalPal combines full-stack engineering, real-time social features, machine learning, and a long-term AI architecture designed around privacy and evidence-grounded reflection.

---

## ✨ Core Features

- 🌼 Daily mood check-ins
- 🌸 Mood-based flower generation
- 🪴 Personal virtual garden
- 📖 Private Journal
- ✨ Long-term AI Events
- 🗓️ Flower and activity history
- 👥 Friend search and social interactions
- 💌 Supportive messages and flower support
- 🦋 Real-time garden visits
- 🧚 Persistent Fairy progression
- 🔐 Firebase-authenticated private accounts
- 🤖 Privacy-preserving long-term AI foundation

---

## ⚡ Core Technologies

| Area | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Node.js, Express, REST APIs |
| Database | PostgreSQL, Prisma ORM |
| Authentication | Firebase Authentication, Firebase Admin |
| Real-Time | Socket.IO |
| AI Integration | Cloudflare Workers AI |
| Long-Term AI | EventMemory, AI Jobs, Evidence Provenance |
| Machine Learning | Python, PyTorch, ONNX |
| Retrieval Foundation | PostgreSQL, pgvector |
| Infrastructure | Render, Docker |
| Reliability | Transactions, Idempotency, Rate Limiting, Worker Leases |
| Version Control | Git, GitHub |

---

## 🏗️ Architecture

```text
                   React + Vite
                        │
              Firebase Authentication
                        │
                        ▼
                 Express Backend
              REST APIs + Socket.IO
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
     Social/Garden   Journal       Event API
                                      │
                                      ▼
                                Durable AI Jobs
                                      │
                                      ▼
                                  EventMemory
                                      │
                                      ▼
                        Weekly / Monthly / Yearly
                                      │
                                      ▼
                              PostgreSQL + Prisma
```

The backend is the trusted security boundary.

User identity and resource ownership are derived from verified Firebase authentication rather than client-supplied user IDs.

---

## 🧠 Privacy-First AI

PetalPal intentionally separates **Journal** and **Event**.

### Journal

Journal entries are private reflection data.

```text
Journal
  ↓
Private Storage

No Long-Term AI
No Embeddings
No RAG
No AI Reports
```

Journal content is not used as a long-term AI memory source.

### Event

Events are explicit user-authored moments that may enter PetalPal's long-term AI system.

```text
Event
  ↓
Private EventMemory
  ↓
Weekly Recap + Trend
  ↓
Monthly Pattern Analysis
  ↓
Yearly Growth / Journey
```

AI memories and reports remain private and owner-scoped.

Historical Journal content is not automatically migrated into the AI memory system.

---

## 🤖 Long-Term AI Foundation

PetalPal's current AI architecture includes:

- Event-only long-term AI processing
- Private `EventMemory`
- Owner-isolated AI data
- Evidence and provenance tracking
- Weekly and Monthly report foundations
- Yearly report architecture
- Deterministic trend analysis
- Durable PostgreSQL-backed AI jobs
- Worker recovery and retry handling
- Idempotent Event creation
- Timezone-aware reporting
- Retrieval evaluation interfaces

PetalPal follows one key rule:

> **Backend logic calculates factual trends. AI explains them.**

```text
Verified Backend Data
        +
Relevant Event Evidence
        +
LLM Explanation
        ↓
Grounded Reflection
```

Production semantic retrieval and RAG generation are the next AI development phase.

---

## 🧠 Machine Learning

PetalPal includes a separate multi-label emotion classification pipeline.

The ML system is intentionally decoupled from long-term AI memory.

```text
Emotion ML
    ↓
Optional Structured Signal

Long-Term AI
    ↓
Memory / Trends / Reports / Retrieval
```

Current ML work includes:

- Multi-label emotion classification
- PyTorch model development
- ONNX inference research
- Leakage-resistant evaluation
- Source-aware evaluation
- Human review
- Model adjudication
- Dataset quality analysis

ML experiments are tracked in:

```text
experiments/emotion-classifier-v2/
```

---

## 🔐 Security & Reliability

PetalPal includes:

- Firebase ID-token verification
- Server-side ownership enforcement
- Database-level tenant isolation
- Cross-user authorization protection
- Input validation
- API rate limiting
- Transactional database writes
- Idempotent workflows
- Durable background processing
- AI data deletion handling
- Automated backend and integration testing

Future semantic retrieval must apply the authenticated owner's boundary before similarity search.

---

## ⭐ Engineering Highlights

- Built a full-stack React, Express, and PostgreSQL application.
- Implemented Firebase-authenticated owner isolation.
- Separated private Journal data from Event-only long-term AI.
- Built EventMemory with evidence provenance.
- Implemented durable PostgreSQL-backed AI jobs.
- Added transaction-safe and idempotent Event creation.
- Designed Weekly, Monthly, and Yearly AI report foundations.
- Built deterministic trend-analysis infrastructure.
- Developed multi-label emotion classification and evaluation workflows.
- Built real-time social interactions using Socket.IO.
- Containerized the application with Docker.
- Added automated backend, frontend, authorization, and PostgreSQL integration testing.

---

## 📂 Project Structure

```text
PetalPal/
│
├── client/
│   └── src/
│
├── lib/
│   ├── ai-events.js
│   ├── ai-identity.js
│   ├── ai-jobs.js
│   ├── ai-periods.js
│   ├── ai-worker.js
│   ├── event-memory.js
│   ├── rag-evaluation.js
│   ├── report-foundation.js
│   ├── trend-analyzer.js
│   └── yearly-query-router.js
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── scripts/
├── test/
│
├── experiments/
│   └── emotion-classifier-v2/
│
├── cloudflare-worker/
│
├── LONG_TERM_AI.md
├── SECURITY.md
├── server.js
├── package.json
├── Dockerfile
└── README.md
```

---

## 🚀 Getting Started

### Clone the repository

```bash
git clone https://github.com/JX-Technologies-Inc/Petalpal.git
cd Petalpal
```

### Install backend dependencies

```bash
npm install
```

### Install frontend dependencies

```bash
cd client
npm install
cd ..
```

### Configure environment variables

Create a `.env` file in the project root.

```env
DATABASE_URL=your_postgresql_connection_string

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

CORS_ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=false
```

Never commit private keys, Firebase service-account credentials, database passwords, or AI service secrets.

### Set up the database

```bash
npx prisma generate
npx prisma migrate deploy
```

### Start the backend

```bash
npm start
```

### Start the frontend

```bash
cd client
npm run dev
```

### Start the AI worker

```bash
npm run start:ai-worker
```

---

## 🐳 Docker

Run the application with Docker:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

---

## 🔮 AI Roadmap

```text
✅ Long-Term AI Foundation
          ↓
Embedding Benchmark
          ↓
PostgreSQL + pgvector
          ↓
Owner-Scoped Semantic Retrieval
          ↓
Retrieval Evaluation
          ↓
Grounded Weekly / Monthly Reports
          ↓
Yearly Journey
```

The next phase focuses on evaluating embedding models using retrieval quality, multilingual performance, latency, and cost before enabling production vector search.

Production RAG is not currently claimed as complete.

---

# 👥 JX Technologies Inc.

PetalPal is developed by **JX Technologies Inc.**, an AI-first startup building consumer applications around personal reflection, intelligent experiences, and meaningful social connection.

---

## 👩🏻‍💻 Jinyin Cao — Co-Founder & Product / Frontend Lead

Jinyin leads PetalPal's product strategy, frontend experience, visual design, and product growth.

### 🎯 Product Strategy & UX

- Define product vision, roadmap, and user journeys.
- Design Daily Grow, Journal, Event, garden, and social experiences.
- Conduct user research and usability testing.
- Design engagement and retention systems.

### 💻 Frontend Engineering

- Build and maintain PetalPal's frontend experience.
- Develop reusable garden, profile, and social components.
- Integrate Firebase Authentication, REST APIs, and Socket.IO.
- Implement responsive, interactive, and real-time interfaces.

### 🎨 Product Design & Growth

- Own PetalPal's visual identity and design consistency.
- Create wireframes, prototypes, and production interface specifications.
- Design garden and social experiences.
- Plan beta testing, user feedback, and early-stage growth.

### ✅ Product Delivery & Quality

- Coordinate frontend delivery and backend integration.
- Validate major user journeys.
- Conduct usability and compatibility testing.
- Support beta releases and product iteration.

---

## 👩🏻‍💻 Xingran Ma — Co-Founder & Technical / AI Lead

Xingran leads PetalPal's backend architecture, AI systems, machine learning, security, and production reliability.

### ⚙️ Backend Engineering

- Design Express REST APIs and PostgreSQL schemas.
- Implement Firebase authentication and ownership enforcement.
- Build transaction-safe and idempotent workflows.
- Maintain Prisma migrations and backend infrastructure.

### 🤖 AI Application Engineering

- Design PetalPal's Event-only long-term AI architecture.
- Build EventMemory and evidence provenance.
- Develop durable asynchronous AI processing.
- Design Weekly, Monthly, and Yearly report foundations.

### 🧠 Machine Learning

- Develop multi-label emotion classification.
- Build leakage-resistant evaluation workflows.
- Design human-review and model-adjudication protocols.
- Research PyTorch and ONNX inference workflows.

### 🔐 Security & Reliability

- Enforce tenant ownership and private-resource isolation.
- Build cross-user authorization protections.
- Implement validation, rate limiting, transactions, and retries.
- Design durable worker recovery and safe AI data lifecycle behavior.

---

## 📚 Technical Documentation

Detailed engineering work is maintained separately:

```text
experiments/emotion-classifier-v2/ML_PROGRESS.md
→ Machine Learning

SECURITY.md
→ Security

LONG_TERM_AI.md
→ Long-Term AI / Memory / Reports / Retrieval
```

---

## 🌸 About JX Technologies Inc.

**JX Technologies Inc.** builds AI-native consumer applications around meaningful human experiences.

Our goal is to help people preserve meaningful moments, understand patterns over time, build healthier habits, and maintain stronger connections while protecting privacy.

---

If you find PetalPal interesting, feel free to ⭐ the repository.