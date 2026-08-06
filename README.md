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

Sync the database:

```bash
npx prisma db push
```

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

# 👭 Author

**Jinyin Cao, Xingran Ma**

Computer Science Student, University of British Columbia

---

If you found this project interesting, feel free to ⭐ the repository!