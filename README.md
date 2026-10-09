<div align="center">

# 🌸 PetalPal

<p><em>A Social Mood Garden Where Moments Bloom into Memories</em></p>

<p>A privacy-first social reflection app that turns everyday emotions and meaningful moments into a living virtual garden.</p>

![React Native](https://img.shields.io/badge/React%20Native-Expo-000000?logo=expo&logoColor=white)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-2F6B3B)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Prisma-315D8A)
![AI](https://img.shields.io/badge/AI-Cloudflare%20Workers%20AI-F38020)

[Product](#-product) · [Technology](#-technology-stack) · [Architecture](#-system-architecture) · [Status](#-project-status) · [Getting Started](#getting-started) · [Team](#-team)

</div>

---

## 🚀 Getting Started

Clone the repository:

```bash
git clone https://github.com/starstarrr/PetalPal_v2.git
cd PetalPal_v2
```

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

Generate Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend:

```bash
npm start
```

Start the frontend:

```bash
cd client
npm run dev
```

Start the AI worker:

```bash
npm run start:ai-worker
```

---

## 📚 Technical Documentation

Detailed engineering documentation is maintained separately:

- [`MOBILE.md`](./MOBILE.md) — Physical-iPhone setup, mobile authentication, and isolated native testing runbook
- [`LONG_TERM_AI.md`](./LONG_TERM_AI.md) — Long-term AI, memory, reports, and retrieval architecture
- [`SECURITY.md`](./SECURITY.md) — Security architecture and backend hardening
- [`experiments/emotion-classifier-v2/ML_PROGRESS.md`](./experiments/emotion-classifier-v2/ML_PROGRESS.md) — Machine learning experiments and evaluation

---

## 🌱 Product

PetalPal combines **personal reflection, interactive virtual environments, social connection, and AI** in one experience.

Instead of treating journaling as a static text workflow, PetalPal turns emotions, events, and reflection into an evolving world of **flowers, gardens, Fairy interactions, social visits, and long-term personal patterns**.

### Core Experience

| Experience | What it does |
| --- | --- |
| 🌸 **Mood-to-Garden** | Turns meaningful Events into mood-inspired flowers and garden progression |
| 📖 **Private Journal** | Keeps personal journaling separate from long-term AI processing |
| 👥 **Social Garden** | Supports friend search, requests, Garden visits, support, and messages |
| 🧚 **Interactive Fairy** | Uses Spine animation for state-driven Fairy experiences |
| 🧠 **Long-Term Reflection** | Builds EventMemory, retrieval foundations, and grounded reflection workflows |

### 🌸 Mood-to-Garden

Daily activity and meaningful Events can influence:

- Flower generation
- Garden progression
- Visual states
- Fairy interactions
- Reflection history

Rather than storing emotions only as text, PetalPal turns them into something users can see and interact with.

### 🎨 Dynamic Environments

PetalPal uses interactive Garden and Treehouse environments instead of static form-based screens.

Garden rendering, camera transforms, zoom/pan, and state-driven visuals make these environments interactive.

### 👥 Social Garden

Social features include:

- Friend search and requests
- Garden visits
- Garden privacy controls
- Flower support
- Supportive messages
- Visitor history
- Real-time interactions

### 📖 Journal & Treehouse

The Treehouse is part of PetalPal’s interactive environment. Private journaling remains intentionally separate from explicit AI-enabled Events.

| Private Journal | AI-enabled Event direction |
| --- | --- |
| Journal → private storage | Event → EventMemory |
| No long-term AI, embeddings, RAG, or AI reports | Weekly Reflection → Monthly Patterns → Yearly Journey |

> **Privacy boundary:** Journal remains private and separate from long-term AI. Grounded Weekly / Monthly reflections and the Interactive Yearly Journey are still in progress.

This boundary allows PetalPal to build personalized long-term experiences without treating every private Journal entry as AI data.

### 🧚 Fairy Experience

Spine-powered skeletal animation brings the Fairy to life through character states and state-driven interactions. Daily activity and meaningful Events can influence Fairy interactions.

---

## ⚡ Technology Stack

| Area | Technologies |
| --- | --- |
| Mobile Frontend | React Native, Expo, React Native Skia |
| Web Frontend | React, Vite, JavaScript |
| Character Animation | Spine |
| Visual Design | Adobe Photoshop, Custom Visual Assets |
| Backend | Node.js, Express, REST APIs |
| Database | PostgreSQL, Prisma ORM |
| Authentication | Firebase Authentication, Firebase Admin |
| Real-Time | Socket.IO |
| AI Integration | Cloudflare Workers AI |
| Long-Term AI | EventMemory, Evidence Provenance, Background AI Jobs |
| Machine Learning | Python, PyTorch, ONNX |
| Retrieval | PostgreSQL, pgvector |
| Infrastructure | Render, Docker |
| Reliability | Transactions, Idempotency, Rate Limiting, Background Workers |

---

## 🏗️ System Architecture

```text
React / React Native + Expo
            │
Skia Scenes + Spine Animation
            │
   Firebase Authentication
            │
            ▼
      Express Backend
    REST APIs + Socket.IO
            │
   ┌────────┼─────────┐
   │        │         │
   ▼        ▼         ▼
Garden   Journal   Event / AI
Social               │
                     ▼
              Background AI Jobs
                     │
                     ▼
                 EventMemory
                     │
                     ▼
              Long-Term Reflection
                     │
                     ▼
              PostgreSQL + Prisma
```

The backend acts as PetalPal's trusted security boundary. Authentication, authorization, private-resource ownership, and AI workflow controls are enforced server-side rather than trusting client-supplied user IDs or model output.

---

## 🎨 Frontend & Interactive Experience

The mobile experience combines:

| Layer | Role in the experience |
| --- | --- |
| React Native + Expo | Application structure and core mobile flows |
| React Native Skia | Garden rendering, camera transforms, zoom/pan, and state-driven visuals |
| Spine | Fairy skeletal animation and character states |
| Adobe Photoshop | Custom Garden, Flower, Treehouse, icon, and interface assets |

The web frontend uses React, Vite, and JavaScript. Firebase Authentication, REST APIs, and Socket.IO connect the interfaces to account and real-time social workflows.

---

## ⚙️ Backend Engineering

PetalPal's backend is built with **Node.js, Express, PostgreSQL, and Prisma**.

### Core Capabilities

- Authentication and authorization
- Journal storage
- Events and flower generation
- Garden and Flower state
- Fairy runtime state
- Friend relationships
- Real-time social interactions
- AI processing
- Long-term memory infrastructure

### Reliability

- Transactional database operations
- Idempotent workflows
- Input validation
- API rate limiting
- Database migrations
- Background processing
- Failure recovery
- Owner-scoped private resources

These controls keep core product flows reliable even when external AI services or background processing fail.

---

## 🤖 AI, RAG & Long-Term Memory

PetalPal uses AI as a **supporting product layer**, not as an unrestricted controller of private user content.

### Long-Term AI Foundation

The architecture includes:

- Private EventMemory
- Evidence provenance
- Owner-scoped retrieval
- Durable background AI processing
- Retrieval evaluation interfaces
- Weekly and Monthly reflection foundations
- Yearly reflection architecture
- Trend-analysis infrastructure

> **Backend systems calculate factual trends. AI explains them.**

```text
Verified Data
    +
Relevant Events
    +
AI Explanation
    ↓
Grounded Reflection
```

### Retrieval & RAG Direction

PetalPal is building toward owner-scoped RAG workflows that combine:

- PostgreSQL-backed EventMemory
- pgvector semantic retrieval
- embedding-based historical context
- retrieval evaluation and ranking benchmarks
- evidence-grounded LLM generation
- insufficient-evidence handling and fallback paths

> **In progress:** Production semantic retrieval and full RAG generation are still under development.

---

## 🧠 Machine Learning

PetalPal includes an independent **multi-label emotion classification** pipeline, separated from long-term AI memory so both systems can be evaluated independently.

### Current ML Work

- Python
- PyTorch
- ONNX
- Multi-label emotion classification
- Dataset evaluation
- Threshold evaluation
- Leakage-resistant evaluation
- Frozen test sets
- Human review
- Model adjudication
- Inference optimization

```text
User Input
    ↓
Emotion Classification
    ↓
Structured Emotion Signal
    ↓
Product Experience
```

---

## 🔐 Security & Reliability

Security and reliability are treated as core product infrastructure.

- Firebase-authenticated API access
- Server-side authorization
- Owner-scoped private resources
- Input validation
- Rate limiting
- Transactions
- Idempotency
- Background-job recovery
- Retry and fallback controls
- AI-output validation
- Docker-based local development
- Render deployment
- Automated backend testing

---

## ⭐ Engineering Highlights

- Built a cross-platform product with **React, React Native, and Expo**
- Built interactive Garden and Treehouse experiences with **React Native Skia**
- Integrated **Spine** for animated Fairy character experiences
- Built real-time social interactions using **Socket.IO**
- Designed a **Node.js + Express + PostgreSQL + Prisma** backend
- Implemented **Firebase-authenticated private-resource ownership**
- Added transaction-safe, idempotent, and failure-aware workflows
- Built durable PostgreSQL-backed AI processing
- Designed a privacy-separated **Journal / Event** architecture
- Built **EventMemory**, evidence provenance, and owner-scoped retrieval foundations
- Developed **PostgreSQL + pgvector** semantic-retrieval foundations for RAG
- Developed a **PyTorch multi-label emotion classification** pipeline
- Explored **ONNX** for efficient inference
- Containerized backend services with **Docker**
- Deployed backend infrastructure with **Render**

---

## 🚧 Project Status

| Status | Area |
| --- | --- |
| ✅ Implemented | React Native + Expo mobile foundation |
| ✅ Implemented | React Native Skia Garden rendering and camera interactions |
| ✅ Implemented | Spine-powered Fairy animation integration |
| ✅ Implemented | Friends, privacy controls, and Garden visit flows |
| ✅ Implemented | Node.js + Express backend |
| ✅ Implemented | PostgreSQL + Prisma data layer |
| ✅ Implemented | Firebase authentication and authorization |
| ✅ Implemented | Real-time social interactions with Socket.IO |
| ✅ Implemented | Durable background AI processing |
| ✅ Implemented | Private EventMemory foundation |
| ✅ Implemented | Multi-label emotion classification pipeline |
| 🔨 In Progress | Expanded Garden and Treehouse interactions |
| 🔨 In Progress | Embedding model evaluation |
| 🔨 In Progress | PostgreSQL + pgvector semantic retrieval and full RAG generation |
| 🔨 In Progress | Grounded Weekly / Monthly reflections |
| 🔨 In Progress | Interactive Yearly Journey |
| 🔨 In Progress | Continued ML evaluation and data-quality improvement |
| 🔨 In Progress | Beta testing and product iteration |

---

## 🗺️ Roadmap

```text
Current Product
    ↓
Long-Term AI Foundation
    ↓
Embedding Evaluation
    ↓
Owner-Scoped Semantic Retrieval
    ↓
Grounded Weekly / Monthly Reflection
    ↓
Interactive Yearly Journey
```

---

## 📚 Technical Documentation

- [`LONG_TERM_AI.md`](./LONG_TERM_AI.md) — long-term AI, memory, reports, and retrieval architecture
- [`SECURITY.md`](./SECURITY.md) — security architecture and backend hardening
- [`experiments/emotion-classifier-v2/ML_PROGRESS.md`](./experiments/emotion-classifier-v2/ML_PROGRESS.md) — machine-learning experiments and evaluation

---

## Getting Started

### Clone

```bash
git clone https://github.com/starstarrr/PetalPal_v2.git
cd PetalPal_v2
```

### Install

Backend:

```bash
npm install
```

Frontend:

```bash
cd client
npm install
cd ..
```

### Database

```bash
npx prisma generate
npx prisma migrate deploy
```

### Run

Backend:

```bash
npm start
```

Frontend:

```bash
cd client
npm run dev
```

AI worker:

```bash
npm run start:ai-worker
```

---

## 👥 Team

PetalPal is developed by **JX Technologies Inc.**

### 👩🏻‍💻 Jinyin Cao
*Co-Founder · Product / Frontend Lead*

Jinyin leads PetalPal's product and frontend direction, with a focus on user experience, visual design, interactive environments, and product growth.

#### 🎯 Product Strategy & UX

- Lead product vision, roadmap, user journeys, and mobile experience direction
- Co-design Journal, Events, Garden, Fairy, social, and reflection experiences
- Lead usability testing, product iteration, and visual experience refinement
- Shape engagement, progression, interaction, and retention systems with the team

#### 💻 Frontend Engineering

- Lead mobile frontend development with React Native, Expo, and reusable components
- Build responsive interfaces and interactive product flows across core mobile experiences
- Develop dynamic Garden and environmental experiences using React Native Skia
- Integrate Firebase Authentication, REST APIs, Socket.IO, and application state

#### 🎨 Visual & Interactive Experience

- Create custom visual assets and scenes using Adobe Photoshop
- Design flowers, gardens, Fairy environments, icons, and interface elements
- Build progression-driven and state-driven visual experiences across the product
- Develop Spine-powered Fairy animations and production-ready visual interactions

#### 🔗 Product Integration

- Coordinate frontend implementation across Garden, Events, Journal, social, and account experiences
- Collaborate on frontend-backend integration, feature behavior, and cross-stack product decisions
- Validate interactive experiences across mobile layouts, devices, and responsive states
- Refine feature flows through product testing, iteration, and user feedback

#### 🚀 Product Growth & Delivery

- Plan beta testing, user-feedback programs, and product validation
- Coordinate product iteration, feature delivery, and release readiness
- Prepare branding, product presentation, launch materials, and visual communication
- Support continued product development, adoption, and early-stage growth

---

### 👩🏻‍💻 Xingran Ma
*Co-Founder · Technical / AI Lead*

Xingran leads PetalPal's backend architecture, AI and retrieval systems, machine learning, security, reliability, and production infrastructure, while also contributing to product and frontend integration.

#### ⚙️ Backend Engineering

- Design Node.js and Express REST APIs with PostgreSQL and Prisma data models
- Build Firebase-authenticated server authorization and owner-scoped private-resource access
- Implement transactional, idempotent, and failure-aware workflows for multi-step operations
- Develop backend infrastructure for Events, Journal, Garden, social, and AI features

#### 🤖 AI, RAG & Long-Term Memory

- Design privacy-first long-term AI architecture separating Journal from Event-based processing
- Build EventMemory, evidence provenance, and owner-scoped RAG retrieval foundations
- Develop PostgreSQL and pgvector semantic retrieval with embedding-based historical context
- Build grounded reflection workflows with retrieval evaluation, validation, retry, and fallback

#### 🧠 Machine Learning

- Develop multi-label emotion classifiers using Python, PyTorch, and ONNX
- Build model, threshold, dataset, and benchmark evaluation workflows
- Design leakage-resistant evaluation, frozen test sets, human review, and adjudication
- Integrate production inference with validation, fallback, versioning, and evaluation boundaries

#### 🔐 Security, Reliability & Production Engineering

- Enforce authentication, authorization, owner isolation, and private-resource boundaries
- Implement rate limiting, validation, transactions, migrations, idempotency, and recovery
- Harden AI jobs against duplicate execution, partial failures, retries, and invalid outputs
- Maintain automated testing, Docker development environments, Render deployment, and reliability controls

#### 🔗 Product & Frontend Integration

- Contribute to product strategy, UX, and interaction design across core experiences
- Implement React Native and Expo flows for navigation, privacy, visits, and Treehouse
- Contribute to Skia camera interactions and Spine-powered Fairy integration
- Validate end-to-end flows across frontend, APIs, PostgreSQL, social, and AI/LLM processing

---

## 🌸 JX Technologies Inc.

**JX Technologies Inc.** builds AI-native consumer products that combine interactive design, software engineering, and personalized intelligent experiences.

PetalPal is designed to help people preserve meaningful moments, understand patterns over time, and watch their experiences grow into a living digital world.

---

<div align="center">

If you find PetalPal interesting, feel free to ⭐ the repository.

</div>
