# 🌸 PetalPal
> **A Social Mood Garden Where Moments Bloom into Memories**
PetalPal is a privacy-first social reflection app that turns everyday emotions and meaningful moments into a living virtual garden.
Instead of treating journaling as a static text experience, PetalPal connects reflection with mood-inspired flowers, dynamic environments, Fairy interactions, social gardens, and long-term personal patterns.
Users can record their day, grow their garden, interact with friends, and gradually build a visual history of their experiences.
---
# 🚀 Getting Started
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
# 📚 Technical Documentation
Detailed engineering documentation is maintained separately:
- [`LONG_TERM_AI.md`](./LONG_TERM_AI.md) — Long-term AI, memory, reports, and retrieval architecture
- [`SECURITY.md`](./SECURITY.md) — Security architecture and backend hardening
- [`experiments/emotion-classifier-v2/ML_PROGRESS.md`](./experiments/emotion-classifier-v2/ML_PROGRESS.md) — Machine learning experiments and evaluation
---
# 🌱 Product
PetalPal combines **personal reflection, interactive virtual environments, social connection, and AI** in one experience.
## 🌸 Mood-to-Garden
Daily check-ins gradually shape the user's virtual world.
Mood and activity can influence:
- Flower generation
- Garden progression
- Visual states
- Fairy interactions
- Reflection history
Rather than storing emotions only as text, PetalPal turns them into something users can see and interact with.
## 🎨 Dynamic Environments
PetalPal includes dynamic garden and Fairy scenes instead of a static journaling interface.
Custom visual assets are designed with **Adobe Photoshop** and integrated into the mobile experience through **React Native + Expo**, **React Native Skia**, and **Spine** to support:
- Changing garden environments
- Skia-rendered interactive Garden scenes
- Flower growth and progression
- Spine-powered Fairy animation and character states
- Progression-based visual changes
- Activity-driven scenes
- Interactive social spaces
---
## 👥 Social Garden
Users can connect with friends while keeping private reflection separate from social content.
Social features include:
- Friend search and requests
- Garden visits
- Flower support
- Supportive messages
- Visitor history
- Real-time interactions
## 🧠 Long-Term Reflection
PetalPal separates private **Journal** entries from explicit **Events** used for long-term reflection.
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
# ✨ Core Features
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
# ⚡ Core Technologies
| Area | Technologies |
|---|---|
| **Web Frontend** | React, Vite, JavaScript |
| **Mobile Frontend** | React Native, Expo, React Native Skia |
| **Character Animation** | Spine |
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
# 🏗️ System Architecture
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

  ┌─────────────┼─────────────┐

  │             │             │

  ▼             ▼             ▼
Garden / Social   Journal      Event / AI
  │                            │

  │                            ▼

  │                    Background AI Jobs

  │                            │

  │                            ▼

  │                        EventMemory

  │                            │

  │                            ▼

  │                  Long-Term Reflection

  │

  └────────────┬───────────────┘

               │

        PostgreSQL + Prisma
