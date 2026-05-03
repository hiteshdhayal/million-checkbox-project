import React, { useRef, useEffect, useState, useCallback } from 'react';
import Cell from './Cell.jsx';
import './Grid.css';

const CELL_SIZE = 80;  // px — matches minmax(80px, 1fr)
const CELL_GAP  = 8;
const BUFFER    = 3;

export default function Grid({ bitArray, getBit, onToggle, isLoggedIn, loading }) {
  const containerRef = useRef(null);
  const [cols,        setCols]        = useState(1);
  const [scrollTop,   setScrollTop]   = useState(0);
  const [viewHeight,  setViewHeight]  = useState(600);
  const [, forceRender] = useState(0);

  const TOTAL = 1_000_000;

  // Recalculate columns on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w    = el.clientWidth;
      const cols = Math.max(1, Math.floor((w + CELL_GAP) / (CELL_SIZE + CELL_GAP)));
      setCols(cols);
      setViewHeight(el.clientHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Force re-render when bitArray changes (it's a ref)
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const totalRows   = Math.ceil(TOTAL / cols);
  const rowH        = CELL_SIZE + CELL_GAP;
  const totalH      = totalRows * rowH;

  const firstRow    = Math.max(0, Math.floor(scrollTop / rowH) - BUFFER);
  const lastRow     = Math.min(totalRows - 1,
                        Math.ceil((scrollTop + viewHeight) / rowH) + BUFFER);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Render slice of rows
  const rows = [];
  for (let ri = firstRow; ri <= lastRow; ri++) {
    const startIdx = ri * cols;
    const cells    = [];
    for (let ci = 0; ci < cols; ci++) {
      const idx = startIdx + ci;
      if (idx >= TOTAL) break;
      cells.push(
        <Cell
          key={idx}
          index={idx}
          isChecked={getBit(idx) === 1}
          onClick={onToggle}
          isLoggedIn={isLoggedIn}
        />
      );
    }
    rows.push(
      <div
        key={ri}
        className="grid-row"
        style={{ top: ri * rowH, position: 'absolute', left: 0, right: 0, display: 'flex', gap: CELL_GAP }}
      >
        {cells}
      </div>
    );
  }

  return (
    <div className="grid-outer">
      <div
        className="grid-container"
        ref={containerRef}
        onScroll={onScroll}
      >
        {loading && (
          <div className="grid-loading">
            <div className="loading-bar"><div className="loading-fill"></div></div>
            <p>読み込み中… Loading heads</p>
          </div>
        )}
        {/* Virtual scroller */}
        <div className="grid-scroller" style={{ height: totalH, position: 'relative' }}>
          {rows}
        </div>
      </div>
    </div>
  );
}
