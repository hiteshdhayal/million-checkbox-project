import React from 'react';
import './Footer.css';

export default function Footer({ onReset, userCount }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <span className="footer-hint">TAP A HEAD TO WAKE IT</span>
        <div className="footer-right">
          {userCount > 0 && (
            <span className="footer-users">{userCount} online</span>
          )}
          <button className="reset-btn" onClick={onReset} title="Reset all checkboxes">
            reset 全部
          </button>
        </div>
      </div>
      <p className="footer-credit">
        作 MADE WITH ♥ — V1 LOCAL · REALTIME SYNC COMING NEXT
      </p>
    </footer>
  );
}
