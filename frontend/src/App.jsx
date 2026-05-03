import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BACKEND_URL } from './config.js';
import Hero       from './components/Hero.jsx';
import StatusBar  from './components/StatusBar.jsx';
import Grid       from './components/Grid.jsx';
import Footer     from './components/Footer.jsx';
import Toast      from './components/Toast.jsx';
import { useCheckboxState } from './hooks/useCheckboxState.js';
import { useWebSocket }     from './hooks/useWebSocket.js';

const TOTAL = 1_000_000;

export default function App() {
  const {
    bitArray, getBit, applyUpdate, applyFullState, localToggle, resetAll, checkedCount,
  } = useCheckboxState();

  const [user,        setUser]        = useState(null);
  const [userCount,   setUserCount]   = useState(0);
  const [wsStatus,    setWsStatus]    = useState('connecting');
  const [latency,     setLatency]     = useState(null);
  const [toasts,      setToasts]      = useState([]);
  const [activity,    setActivity]    = useState([]); // [{index,value,ts}]
  const [loading,     setLoading]     = useState(true);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const toastId = useRef(0);
  const addToast = useCallback((msg) => {
    const id = ++toastId.current;
    setToasts(q => q.length >= 3 ? [...q.slice(1), { id, msg }] : [...q, { id, msg }]);
    setTimeout(() => setToasts(q => q.filter(t => t.id !== id)), 3300);
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const { sendToggle, sendReset } = useWebSocket({
    onState:       applyFullState,
    onUpdate:      (index, value) => {
      applyUpdate(index, value);
      setActivity(a => [{ index, value, ts: Date.now() }, ...a].slice(0, 5));
    },
    onUserCount:   setUserCount,
    onError:       (reason) => {
      const msgs = {
        rate_limited:    'レートが速すぎ · Slow down!',
        unauthenticated: 'ログインが必要です · Login required',
      };
      addToast(msgs[reason] || reason);
    },
    onPong:        setLatency,
    onStatusChange: setWsStatus,
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/me`)
      .then(r => r.ok ? r.json() : null)
      .then(u => setUser(u))
      .catch(() => setUser(null));
  }, []);

  // ── Fetch initial binary state ────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/state`)
      .then(r => r.arrayBuffer())
      .then(buf => {
        applyFullState(new Uint8Array(buf));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [applyFullState]);

  // ── Toggle handler ────────────────────────────────────────────────────────
  const handleToggle = useCallback((index) => {
    if (!user) {
      addToast('ログインが必要です · Login required to interact');
      return;
    }
    localToggle(index);
    sendToggle(index);
    setActivity(a => [{ index, value: getBit(index), ts: Date.now() }, ...a].slice(0, 5));
  }, [user, localToggle, sendToggle, getBit, addToast]);

  // ── Reset handler ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    resetAll();
    sendReset();
  }, [resetAll, sendReset]);

  return (
    <>
      <Hero user={user} wsStatus={wsStatus} latency={latency} />
      <StatusBar checkedCount={checkedCount} total={TOTAL} activity={activity} />
      <Grid
        bitArray={bitArray}
        getBit={getBit}
        onToggle={handleToggle}
        isLoggedIn={!!user}
        loading={loading}
      />
      <Footer onReset={handleReset} userCount={userCount} />
      <Toast toasts={toasts} />
    </>
  );
}
