import { useEffect, useRef, useCallback } from 'react';

const BASE_DELAY = 1000;
const MAX_DELAY  = 30000;
const PING_MS    = 5000;

/**
 * useWebSocket — connects to ws://host, handles reconnect with exponential
 * backoff, and pings every 5 s to measure latency.
 *
 * @param {object} handlers
 *   onState(uint8array)           — full state from base64
 *   onUpdate(index, value, userId)— single bit flip
 *   onUserCount(count)            — connected users
 *   onError(reason)               — server-sent error
 *   onPong(latencyMs)             — round-trip ping result
 *   onStatusChange(status)        — 'connecting'|'connected'|'disconnected'
 */
export function useWebSocket({
  onState,
  onUpdate,
  onUserCount,
  onError,
  onPong,
  onStatusChange,
}) {
  const wsRef       = useRef(null);
  const retryDelay  = useRef(BASE_DELAY);
  const pingTimer   = useRef(null);
  const retryTimer  = useRef(null);
  const handlersRef = useRef({});

  // Keep handlers fresh without re-running effect
  handlersRef.current = { onState, onUpdate, onUserCount, onError, onPong, onStatusChange };

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = import.meta.env.VITE_WS_URL || `${proto}//${window.location.host}`;

    handlersRef.current.onStatusChange?.('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = BASE_DELAY;
      handlersRef.current.onStatusChange?.('connected');

      // Ping loop
      const doPing = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        }
      };
      doPing();
      pingTimer.current = setInterval(doPing, PING_MS);
    };

    ws.onclose = () => {
      clearInterval(pingTimer.current);
      handlersRef.current.onStatusChange?.('disconnected');
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, MAX_DELAY);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      const h = handlersRef.current;
      switch (msg.type) {
        case 'state': {
          const bin = atob(msg.data);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          h.onState?.(arr);
          break;
        }
        case 'update':
          h.onUpdate?.(msg.index, msg.value, msg.userId);
          break;
        case 'user_count':
          h.onUserCount?.(msg.count);
          break;
        case 'error':
          h.onError?.(msg.reason);
          break;
        case 'pong':
          h.onPong?.(Date.now() - msg.ts);
          break;
        default:
          break;
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingTimer.current);
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendToggle = useCallback((index) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'toggle', index }));
    }
  }, []);

  const sendReset = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  return { sendToggle, sendReset };
}
