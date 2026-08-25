# 🌸 PetalPal

> **A Social Mood Garden Where Emotions Bloom into Flowers**

PetalPal is a full-stack social web application that transforms daily emotions into flowers in a personal virtual garden. Users can record their day, grow mood-based flowers, revisit memories through an interactive calendar, and connect with friends through real-time social interactions.

---

# ✨ Features

- 🌼 Daily mood check-in with AI mood analysis
- 🌸 Automatic mood-based flower generation
- 🗓️ Interactive flower calendar with date highlighting
- 👥 Friend search and friend request workflow
- 💌 Leave supportive messages on friends' flowers
- ❤️ Support friends' flowers
- 🦋 Real-time garden visits using Socket.IO
- 📜 Live visitor records and activity history
- 🔐 Secure authentication with hashed passwords
- ☁️ Persistent PostgreSQL database
- ⚛️ Modern React single-page application

---

# 🏗️ System Architecture

```text
                 React Frontend
               (Vite + React)
                      │
          REST API + Socket.IO
                      │
                      ▼
             Express.js Server
                      │
                 Prisma ORM
                      │
                      ▼
                 PostgreSQL
```

---

# ⚡ Real-Time Workflow

```text
User A
   │
Visits Friend's Garden
   │
Socket.IO
   │
Express Server
   │
Broadcast Events
   │
User B

↓

Live Avatar Movement

↓

Support / Message

↓

Visitor Records Updated

↓

Both Clients Stay Synchronized
```

---

# 🗄️ Database Design

```text
User
├── Garden
│   ├── Flower
│   │    └── Message
│   └── VisitRecord
├── Friendship
└── FriendRequest
```

---

# 🛠️ Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Real-Time | Socket.IO |
| Authentication | bcrypt |
| AI Mood Analysis | natural.js |
| Deployment | Render & Docker |
| Version Control | Git & GitHub |

---

# 📂 Project Structure

```text
PetalPal/
├── client/
│   ├── src/
│   │   ├── Auth/
│   │   ├── Friends/
│   │   ├── Garden/
│   │   ├── Profile/
│   │   ├── Visit/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── main.jsx
│   └── public/
│
├── prisma/
├── server.js
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
└── README.md
```

---

# 🚀 Getting Started

## Option 1 (Recommended): Run with Docker

Clone the repository:

```bash
git clone <repository-url>

cd PetalPal
```

Create a `.env` file in the project root:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=replace_with_a_random_secret_of_at_least_32_characters
```

Build and start the application:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Stop the application:

```bash
docker compose down
```

For future runs:

```bash
docker compose up
```

---

## Option 2: Run without Docker

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

Generate Prisma Client:

```bash
npx prisma generate
```

Apply versioned database migrations on a fresh database:

```bash
npx prisma migrate deploy
```

If the database was created by an older PetalPal version using
`prisma db push`, baseline the existing tables once before deployment:

```bash
npx prisma migrate resolve --applied 202608250000_baseline
npx prisma migrate deploy
```

Back up production data before the first migration. Do not run the baseline
command on an empty database; fresh databases should run `migrate deploy`
directly.

Start the backend:

```bash
npm start
```

In another terminal:

```bash
cd client

npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3000
```

---

# 🐳 Docker Architecture

PetalPal uses a multi-stage Docker build.

```text
Stage 1
React + Vite Build
        │
        ▼
client/dist
        │
        ▼
Stage 2
Express Production Server
        │
        ├── REST API
        ├── Socket.IO
        └── React Static Files
