import { useState, useCallback, useRef } from 'react';
import { countAllChecked } from '../utils/bitfield.js';

const TOTAL = 1_000_000;
const BYTES = Math.ceil(TOTAL / 8);

/**
 * useCheckboxState — owns the Uint8Array and derived checkedCount.
 *
 * All bit operations are O(bytes), not O(bits).
 */
export function useCheckboxState() {
  // Store the array in a ref so we never trigger a re-render on every bit flip.
  // checkedCount is real state because UI needs to reflect it.
  const arrayRef    = useRef(new Uint8Array(BYTES));
  const [checkedCount, setCheckedCount] = useState(0);

  const getBit = useCallback((index) => {
    return (arrayRef.current[index >> 3] >> (7 - (index & 7))) & 1;
  }, []);

  const setBit = useCallback((index, value) => {
    const byteIdx = index >> 3;
    const shift   = 7 - (index & 7);
    if (value) {
      arrayRef.current[byteIdx] |=  (1 << shift);
    } else {
      arrayRef.current[byteIdx] &= ~(1 << shift);
    }
  }, []);

  /** Replace entire state with a new buffer (from /api/state or WS "state" msg). */
  const applyFullState = useCallback((uint8array) => {
    // Ensure the array is exactly BYTES long
    const next = new Uint8Array(BYTES);
    next.set(uint8array.subarray(0, BYTES));
    arrayRef.current = next;
    setCheckedCount(countAllChecked(next));
  }, []);

  /**
   * Apply a single toggle from a WS "update" event.
   * Returns the new value so callers can update activity feeds etc.
   */
  const applyUpdate = useCallback((index, value) => {
    if (index < 0 || index >= TOTAL) return;
    const old = getBit(index);
    if (old === value) return value; // no-op
    setBit(index, value);
    setCheckedCount(prev => value ? prev + 1 : prev - 1);
    return value;
  }, [getBit, setBit]);

  /** Optimistic local toggle — returns new value. */
  const localToggle = useCallback((index) => {
    const old = getBit(index);
    const next = old ? 0 : 1;
    setBit(index, next);
    setCheckedCount(prev => next ? prev + 1 : prev - 1);
    return next;
  }, [getBit, setBit]);

  /** Reset all bits to 0. */
  const resetAll = useCallback(() => {
    arrayRef.current = new Uint8Array(BYTES);
    setCheckedCount(0);
  }, []);

  return {
    bitArray:     arrayRef,   // ref — read .current for latest Uint8Array
    getBit,
    applyUpdate,
    applyFullState,
    localToggle,
    resetAll,
    checkedCount,
  };
}
