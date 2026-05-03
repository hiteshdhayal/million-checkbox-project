import React, { memo } from 'react';
import './Cell.css';

const FACES = [
  '😺','👺','🥷','😼','😸','😈','😾','😻','🤖','😹',
  '👻','🐼','🧟','😽','🦊','👹','😺','👺','🥷','😼',
];

const Cell = memo(function Cell({ index, isChecked, onClick, isLoggedIn }) {
  const face = FACES[index % FACES.length];

  const handleClick = () => {
    onClick(index);
  };

  return (
    <div
      className={`cell ${isChecked ? 'cell--awake' : 'cell--asleep'}`}
      onClick={handleClick}
      title={`#${index} — ${isChecked ? 'Awake' : 'Asleep'}`}
      role="checkbox"
      aria-checked={isChecked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
    >
      <span className="cell-face">{face}</span>
      <span className="cell-index">#{String(index).padStart(6, '0')}</span>
    </div>
  );
});

export default Cell;
