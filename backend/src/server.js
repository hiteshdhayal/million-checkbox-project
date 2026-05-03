const express = require('express');
const cors = require("cors");
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { authRoutes, sessionMiddleware } = require('./auth');
const { httpRateLimiter, authRateLimiter } = require('./rateLimiter');
const { getFullStateBuffer } = require('./checkboxState');
const { initSocketServer } = require('./socketHandler');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(sessionMiddleware);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', httpRateLimiter);

app.get('/api/state', async (req, res) => {
  try {
    const buffer = await getFullStateBuffer();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    console.error('Failed to fetch state:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.user);
});

app.use('/auth', authRateLimiter, authRoutes);

initSocketServer(wss);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
