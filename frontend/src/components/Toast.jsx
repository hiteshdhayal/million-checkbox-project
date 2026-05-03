import React from 'react';
import './Toast.css';

export default function Toast({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map(({ id, msg }) => (
        <div key={id} className="toast-item">
          {msg}
        </div>
      ))}
    </div>
  );
}
