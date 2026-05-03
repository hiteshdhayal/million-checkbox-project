const { v4: uuidv4 } = require('uuid');
const { commandClient, pubsubClient } = require('./redis');
const { getSignedCookieFromHeader } = require('./auth');
const { setCheckbox, getFullStateBuffer } = require('./checkboxState');
const { wsRateLimiter } = require('./rateLimiter');

const connectedSockets = new Map();

function initSocketServer(wss) {
  pubsubClient.subscribe('checkbox:updates', (err) => {
    if (err) console.error('Failed to subscribe to updates', err);
  });

  pubsubClient.on('message', (channel, message) => {
    if (channel === 'checkbox:updates') {
      const updateData = JSON.parse(message);
      
      const payload = JSON.stringify({
        type: 'update',
        index: updateData.index,
        value: updateData.value,
        userId: updateData.userId
      });

      for (const [id, connection] of connectedSockets.entries()) {
          if (connection.socket.readyState === 1) {
              connection.socket.send(payload);
          }
      }
    }
  });

  wss.on('connection', async (socket, request) => {
    const socketId = uuidv4();
    const cookieHeader = request.headers.cookie;
    
    let user = null;
    if (cookieHeader) {
      const sessionId = getSignedCookieFromHeader(cookieHeader, process.env.COOKIE_NAME, process.env.SESSION_SECRET);
      if (sessionId) {
        const sessionData = await commandClient.get(`session:${sessionId}`);
        if (sessionData) {
          user = JSON.parse(sessionData);
        }
      }
    }

    socket.user = user;
    connectedSockets.set(socketId, { socket, user, connectedAt: Date.now() });

    const buffer = await getFullStateBuffer();
    socket.send(JSON.stringify({
      type: 'state',
      data: buffer.toString('base64')
    }));

    broadcastUserCount();

    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'ping') {
          // Immediately reflect the timestamp back so client can measure RTT
          return socket.send(JSON.stringify({ type: 'pong', ts: data.ts }));
        }

        if (data.type === 'toggle') {
          if (!socket.user) {
            return socket.send(JSON.stringify({ type: 'error', reason: 'unauthenticated' }));
          }

          const allowed = await wsRateLimiter(socket.user.sub);
          if (!allowed) {
            return socket.send(JSON.stringify({ type: 'error', reason: 'rate_limited' }));
          }

          const index = parseInt(data.index);
          const value = data.value ? 1 : 0;
          
          if (isNaN(index) || index < 0 || index >= parseInt(process.env.TOTAL_CHECKBOXES || '1000000')) {
              return;
          }

          await setCheckbox(index, value);

          await commandClient.publish('checkbox:updates', JSON.stringify({
            index,
            value,
            userId: socket.user.sub,
            socketId
          }));
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    socket.on('close', () => {
      connectedSockets.delete(socketId);
      broadcastUserCount();
    });
  });
}

function broadcastUserCount() {
  const count = connectedSockets.size;
  const payload = JSON.stringify({ type: 'user_count', count });
  for (const [id, connection] of connectedSockets.entries()) {
    if (connection.socket.readyState === 1) {
      connection.socket.send(payload);
    }
  }
}

module.exports = { initSocketServer };