```

The Express server serves both the backend API and the compiled React frontend from the same container.

---

# 🌍 Deployment

PetalPal is deployed using:

- Render
- Docker
- PostgreSQL
- Prisma ORM

The production Express server serves the compiled React application (`client/dist`) together with the REST API and Socket.IO endpoints under the same origin.

---

# ⭐ Engineering Highlights

- Designed a normalized PostgreSQL schema using Prisma ORM.
- Built modular RESTful APIs with Express.
- Developed a React component-based frontend architecture.
- Implemented real-time synchronization using Socket.IO.
- Designed a live friend request workflow with instant updates.
- Optimized UI responsiveness with partial state updates.
- Built an interactive calendar for exploring mood history.
- Containerized the full-stack application using Docker with a multi-stage build.
- Configured Express to serve the production React application.
- Structured the application into reusable React components.

--- 

# 🔮 Future Improvements

- Jest unit testing
- Swagger API documentation
- Push notifications
- Online presence indicators
- Mobile responsive optimization

---
# 👥 JX Technologies Inc.
PetalPal is developed by **JX Technologies Inc.**, an AI-first startup building production-ready consumer applications that combine artificial intelligence, emotional wellness, and meaningful social experiences.

Designed for public release on iOS and Android, PetalPal empowers users to reflect, grow, and build lasting connections through AI-powered journaling, virtual gardening, and social interaction.

## 👩🏻‍💻 Jinyin Cao — Co-Founder & Product / Frontend Lead

Jinyin leads PetalPal's product strategy, mobile development, user experience, visual design, and product growth.

### 📱 Product Strategy & UX
- Define product vision, roadmap, user personas, and feature planning.
- Design complete user journeys including onboarding, journaling, virtual gardens, AI reflections, and social interactions.
- Conduct user research, usability testing, and iterative product improvements.
- Design engagement systems including rewards, reminders, challenges, and retention strategies.
- Create privacy-first product experiences.

### 💻 Mobile Frontend Engineering
- Build the cross-platform React Native application with Expo.
- Develop responsive interfaces for iOS and Android.
- Integrate backend APIs, authentication, AI services, and cloud resources.
- Implement state management, navigation, offline support, and local storage.
- Develop animations, interactive components, gesture controls, and real-time UI updates.
- Optimize frontend performance and user experience.

### 🎨 Product Design & Growth
- Design the visual identity, design system, and reusable UI components.
- Create wireframes, prototypes, and production-ready interfaces.
- Design social experiences including virtual gardens, activity feeds, and community engagement.
- Prepare App Store assets, branding materials, screenshots, and launch content.
- Lead beta testing, campus outreach, marketing, and user acquisition.

### ✅ Product Delivery
- Conduct frontend testing, accessibility validation, and device compatibility testing.
- Collaborate with the backend team to integrate AI features.
- Support App Store deployment and post-launch product iteration.
- Maintain product documentation, design specifications, and user research.

### 🎯 Main Deliverables
- Production-ready React Native App
- Cross-platform iOS & Android Frontend
- Product Roadmap & Feature Planning
- UX Design System & Prototypes
- Virtual Garden & Social Experience
- Frontend Integration with AI Services
- Beta Testing & Product Iteration
- App Store Launch Materials

## 👩🏻‍💻 Xingran Ma — Co-Founder & Technical / AI Lead

Xingran leads the overall technical architecture of PetalPal, focusing on AI systems, backend engineering, cloud infrastructure, security, and scalable production deployment.

### 🤖 AI Systems & LLM Engineering
- Design the end-to-end AI architecture powering personalized emotional support.
- Build Retrieval-Augmented Generation (RAG) pipelines using Claude, embeddings, and semantic search.
- Develop long-term AI memory for user preferences, emotional history, relationships, and contextual recall.
- Implement vector retrieval with PostgreSQL + pgvector / Cloudflare Vectorize.
- Design prompt engineering workflows, structured JSON outputs, and AI tool-calling.
- Build AI evaluation pipelines and safety mechanisms including moderation, validation, and fallback strategies.

### ⚙️ Backend Engineering
- Design the overall backend architecture and REST APIs.
- Develop PostgreSQL schemas for users, journals, flowers, friendships, AI memories, recommendations, and subscriptions.
- Implement authentication, authorization, JWT management, and role-based access control.
- Build flower growth logic, AI emotion analysis, recommendation systems, and social backend services.
- Ensure privacy and secure access to journals and personal AI memories.

### ☁️ Cloud Infrastructure
- Deploy backend services with Cloudflare Workers.
- Configure Cloudflare Queues, R2, KV, and distributed caching.
- Build scalable asynchronous AI processing pipelines.
- Monitor backend performance, database optimization, latency, token usage, and cloud costs.

### 🚀 Software Engineering
- Implement logging, validation, rate limiting, retries, testing, and monitoring.
- Support production deployment, App Store release, and future platform scalability.
- Maintain system architecture, API documentation, deployment guides, and technical documentation.

### 🎯 Main Deliverables
- Production-ready AI backend
- RAG + Long-term Memory System
- PostgreSQL & Vector Database
- Authentication & Secure APIs
- AI Emotion & Flower Generation Engine
- Cloudflare Infrastructure
- AI Evaluation Framework
- Backend Documentation

## 🌸 About JX Technologies Inc.

**JX Technologies** is dedicated to building AI-native consumer applications that combine intelligent technology with thoughtful product design.

Our mission is to create technology that helps people build healthier habits, stronger relationships, and better emotional well-being through personalized AI experiences.
---

If you found this project interesting, feel free to ⭐ the repository!
