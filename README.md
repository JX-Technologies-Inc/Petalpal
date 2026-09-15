# 🌸 PetalPal

> **A Social Mood Garden Where Moments Bloom into Memories**

PetalPal is a privacy-first social reflection app that turns everyday emotions and meaningful moments into a living virtual garden.

Instead of treating journaling as a static text experience, PetalPal connects reflection with flowers, dynamic environments, Fairy interactions, social gardens, and long-term personal patterns.

Users can record their day, grow mood-inspired flowers, explore evolving scenes, interact with friends, and gradually build a visual history of their experiences.

---

## 🌱 Product

PetalPal combines **reflection, virtual-world interaction, social connection, and AI** in one experience.

### 🌸 Mood-to-Garden Experience

Daily check-ins become part of the user's virtual garden.

Mood and activity can influence:

- Flower generation
- Garden progression
- Visual states
- Fairy interactions
- Reflection history

The goal is to make personal reflection feel more visual and rewarding than a traditional journal.

### 🎨 Dynamic Environments

PetalPal includes dynamic garden and Fairy scenes rather than a static interface.

Custom visual assets are created in **Adobe Photoshop** and integrated with frontend state and interaction logic to support:

- Changing garden scenes
- Flower growth
- Fairy states and movement
- Progression-based visual changes
- Activity-driven environments
- Interactive social spaces

### 👥 Social Garden

Users can connect with friends without turning private reflection into public content.

Social features include:

- Friend search and requests
- Garden visits
- Flower support
- Supportive messages
- Visitor history
- Real-time interactions

### 🧠 Long-Term Reflection

PetalPal distinguishes between private **Journal** entries and explicit **Events** used for long-term reflection.

```text
Journal
→ Private reflection only

Event
→ EventMemory
→ Weekly Reflection
→ Monthly Patterns
→ Yearly Journey
```

This lets PetalPal build long-term experiences without treating every private journal entry as AI data.

---

## ✨ Core Features

- 🌼 Daily mood check-ins
- 🌸 Mood-based flower generation
- 🪴 Personalized virtual gardens
- 🎨 Dynamic visual environments
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

# ⚡ Technology

PetalPal combines cross-platform frontend development, backend systems, real-time infrastructure, machine learning, and AI application engineering.

| Area | Technologies |
|---|---|
| **Web Frontend** | React, Vite, JavaScript |
| **Mobile Frontend** | React Native, Expo |
| **Visual Design** | Adobe Photoshop, Custom Visual Assets, Dynamic Scene Design |
| **Backend** | Node.js, Express, REST APIs |
| **Database** | PostgreSQL, Prisma ORM |
| **Authentication** | Firebase Authentication, Firebase Admin |
| **Real-Time** | Socket.IO |
| **AI Integration** | Cloudflare Workers AI |
| **Long-Term AI** | EventMemory, Evidence Provenance, Background AI Jobs |
| **Machine Learning** | Python, PyTorch, ONNX |
| **Retrieval Foundation** | PostgreSQL, pgvector |
| **Infrastructure** | Render, Docker |
| **Reliability** | Transactions, Idempotency, Rate Limiting, Background Workers |
| **Version Control** | Git, GitHub |

---

## 🏗️ System Architecture

```text
          React / React Native + Expo
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
 Garden / Social   Journal      Event / AI
       │                             │
       │                             ▼
       │                     Background AI Jobs
       │                             │
       │                             ▼
       │                         EventMemory
       │                             │
       │                             ▼
       │                   Long-Term Reflection
       │
       └─────────────┬───────────────┘
                     │
              PostgreSQL + Prisma
```

The backend acts as the trusted security boundary.

Authentication and private-resource ownership are verified server-side rather than trusting user identifiers sent by the client.

---

# 🎨 Frontend & Interactive Experience

PetalPal's frontend is designed around interactive scenes rather than traditional form-based screens.

The product uses:

- **React** for the web experience
- **React Native + Expo** for cross-platform mobile development
- **Adobe Photoshop** for custom visual assets
- State-driven rendering for changing environments
- Animation and interaction logic for garden and Fairy experiences
- Socket.IO for real-time social updates

Visual design and frontend engineering work together so product progression can be reflected directly in the user's environment.

```text
User Activity
     ↓
Application State
     ↓
Garden / Flower / Fairy Changes
     ↓
Updated Interactive Scene
```

---

# ⚙️ Backend Engineering

PetalPal's backend is built with **Node.js, Express, PostgreSQL, and Prisma**.

The backend supports:

- Authentication and authorization
- Daily check-ins
- Journal storage
- Events
- Flower generation
- Garden state
- Fairy runtime
- Friend relationships
- Real-time social interactions
- AI processing
- Long-term memory infrastructure

Reliability features include:

- Transactional database operations
- Idempotent workflows
- API rate limiting
- Input validation
- Centralized error handling
- Background processing
- Failure recovery
- Owner-scoped private resources

This allows user-facing flows to remain reliable even when external AI services or background processing fail.

---

# 🧠 AI Architecture

PetalPal uses AI as a supporting product layer rather than giving an LLM unrestricted access to user data.

## Privacy Boundary

### Journal

```text
Journal
   ↓
Private Storage

No Long-Term AI
No Embeddings
No RAG
No AI Reports
```

### Event

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

Long-term AI processing is restricted to explicit user-authored Events.

AI memory and future retrieval remain private and owner-scoped.

---

## Long-Term AI Foundation

The current architecture includes:

