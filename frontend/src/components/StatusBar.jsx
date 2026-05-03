import React, { useEffect, useState } from 'react';
import './StatusBar.css';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function StatusBar({ checkedCount, total, activity }) {
  const [, tick] = useState(0);

  // Re-render every second so time-ago labels update
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="statusbar">
      <div className="statusbar-main">
        <span className="statusbar-label">目を覚ませ&nbsp;/&nbsp;WAKE THEM</span>
        <span className="statusbar-count">
          {checkedCount.toLocaleString()}/{total.toLocaleString()}
        </span>
      </div>
      <hr className="statusbar-hr" />

      {activity.length > 0 && (
        <div className="activity-feed">
          {activity.map((a, i) => (
            <span key={`${a.index}-${a.ts}`} className="activity-entry">
              #{String(a.index).padStart(7, '0')}&nbsp;·&nbsp;
              <span className={a.value ? 'act-on' : 'act-off'}>
                {a.value ? 'WOKE' : 'SLEPT'}
              </span>
              &nbsp;·&nbsp;{timeAgo(a.ts)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
