


# 🚀 Million Checkboxes (Real-time Collaborative Grid)

A real-time web application where users can interact with a massive grid of checkboxes (1,000,000 cells) simultaneously. Built using WebSockets, Redis, and a custom OIDC authentication flow.

live link -  https://million-checkbox-project.vercel.app
video link - https://x.com/hiteshdhayall/status/2051019272554688962?s=20

---

## 🌐 Overview

This project is inspired by the "1 Million Checkboxes" concept, but built from scratch with:

* Real-time synchronization across users
* Efficient Redis BITFIELD storage
* Custom WebSocket architecture
* Manual OIDC authentication (Google)
* Virtualized frontend rendering for performance

---

## 🧰 Tech Stack

### Backend

* Node.js
* Express
* WebSockets (`ws`)
* Redis (`ioredis`)
* OIDC (Google OAuth 2.0)

### Frontend

* React (Vite)
* Vanilla CSS (custom theme)
* WebSocket API

---

## ⚡ Features

* 🔄 Real-time checkbox updates across all users
* 🧠 Efficient storage using Redis BITFIELD (~125KB for 1M checkboxes)
* 👥 Live user count
* 🔐 Google login (OIDC)
* 🚫 Rate limiting (custom Redis-based)
* ⚡ Virtualized grid (renders only visible checkboxes)
* 📡 Pub/Sub architecture using Redis
* 🎯 Optimistic UI updates

---

## 📦 Project Structure

```
backend/
  src/
    server.js
    socketHandler.js
    auth.js
    redis.js
    checkboxState.js
    rateLimiter.js
  .env

frontend/
  src/
    components/
    hooks/
    utils/
    App.jsx
  vite.config.js
```

---

## 🛠️ Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd million-checkbox
```

---

### 2. Start Redis (Docker recommended)

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

---

### 3. Backend Setup

```bash
cd backend
npm install
```

#### Create `.env` file:

```env
PORT=3000
REDIS_URL=redis://localhost:6379

GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback

SESSION_SECRET=some_long_random_string
COOKIE_NAME=checkbox_session

TOTAL_CHECKBOXES=1000000
```

#### Start backend:

```bash
node src/server.js
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

---

## 🔐 Authentication Flow (OIDC)

1. User clicks login → `/auth/login`
2. Redirected to Google OAuth
3. Google returns `code` → `/auth/callback`
4. Server exchanges code for:

   * `access_token`
   * `id_token` (JWT)
5. JWT decoded → user info extracted
6. Session stored in Redis
7. Cookie set (`checkbox_session`)

---

## 🔌 WebSocket Flow

1. Client connects → receives full checkbox state
2. User toggles checkbox → sends:

```json
{ "type": "toggle", "index": 123 }
```

3. Server:

   * Validates auth
   * Applies rate limit
   * Updates Redis (BITFIELD)
   * Publishes event

4. All clients receive:

```json
{ "type": "update", "index": 123, "value": 1 }
```

---

## 🧠 Redis Architecture

| Key                  | Purpose                     |
| -------------------- | --------------------------- |
| `checkboxes`         | BITFIELD storing all states |
| `session:{id}`       | User session                |
| `oidc:state:{state}` | CSRF protection             |
| `rl:*`               | Rate limiting counters      |

---

## 🚦 Rate Limiting

Implemented manually using Redis:

```js
INCR rl:{identifier}:{window}
EXPIRE key window
```

### Limits:

* WebSocket: 10 toggles / 10s per user
* API: 60 requests / minute per IP
* Auth: 5 requests / 5 min

---

## 🔄 Handling Concurrency

* Redis `BITFIELD SET` is atomic
* Last-write-wins
* No race condition or corruption

---

## 🔁 Refresh Behavior

* On reload → `/api/state` fetches full state
* UI syncs instantly

---

## 🎨 UI

* Japanese retro / cyberpunk theme
* Real-time stats
* Activity ticker
* Toast notifications
* Responsive grid

---

## 🧪 Testing Checklist

* [ ] Login works
* [ ] Multiple tabs sync in real-time
* [ ] Rate limiting triggers
* [ ] Anonymous users cannot toggle
* [ ] Grid loads without lag
* [ ] Redis persists state

---

## 🚀 Future Improvements

* Horizontal scaling with multiple backend instances
* Redis cluster support
* WebRTC for peer sync
* Mobile optimization
* Dark/light themes

---

## 📄 License

MIT License

---

## 💡 Author

Built by Hitesh Dhayal
For learning distributed systems, real-time apps, and scalable architecture.


