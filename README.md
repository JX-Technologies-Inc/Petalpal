# 🌸 PetalPal

> *A Social Mood Garden Where Moments Bloom into Memories*

PetalPal is a privacy-first social reflection app that turns everyday emotions and meaningful moments into a living virtual garden.

Instead of treating journaling as a static text experience, PetalPal connects reflection with mood-inspired flowers, dynamic environments, Fairy interactions, social gardens, and long-term personal patterns.

Users can record their day, grow their garden, interact with friends, and gradually build a visual history of their experiences.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/starstarrr/PetalPal_v2.git
cd PetalPal_v2
```

### 2. Install dependencies

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

### 3. Prepare the database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Start the services

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

## 📚 Technical Documentation

- [`LONG_TERM_AI.md`](./LONG_TERM_AI.md) — long-term AI, memory, reports, and retrieval architecture
- [`SECURITY.md`](./SECURITY.md) — security architecture and backend hardening
- [`experiments/emotion-classifier-v2/ML_PROGRESS.md`](./experiments/emotion-classifier-v2/ML_PROGRESS.md) — machine-learning experiments and evaluation

---

## 🌱 Product

PetalPal combines **personal reflection, interactive virtual environments, social connection, and AI** in one experience.

### 🌸 Mood-to-Garden

Daily check-ins gradually shape the user's virtual world.

Mood and activity can influence:

- Flower generation
- Garden progression
- Visual states
- Fairy interactions
- Reflection history

Rather than storing emotions only as text, PetalPal turns them into something users can see and interact with.

### 🎨 Dynamic Environments

PetalPal uses dynamic Garden and Fairy scenes instead of a static journaling interface.

Custom visual assets are designed with Adobe Photoshop and integrated through **React Native + Expo**, **React Native Skia**, and **Spine** to support:

- Changing garden environments
- Skia-rendered interactive Garden scenes
- Flower growth and progression
- Spine-powered Fairy animation and character states
- Progression-driven visual changes
- Activity-driven scenes
- Interactive social spaces

### 👥 Social Garden

Users can connect with friends while keeping private reflection separate from social content.

Social features include:

- Friend search and requests
- Garden visits
- Flower support
- Supportive messages
- Visitor history
- Real-time interactions

### 🧠 Long-Term Reflection

PetalPal separates private **Journal** entries from explicit **Events** used for long-term reflection.

```text
Journal
  ↓
Private reflection only

Event
  ↓
EventMemory
  ↓
Weekly Reflection
  ↓
Monthly Patterns
  ↓
Yearly Journey
```

This allows PetalPal to build personalized long-term experiences without treating every private journal entry as AI data.

---

## ✨ Core Features

- 🌼 Daily mood check-ins
- 🌸 Mood-based flower generation
- 🪴 Personalized virtual gardens
- 🎨 Dynamic garden environments
- 🧚 Interactive Fairy progression
- 📖 Private Journal
- ✨ Meaningful Events
- 🗓️ Reflection and activity history
- 👥 Friend connections
- 💌 Messages and flower support
- 🦋 Real-time garden visits
- 🤖 AI-assisted reflection
- 🧠 Long-term memory foundation

---

## ⚡ Technology Stack

| Area | Technologies |
| --- | --- |
| Web Frontend | React, Vite, JavaScript |
| Mobile Frontend | React Native, Expo, React Native Skia |
| Character Animation | Spine |
| Visual Design | Adobe Photoshop, Custom Visual Assets, Dynamic Scene Design |
| Backend | Node.js, Express, REST APIs |
| Database | PostgreSQL, Prisma ORM |
| Authentication | Firebase Authentication, Firebase Admin |
| Real-Time | Socket.IO |
| AI Integration | Cloudflare Workers AI |
| Long-Term AI | EventMemory, Evidence Provenance, Background AI Jobs |
| Machine Learning | Python, PyTorch, ONNX |
| Retrieval Foundation | PostgreSQL, pgvector |
| Infrastructure | Render, Docker |
| Reliability | Transactions, Idempotency, Rate Limiting, Background Workers |
| Version Control | Git, GitHub |

---

## 🏗️ System Architecture

```text
React / React Native + Expo
            │
Skia Scenes + Spine Fairy Animation
            │
   Firebase Authentication
            │
            ▼
      Express Backend
    REST APIs + Socket.IO
            │
   ┌────────┼────────┐
   │        │        │
   ▼        ▼        ▼
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

