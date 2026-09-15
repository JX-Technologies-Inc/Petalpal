# 🌸 PetalPal

> **A Social Mood Garden Where Moments Bloom into Memories**

PetalPal is a privacy-first social reflection app that turns everyday emotions and meaningful moments into a living virtual garden.

Instead of treating journaling as a static text experience, PetalPal connects reflection with flowers, dynamic environments, Fairy interactions, social gardens, and long-term personal patterns.

Users can record their day, grow mood-inspired flowers, explore evolving scenes, interact with friends, and gradually build a visual history of their experiences.

---

## 🌱 Product

PetalPal combines **reflection, virtual-world interaction, social connection, and AI** in one personalized experience.

### 🌸 Mood-to-Garden Experience

Daily check-ins gradually shape the user's virtual world.

Mood and activity can influence:

- Flower generation
- Garden progression
- Visual states
- Fairy interactions
- Reflection history

The goal is to make personal reflection feel more visual, interactive, and rewarding than a traditional journal.

### 🎨 Dynamic Environments

PetalPal uses dynamic garden and Fairy scenes rather than a static interface.

Custom assets are created with **Adobe Photoshop** and integrated with frontend state and interaction logic to support:

- Changing garden scenes
- Flower growth and progression
- Fairy states and movement
- Activity-driven environments
- Progression-based visual changes
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

PetalPal separates private **Journal** entries from explicit **Events** used for long-term AI reflection.

```text
Journal
→ Private reflection only

Event
→ EventMemory
→ Weekly Reflection
→ Monthly Patterns
→ Yearly Journey
```

This allows PetalPal to build personalized long-term experiences without treating every private journal entry as AI data.

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

# ⚡ Core Technologies

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

The backend acts as PetalPal's trusted security boundary.

Authentication and private-resource ownership are verified server-side rather than trusting user identifiers supplied by the client.

---

# 🎨 Frontend & Interactive Experience

PetalPal's frontend is built around interactive environments rather than traditional form-based screens.

The product combines:

- **React** for the web experience
- **React Native + Expo** for mobile development
- **Adobe Photoshop** for custom visual assets
- State-driven rendering for changing environments
- Dynamic Garden and Fairy scenes
- Real-time social interactions with Socket.IO

```text
User Activity
      ↓
Application State
      ↓
Garden / Flower / Fairy Changes
      ↓
Updated Interactive Scene
```

Visual design and frontend engineering work together so user activity and progression are reflected directly in the virtual environment.

---

# ⚙️ Backend Engineering

PetalPal's backend is built with **Node.js, Express, PostgreSQL, and Prisma**.

It supports:

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

This keeps core user flows reliable even when external AI services or background processing fail.

---

# 🧠 AI Architecture

PetalPal uses AI as a supporting product layer rather than giving an LLM unrestricted access to private user content.

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
- Durable background AI processing
- Weekly and Monthly reflection foundations
- Yearly reflection architecture
- Trend-analysis infrastructure
- Owner isolation
- Retrieval evaluation interfaces

PetalPal follows one key principle:

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

Production semantic retrieval and full RAG generation are future phases rather than features currently claimed as complete.

---

# 🤖 Machine Learning

PetalPal also includes an independent **multi-label emotion classification** pipeline.

The ML system is developed separately from long-term AI memory so both systems can be evaluated and improved independently.

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

# ⭐ Engineering Highlights

- Built a cross-platform product with **React, React Native, and Expo**
- Integrated **Photoshop-designed assets** into dynamic garden and Fairy environments
- Built real-time social interactions using **Socket.IO**
- Designed a **Node.js + Express + PostgreSQL + Prisma** backend
- Implemented **Firebase-authenticated private-resource ownership**
- Added transaction-safe and idempotent backend workflows
- Built durable PostgreSQL-backed AI processing
- Designed a privacy-separated **Journal / Event** architecture
- Built **EventMemory** and evidence-based long-term AI foundations
- Developed a **PyTorch multi-label emotion classification** pipeline
- Explored **ONNX** for efficient model inference
- Containerized backend services using **Docker**
- Deployed backend infrastructure using **Render**

---

# 🚧 Project Status

## ✅ Implemented

- React web frontend
- React Native + Expo mobile foundation
- Dynamic garden and Fairy experiences
- Custom Photoshop-designed visual assets
- Node.js + Express backend
- PostgreSQL + Prisma data layer
- Firebase authentication and authorization
- Real-time social interactions with Socket.IO
- Garden, flower, Journal, Event, and Fairy systems
- Durable background AI processing
- Private EventMemory foundation
- Multi-label emotion classification pipeline
- Dockerized backend deployment on Render

## 🔨 In Progress

- Continued React Native / Expo mobile development
- Expanded dynamic garden and Fairy scenes
- Embedding model evaluation
- PostgreSQL + pgvector semantic retrieval
- Grounded Weekly and Monthly AI reflections
- Interactive Yearly Journey
- Continued ML evaluation and data-quality improvement
- Beta testing and product iteration

---

# 🔮 Roadmap

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

Upcoming development focuses on improving the mobile experience, expanding dynamic environments, and building evidence-grounded long-term AI reflection.

---

# 👥 Team

PetalPal is developed by **JX Technologies Inc.**

---

## 👩🏻‍💻 Jinyin Cao
### Co-Founder & Product / Frontend Lead

Jinyin leads PetalPal's product strategy, frontend experience, visual design, and product growth.

### 🎯 Product Strategy & UX

- Define product vision, roadmap, and user journeys
- Design Daily Grow, Journal, Event, Garden, Fairy, and social experiences
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
- Translate visual concepts into production-ready interfaces

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
- Build Firebase authentication and server-side authorization
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

Clone the repository:

```bash
git clone https://github.com/JX-Technologies-Inc/Petalpal.git
cd Petalpal
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

# 📚 Technical Documentation

More detailed technical work is maintained separately:

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

**JX Technologies Inc.** builds AI-native consumer products that combine interactive design, software engineering, and personalized intelligent experiences.

PetalPal is designed to help people preserve meaningful moments, understand patterns over time, and watch their experiences grow into a living digital world.

---

If you find PetalPal interesting, feel free to ⭐ the repository.