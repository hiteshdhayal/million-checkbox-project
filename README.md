🚀 Million Checkboxes (Real-time Collaborative Grid)

A real-time web application where users can interact with a massive grid of checkboxes (1,000,000 cells) simultaneously. Built using WebSockets, Redis, and a custom OIDC authentication flow.

🌐 Overview

This project is inspired by the "1 Million Checkboxes" concept, but built from scratch with:

Real-time synchronization across users
Efficient Redis BITFIELD storage
Custom WebSocket architecture
Manual OIDC authentication (Google)
Virtualized frontend rendering for performance
🧰 Tech Stack
Backend
Node.js
Express
WebSockets (ws)
Redis (ioredis)
OIDC (Google OAuth 2.0)
Frontend
React (Vite)
Vanilla CSS (custom theme)
WebSocket API
⚡ Features
🔄 Real-time checkbox updates across all users
🧠 Efficient storage using Redis BITFIELD (~125KB for 1M checkboxes)
👥 Live user count
🔐 Google login (OIDC)
🚫 Rate limiting (custom Redis-based)
⚡ Virtualized grid (renders only visible checkboxes)
📡 Pub/Sub architecture using Redis
🎯 Optimistic UI updates
📦 Project Structure
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
🛠️ Local Setup
1. Clone the repository
git clone <your-repo-url>
cd million-checkbox
2. Start Redis (Docker recommended)
docker run -d -p 6379:6379 --name redis redis:alpine
3. Backend Setup
cd backend
npm install
Create .env file:
PORT=3000
REDIS_URL=redis://localhost:6379

GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback

SESSION_SECRET=some_long_random_string
COOKIE_NAME=checkbox_session

TOTAL_CHECKBOXES=1000000
Start backend:
node src/server.js
4. Frontend Setup
cd frontend
npm install
npm run dev

Open:

http://localhost:5173
🔐 Authentication Flow (OIDC)
User clicks login → /auth/login
Redirected to Google OAuth
Google returns code → /auth/callback
Server exchanges code for:
access_token
id_token (JWT)
JWT decoded → user info extracted
Session stored in Redis
Cookie set (checkbox_session)
🔌 WebSocket Flow
Client connects → receives full checkbox state
User toggles checkbox → sends:
{ "type": "toggle", "index": 123 }
Server:
Validates auth
Applies rate limit
Updates Redis (BITFIELD)
Publishes event
All clients receive:
{ "type": "update", "index": 123, "value": 1 }
🧠 Redis Architecture
Key	Purpose
checkboxes	BITFIELD storing all states
session:{id}	User session
oidc:state:{state}	CSRF protection
rl:*	Rate limiting counters
🚦 Rate Limiting

Implemented manually using Redis:

INCR rl:{identifier}:{window}
EXPIRE key window
Limits:
WebSocket: 10 toggles / 10s per user
API: 60 requests / minute per IP
Auth: 5 requests / 5 min
🔄 Handling Concurrency
Redis BITFIELD SET is atomic
Last-write-wins
No race condition or corruption
🔁 Refresh Behavior
On reload → /api/state fetches full state
UI syncs instantly
🎨 UI
Japanese retro / cyberpunk theme
Real-time stats
Activity ticker
Toast notifications
Responsive grid
🧪 Testing Checklist
 Login works
 Multiple tabs sync in real-time
 Rate limiting triggers
 Anonymous users cannot toggle
 Grid loads without lag
 Redis persists state
🚀 Future Improvements
Horizontal scaling with multiple backend instances
Redis cluster support
WebRTC for peer sync
Mobile optimization
Dark/light themes
📄 License

MIT License

💡 Author

Built by Hitesh Dhayal
For learning distributed systems, real-time apps, and scalable architecture.