The backend acts as PetalPal's trusted security boundary. Authentication and private-resource ownership are verified server-side rather than trusting user IDs supplied by the client.

---

## 🎨 Frontend & Interactive Experience

PetalPal's frontend is built around interactive environments rather than traditional form-based screens.

- **React** for the web experience
- **React Native + Expo** for mobile development and application structure
- **React Native Skia** for interactive Garden scenes, camera transforms, zoom/pan behavior, and state-driven rendering
- **Spine** for Fairy skeletal animation and character states
- **Adobe Photoshop** for custom visual assets
- Responsive navigation and mobile-first interaction design
- Real-time social updates with Socket.IO

```text
User Activity
    ↓
Application State
    ↓
Garden / Flower / Fairy Changes
    ↓
Skia Scene + Spine Character Updates
    ↓
Updated Interactive Experience
```

---

## ⚙️ Backend Engineering

PetalPal's backend is built with **Node.js, Express, PostgreSQL, and Prisma**.

**Core capabilities**

- Authentication and authorization
- Daily check-ins
- Journal storage
- Events and flower generation
- Garden state and Fairy runtime
- Friend relationships and real-time social interactions
- AI processing and long-term memory infrastructure

**Reliability**

- Transactional database operations
- Idempotent workflows
- API rate limiting
- Input validation
- Centralized error handling
- Background processing
- Failure recovery
- Owner-scoped private resources

These controls keep core product flows reliable even when external AI services or background processing fail.

---

## 🧠 AI & Machine Learning

PetalPal uses AI as a supporting product layer rather than giving an LLM unrestricted access to private user content.

### Privacy Boundary

**Journal**

- Private storage
- No long-term AI
- No embeddings
- No RAG
- No AI reports

**Event**

```text
Event
  ↓
Private EventMemory
  ↓
Weekly Reflection
  ↓
Monthly Patterns
  ↓
Yearly Journey
```

Long-term AI processing is restricted to explicit user-authored Events. AI memory and future retrieval remain private and owner-scoped.

### Long-Term AI Foundation

The current architecture includes:

- Private EventMemory
- Evidence provenance
- Durable background AI processing
- Weekly and Monthly reflection foundations
- Yearly reflection architecture
- Trend-analysis infrastructure
- Owner isolation
- Retrieval evaluation interfaces

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

Production semantic retrieval and full RAG generation are still under development.

### Machine Learning

PetalPal includes an independent **multi-label emotion classification** pipeline.

Current work includes:

- Python
- PyTorch
- ONNX
- Multi-label emotion classification
- Dataset evaluation
- Leakage-resistant evaluation
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

## ⭐ Engineering Highlights

- Built a cross-platform product with React, React Native, and Expo
- Built interactive Garden and environment experiences with React Native Skia
- Integrated Spine for animated Fairy character experiences
- Integrated Photoshop-designed assets into Garden, Treehouse, Flower, and Fairy environments
- Built real-time social interactions using Socket.IO
- Designed a Node.js + Express + PostgreSQL + Prisma backend
- Implemented Firebase-authenticated private-resource ownership
- Added transaction-safe and idempotent backend workflows
- Built durable PostgreSQL-backed AI processing
- Designed a privacy-separated Journal / Event architecture
- Built EventMemory and evidence-based long-term AI foundations
- Developed a PyTorch multi-label emotion classification pipeline
- Explored ONNX for efficient model inference
- Containerized backend services using Docker
- Deployed backend infrastructure using Render

---

## 🚧 Project Status

### ✅ Implemented

- React web frontend
- React Native + Expo mobile foundation
- React Native Skia interactive Garden rendering and camera interactions
- Spine-powered Fairy animation integration
- Dynamic Garden, Flower, Treehouse, and Fairy experiences
- Custom Photoshop-designed visual assets
- Responsive mobile/desktop navigation
- Friends, privacy controls, and Garden visit flows
- Node.js + Express backend
- PostgreSQL + Prisma data layer
- Firebase authentication and authorization
- Real-time social interactions with Socket.IO
- Garden, Flower, Journal, Event, and Fairy systems
- Durable background AI processing
- Private EventMemory foundation
- Multi-label emotion classification pipeline
- Dockerized backend deployment on Render

### 🔨 In Progress