```
The backend acts as PetalPal's trusted security boundary.
Authentication and private-resource ownership are verified server-side rather than trusting user IDs supplied by the client.
---
# 🎨 Frontend & Interactive Experience
PetalPal's frontend is built around interactive environments rather than traditional form-based screens.
The product combines:
- **React** for the web experience
- **React Native + Expo** for mobile development and application structure
- **React Native Skia** for high-performance interactive Garden scenes, camera transforms, zoom/pan behavior, and state-driven visual rendering
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
Visual design and frontend engineering work together so user activity, social state, and progression are reflected directly in the virtual environment.
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
These controls keep core product flows reliable even when external AI services or background processing fail.
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
## Long-Term AI Foundation
The current architecture includes:
- Private EventMemory
- Evidence provenance
- Durable background AI processing
- Weekly and Monthly reflection foundations
- Yearly reflection architecture
- Trend-analysis infrastructure
- Owner isolation
- Retrieval evaluation interfaces
PetalPal follows one core principle:
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
---
# 🤖 Machine Learning
PetalPal includes an independent **multi-label emotion classification** pipeline.
The emotion ML system is separated from long-term AI memory so both systems can be evaluated and improved independently.
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
- Built interactive Garden and environment experiences with **React Native Skia**
- Integrated **Spine** for animated Fairy character experiences
- Integrated **Photoshop-designed assets** into dynamic Garden, Treehouse, Flower, and Fairy environments
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
## 🔨 In Progress
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
Future development focuses on improving the mobile experience, expanding dynamic environments, and building evidence-grounded long-term AI reflection.
---
# 👥 Team
PetalPal is developed by **JX Technologies Inc.**
## 👩🏻‍💻 Jinyin Cao
### Co-Founder & Product / Frontend Lead
Jinyin leads PetalPal's product and frontend direction, with a focus on user experience, visual design, interactive environments, and product growth across the mobile experience.
### 🎯 Product Strategy & UX
- Lead product vision, roadmap, and user-experience direction
- Co-design Journal, Events, Garden, Fairy, social, and reflection experiences
- Lead usability testing, product iteration, and visual experience refinement
- Collaborate on engagement, progression, interaction, and retention systems
### 💻 Frontend Engineering
- Lead mobile frontend development with React Native and Expo
- Develop reusable mobile components, responsive interfaces, and interactive product flows
- Build dynamic Garden and environmental experiences using React Native Skia
- Integrate frontend flows with Firebase Authentication, REST APIs, Socket.IO, and application state
### 🎨 Visual & Interactive Experience
- Create custom visual assets and scenes using Adobe Photoshop
- Design flowers, gardens, Fairy environments, icons, and interface elements
- Build progression-driven and state-driven visual experiences
- Develop animated Fairy experiences using Spine and translate visual concepts into production-ready interfaces
### 🔗 Product Integration
- Coordinate frontend implementation across Garden, Events, Journal, social, account, and Fairy experiences
- Collaborate on frontend-backend feature integration and product behavior
- Validate interactive experiences across mobile layouts and device sizes
- Refine feature flows through product testing and iteration
### 🚀 Product Growth & Delivery
- Plan beta testing and user-feedback programs
- Coordinate product iteration and feature delivery
- Prepare branding, product presentation, and launch materials
- Support product growth and continued product development
---
## 👩🏻‍💻 Xingran Ma
### Co-Founder & Technical / AI Lead
Xingran leads PetalPal's backend architecture, AI systems, machine learning, security, and production infrastructure, while also contributing to product strategy, UX design, frontend development, and cross-stack integration.
### ⚙️ Backend Engineering
- Design Express REST APIs and PostgreSQL schemas
- Build Firebase authentication and server-side authorization
- Implement transactional, idempotent, and owner-scoped workflows
- Develop backend infrastructure for Events, Journal, gardens, social features, Fairy interactions, and AI
### 🎯 Product, UX & Frontend Integration
- Contribute to product strategy, user journeys, and interaction design across Garden, Events, Journal, Friends, Fairy, and social experiences
- Design and implement React Native + Expo interactions including responsive navigation, Garden visits, privacy controls, theme behavior, and interactive Treehouse experiences
- Contribute to Skia-based scene interactions, camera/zoom behavior, and frontend integration of Spine-powered Fairy experiences
- Build and validate end-to-end product flows spanning frontend interactions, authenticated APIs, PostgreSQL persistence, social functionality, and AI/LLM processing
### 🤖 AI Application Engineering
- Design PetalPal's privacy-first long-term AI architecture
- Build EventMemory, evidence provenance, and retrieval foundations
- Develop durable background AI processing, validation, fallback, and recovery workflows
- Design Weekly, Monthly, and Yearly reflection foundations
### 🧠 Machine Learning
- Develop multi-label emotion classification systems
- Build model, dataset, and evaluation workflows
- Design human-review and model-adjudication processes
- Research PyTorch, ONNX, inference, and model optimization workflows
### 🔐 Security & Reliability
- Enforce private-resource ownership and user isolation
- Implement validation, rate limiting, transactions, idempotency, and recovery paths
- Build reliable background AI and data-processing workflows
- Maintain backend security, automated testing, deployment, and production reliability
---
# 🌸 JX Technologies Inc.
**JX Technologies Inc.** builds AI-native consumer products that combine interactive design, software engineering, and personalized intelligent experiences.
PetalPal is designed to help people preserve meaningful moments, understand patterns over time, and watch their experiences grow into a living digital world.
---
If you find PetalPal interesting, feel free to ⭐ the repository.