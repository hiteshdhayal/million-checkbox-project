# Million Checkboxes

A real-time, collaborative web application supporting up to 1,000,000 live checkboxes, synchronized across all connected users via WebSockets and Redis.

## 1. Project Overview
Million Checkboxes is a fast, highly-concurrent application where users can log in and toggle any of a million checkboxes. Every toggle is broadcast to all other connected users instantly. It uses a virtualized DOM for optimal frontend performance and Redis Bitfields for extremely efficient state storage.

## 2. Tech Stack
- **Frontend**: HTML, CSS, Vanilla JavaScript (no frameworks). Uses DOM virtualization to render the grid efficiently.
- **Backend**: Node.js, Express, `ws` package for WebSockets.
- **Storage/State**: Redis (via `ioredis`).
- **Auth**: Manual OIDC (OpenID Connect) implementation with Google as the identity provider.

## 3. Features Implemented
- Virtualized checkbox grid handling 1 million items natively without frame drops.
- Highly optimized Redis storage using `BITFIELD` (consuming only ~125 KB of memory for 1M checkboxes).
- Redis Pub/Sub architecture using dedicated `commandClient` and `pubsubClient`.
- Custom Redis-native Rate Limiter handling WebSocket events, HTTP requests, and Auth.
- Full Manual OIDC Authorization Code Flow implementation without any Auth libraries (e.g., no Passport.js, no openid-client).
- Real-time live synchronization of checkbox state and user connections count.

## 4. How to Run Locally

1. **Clone the repository** (if applicable) or navigate to the project directory.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Ensure Redis is running** (see Redis setup below).
4. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required values (especially `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).
   ```bash
   cp .env.example .env
   ```
5. **Start the application**:
   ```bash
   npm start
   ```
   The application will be running on `http://localhost:3000`.

## 5. Redis Setup Instructions
To run this project, you need a running instance of Redis.
- **Mac (Homebrew)**: `brew install redis` -> `brew services start redis`
- **Linux (Apt)**: `sudo apt install redis-server` -> `sudo systemctl start redis`
- **Docker**: `docker run -p 6379:6379 -d redis`
- **Windows**: Use WSL or Docker, or install Memurai/Redis-Windows natively.

By default, the application will attempt to connect to `redis://localhost:6379`.

## 6. Google OAuth App Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project (or select an existing one).
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Choose **Web application**.
6. Set **Authorized redirect URIs** to `http://localhost:3000/auth/callback`.
7. Copy the generated **Client ID** and **Client Secret**.

## 7. Environment Variables
- `PORT`: Port the Express/WS server runs on (default: `3000`).
- `REDIS_URL`: Connection URL for your Redis instance (default: `redis://localhost:6379`).
- `GOOGLE_CLIENT_ID`: Client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: Client Secret from Google Cloud Console.
- `GOOGLE_CALLBACK_URL`: Redirect URI (must exactly match Google Console, e.g., `http://localhost:3000/auth/callback`).
- `SESSION_SECRET`: A long random string used to sign session cookies for security.
- `COOKIE_NAME`: The name of the session cookie (default: `checkbox_session`).
- `TOTAL_CHECKBOXES`: Number of checkboxes in the grid (default: `1000000`).

## 8. Auth Flow Explanation
This app implements the OpenID Connect (OIDC) authorization code flow manually:
1. `GET /auth/login` fetches Google's `.well-known/openid-configuration` to discover endpoints. It generates a random `state` token, stores it in Redis with a 5-minute TTL, and redirects the user to Google's Authorization endpoint.
2. The user authenticates with Google and grants permission.
3. Google redirects back to `GET /auth/callback` with `code` and `state`.
4. The server verifies `state` exists in Redis (to prevent CSRF) and removes it. It exchanges the `code` for an `id_token` (JWT) at Google's Token endpoint.
5. The server decodes the `id_token` JWT payload directly to extract the user's `sub` (ID), `name`, `email`, and `picture`.
6. The server generates a unique `sessionId`, stores the user profile in Redis under `session:{sessionId}` (24hr TTL), and sets a signed HTTP-only cookie.
7. Subsequent requests and WebSocket upgrades parse and verify the cookie to identify the user.

## 9. WebSocket Flow Explanation
1. **Connection**: Client connects via `ws://`. The server extracts the session from the cookie.
2. **Initial State**: The server reads the full `checkboxes` BITFIELD from Redis using `GETRANGE` and sends it to the client as base64. The client populates its `Uint8Array`.
3. **Toggle**: User clicks a box. The client optimistically updates its array and sends `{ type: "toggle", index, value }`.
4. **Server Processing**: Server checks auth and rate limits. If valid, it writes the bit using `BITFIELD checkboxes SET`.
5. **Pub/Sub Broadcast**: Server publishes the update to the `checkbox:updates` channel.
6. **Delivery**: The subscribed Redis client receives the message and pushes `{ type: "update", index, value, userId }` to all connected WebSocket clients to update their UI.

## 10. Rate Limiting Logic
Implemented using the Canonical Redis Native Pattern (`INCR` + `EXPIRE`).
- `checkRateLimit(identifier, limit, windowMs)` hashes the current time into a window: `rl:{identifier}:{Math.floor(Date.now() / windowMs)}`.
- The key is incremented (`INCR`). If it's `1`, an `EXPIRE` is set to automatically clean it up after the window passes.
- **WebSocket Toggles**: Limit 10 requests per 10 seconds per User ID. Rejects with `{ error: "rate_limited" }`.
- **HTTP API (`/api/*`)**: Limit 60 requests per 60 seconds per IP. Rejects with HTTP 429.
- **Auth Routes**: Limit 5 requests per 300 seconds (5 mins) per IP. Rejects with HTTP 429.

## 11. Redis Architecture Explanation
- **BITFIELD Storage**: Storing 1 million string keys would consume hundreds of megabytes of RAM overhead. A single `BITFIELD` key treats the value as a contiguous array of bits. 1,000,000 bits = ~125 KB. We can read/write individual bits atomically using offsets, which is highly efficient and eliminates race conditions.
- **Pub/Sub with Two Clients**: Redis requires a client connection that invokes `SUBSCRIBE` to remain in "subscriber mode," meaning it cannot execute standard commands like `BITFIELD` or `SET`. Therefore, `ioredis` is instantiated twice: `commandClient` for normal commands and publishing, and `pubsubClient` exclusively for subscribing to updates.

## 12. Refresh/Reload Behavior
When a user refreshes the page:
1. The initial HTML/JS is served.
2. The JS client fires `GET /api/state`, retrieving the most recent raw binary array directly from Redis.
3. The WebSocket connection is established, and any missed toggles occurring during the split-second gap are sent via `update` events or a secondary `state` event upon connection. The user always sees the correct and current global state.

## 13. Concurrent Toggles on the Same Checkbox
If User A and User B toggle the identical checkbox at the exact same millisecond:
- The WebSocket server processes them sequentially as they arrive at the event loop.
- The `BITFIELD checkboxes SET u1 {index} {value}` operation is **atomic** at the Redis level.
- Last-write-wins: Redis executes one command, then the other. Both publish updates to the channel. All clients will eventually receive both updates in the same order they were processed by Redis, resolving to the identical final state. There is no state corruption.

---

### Demo Video Checklist
- [ ] Show 1M checkboxes rendering fast and correctly.
- [ ] Log in via Google OIDC.
- [ ] Toggle checkboxes and see them update across multiple browser windows.
- [ ] Demonstrate rate-limiting by clicking very fast.
- [ ] Show state persists across page reload.