- Continued React Native + Expo mobile development
- Expanded Skia-based Garden and Treehouse interactions
- Continued Spine Fairy interaction and animation work
- Embedding model evaluation
- PostgreSQL + pgvector semantic retrieval
- Grounded Weekly and Monthly AI reflections
- Interactive Yearly Journey
- Continued ML evaluation and data-quality improvement
- Beta testing and product iteration

---

## 🔮 Roadmap

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

Future development focuses on improving the mobile experience, expanding dynamic environments, and building evidence-grounded long-term AI reflection.

---

## 👥 Team

PetalPal is developed by **JX Technologies Inc.**

### 👩🏻‍💻 Jinyin Cao
*Co-Founder · Product / Frontend Lead*

Jinyin leads PetalPal's product and frontend direction, with a focus on user experience, visual design, interactive environments, and product growth.

**Product Strategy & UX**

- Lead product vision, roadmap, user journeys, and mobile experience direction
- Co-design Journal, Events, Garden, Fairy, social, and reflection experiences
- Lead usability testing, product iteration, and visual experience refinement
- Shape engagement, progression, interaction, and retention systems with the team

**Frontend Engineering**

- Lead mobile frontend development with React Native, Expo, and reusable components
- Build responsive interfaces and interactive product flows across core mobile experiences
- Develop dynamic Garden and environmental experiences using React Native Skia
- Integrate Firebase Authentication, REST APIs, Socket.IO, and application state

**Visual & Interactive Experience**

- Create custom visual assets and scenes using Adobe Photoshop
- Design flowers, gardens, Fairy environments, icons, and interface elements
- Build progression-driven and state-driven visual experiences across the product
- Develop Spine-powered Fairy animations and production-ready visual interactions

**Product Integration**

- Coordinate frontend implementation across Garden, Events, Journal, social, and account experiences
- Collaborate on frontend-backend integration, feature behavior, and cross-stack product decisions
- Validate interactive experiences across mobile layouts, devices, and responsive states
- Refine feature flows through product testing, iteration, and user feedback

**Product Growth & Delivery**

- Plan beta testing, user-feedback programs, and product validation
- Coordinate product iteration, feature delivery, and release readiness
- Prepare branding, product presentation, launch materials, and visual communication
- Support continued product development, adoption, and early-stage growth

---

### 👩🏻‍💻 Xingran Ma
*Co-Founder · Technical / AI Lead*

Xingran leads PetalPal's backend architecture, AI and retrieval systems, machine learning, security, reliability, and production infrastructure, while also contributing to product and frontend integration.

**Backend Engineering**

- Design Node.js and Express REST APIs with PostgreSQL and Prisma data models
- Build Firebase-authenticated server authorization and owner-scoped private-resource access
- Implement transactional, idempotent, and failure-aware workflows for multi-step operations
- Develop backend infrastructure for Events, Journal, Garden, social, and AI features

**AI, RAG & Long-Term Memory**

- Design privacy-first long-term AI architecture separating Journal from Event-based processing
- Build EventMemory, evidence provenance, and owner-scoped RAG retrieval foundations
- Develop PostgreSQL and pgvector semantic retrieval with embedding-based historical context
- Build grounded reflection workflows with retrieval evaluation, validation, retry, and fallback

**Machine Learning**

- Develop multi-label emotion classifiers using Python, PyTorch, and ONNX
- Build model, threshold, dataset, and benchmark evaluation workflows
- Design leakage-resistant evaluation, frozen test sets, human review, and adjudication
- Integrate production inference with validation, fallback, versioning, and evaluation boundaries

**Security, Reliability & Production Engineering**

- Enforce authentication, authorization, owner isolation, and private-resource boundaries
- Implement rate limiting, validation, transactions, migrations, idempotency, and recovery
- Harden AI jobs against duplicate execution, partial failures, retries, and invalid outputs
- Maintain automated testing, Docker development environments, Render deployment, and reliability controls

**Product & Frontend Integration**

- Contribute to product strategy, UX, and interaction design across core experiences
- Implement React Native and Expo flows for navigation, privacy, visits, and Treehouse
- Contribute to Skia camera interactions and Spine-powered Fairy integration
- Validate end-to-end flows across frontend, APIs, PostgreSQL, social, and AI/LLM processing

---

## 🌸 JX Technologies Inc.

**JX Technologies Inc.** builds AI-native consumer products that combine interactive design, software engineering, and personalized intelligent experiences.

PetalPal is designed to help people preserve meaningful moments, understand patterns over time, and watch their experiences grow into a living digital world.

If you find PetalPal interesting, feel free to ⭐ the repository.
