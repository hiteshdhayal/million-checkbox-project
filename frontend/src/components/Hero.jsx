import React from 'react';
import './Hero.css';

export default function Hero({ user, wsStatus, latency }) {
  return (
    <section className="hero">
      {/* Rising sun backdrop */}
      <div className="hero-sun-wrap" aria-hidden="true">
        <div className="hero-rays"></div>
        <div className="hero-sun"></div>
      </div>

      {/* Auth pill — top right */}
      <div className="hero-auth">
        {user ? (
          <div className="auth-user">
            <div className="avatar-circle">
              {user.picture
                ? <img src={user.picture} alt={user.name} />
                : (user.name || user.email || '?')[0].toUpperCase()}
            </div>
            <span className="auth-name">{user.name || user.email}</span>
            <a href="/auth/logout" className="auth-logout">ログアウト</a>
          </div>
        ) : (
          <a href="/auth/login" className="auth-login-btn">
            ログイン&nbsp;LOGIN
          </a>
        )}
      </div>

      {/* Content */}
      <div className="hero-content">
        <div className="hero-pill">
          <span className="hero-pill-dot">●</span>
          百 / ONE HUNDRED
        </div>

        <h1 className="hero-title">百チェック</h1>
        <p className="hero-sub">One Hundred Heads</p>
        <p className="hero-desc">
          A real-time collaborative grid. Wake every head.<br />
          Changes sync to all connected visitors instantly.
        </p>

        {/* Status row */}
        <div className="hero-status-row">
          <span className={`ws-badge ws-badge--${wsStatus}`}>
            <span className="ws-dot"></span>
            {wsStatus === 'connected' ? 'LIVE' : wsStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          </span>
          {latency !== null && (
            <span className="latency-badge">PING&nbsp;{latency}ms</span>
          )}
        </div>
      </div>

      {/* Bottom fade to background */}
      <div className="hero-fade" aria-hidden="true"></div>
    </section>
  );
}