- Private EventMemory
- Event evidence provenance
- Durable background AI jobs
- Weekly and Monthly reflection foundations
- Yearly reflection architecture
- Trend-analysis infrastructure
- Owner isolation
- Retrieval evaluation interfaces

PetalPal follows a simple principle:

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

Semantic retrieval and full production RAG are future phases rather than features currently claimed as complete.

---

# 🤖 Machine Learning

PetalPal also includes an independent **multi-label emotion classification** pipeline.

The ML system is developed separately from long-term AI memory so each can be evaluated and improved independently.

Technologies and work include:

- Python
- PyTorch
- ONNX
- Multi-label classification
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

# 🔐 Security & Reliability

Privacy is enforced through backend and database boundaries.

PetalPal includes:

- Firebase ID-token verification
- Server-side authorization
- Owner-scoped private data
- Database-level tenant isolation
- Rate limiting
- Input validation
- Transactional writes
- Idempotency controls
- Background job recovery
- Protected AI-data lifecycle

Future semantic retrieval is designed to filter by the authenticated owner before similarity search.

---

# ⭐ Engineering Highlights

- Built a cross-platform product with **React, React Native, and Expo**
- Integrated **Photoshop-designed assets** into dynamic garden and Fairy environments
- Built real-time social interactions with **Socket.IO**
- Designed a **Node.js + Express + PostgreSQL + Prisma** backend
- Implemented **Firebase-authenticated private-resource ownership**
- Added transaction-safe and idempotent backend workflows
- Built durable PostgreSQL-backed AI processing
- Designed a privacy-separated **Journal / Event** architecture
- Built **EventMemory** and evidence-based long-term AI foundations
- Developed a **PyTorch multi-label emotion classification** pipeline
- Explored **ONNX** for efficient model inference
- Containerized backend services with **Docker**
- Deployed backend infrastructure using **Render**

---

# 🔮 Roadmap

```text
Product Foundation
        ↓
Long-Term AI Foundation
        ↓
Embedding Evaluation
        ↓
PostgreSQL + pgvector Retrieval
        ↓
Owner-Scoped Semantic Search
        ↓
Grounded Weekly / Monthly Reflection
        ↓
Interactive Yearly Journey
```

Future development focuses on:

- Semantic Event retrieval
- Grounded long-term AI reflection
- Expanded dynamic environments
- Mobile experience refinement
- Social and Fairy interactions
- Beta testing and product iteration

---

# 👥 Team

PetalPal is developed by **JX Technologies Inc.**

## 👩🏻‍💻 Jinyin Cao
### Co-Founder & Product / Frontend Lead

Jinyin leads PetalPal's product strategy, frontend experience, visual design, and product growth.

### 🎯 Product Strategy & UX

- Define product vision, roadmap, and user journeys
- Design Daily Grow, Journal, Event, garden, Fairy, and social experiences
- Conduct usability testing and product iteration
- Design engagement and retention systems

### 💻 Frontend Engineering

- Build PetalPal with React, React Native, and Expo
- Develop reusable web and mobile components
- Build dynamic garden and Fairy scenes
- Integrate Firebase Authentication, REST APIs, and Socket.IO

### 🎨 Visual & Dynamic Experience

- Create custom assets and scenes using Adobe Photoshop
- Design flowers, gardens, Fairy environments, and interface elements
- Build progression-driven visual experiences
- Translate product concepts into production-ready interfaces

### 🚀 Product Growth & Delivery

- Plan beta testing and user-feedback programs
- Coordinate frontend and backend feature integration
- Prepare branding and launch materials
- Support product iteration and early-stage growth

---

## 👩🏻‍💻 Xingran Ma
### Co-Founder & Technical / AI Lead

Xingran leads PetalPal's backend architecture, AI systems, machine learning, security, and production infrastructure.

### ⚙️ Backend Engineering

- Design Express REST APIs and PostgreSQL schemas
- Build authentication and server-side authorization
- Implement transactional and idempotent workflows
- Develop backend infrastructure for Events, gardens, social features, and AI

### 🤖 AI Application Engineering

- Design PetalPal's privacy-first long-term AI architecture
- Build EventMemory and evidence provenance
- Develop durable background AI processing
- Design Weekly, Monthly, and Yearly reflection foundations

### 🧠 Machine Learning

- Develop multi-label emotion classification systems
- Build model and dataset evaluation workflows
- Design human-review and model-adjudication processes
- Research PyTorch and ONNX inference

### 🔐 Security & Reliability

- Enforce private-resource and tenant isolation
- Implement validation, rate limiting, transactions, and recovery paths
- Build reliable background AI workflows
- Maintain backend security and production reliability

---

# 🚀 Getting Started

```bash
git clone https://github.com/JX-Technologies-Inc/Petalpal.git
cd Petalpal

npm install

cd client
npm install
cd ..

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

# 📚 Technical Documentation

Detailed engineering documentation is maintained separately:

```text
experiments/emotion-classifier-v2/ML_PROGRESS.md
→ Machine Learning

SECURITY.md
→ Security

LONG_TERM_AI.md
→ Long-Term AI Architecture
```

---

# 🌸 JX Technologies Inc.

**JX Technologies Inc.** builds AI-native consumer products that combine interactive product design, software engineering, and personalized intelligent experiences.

PetalPal is designed to turn meaningful moments into a living digital world users can grow, revisit, and share.

---

If you find PetalPal interesting, feel free to ⭐ the repository.