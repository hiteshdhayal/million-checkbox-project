/* ─── Popcount lookup table ─────────────────────────────────────────────── */
const POPCOUNT = new Uint8Array(256);
for (let i = 1; i < 256; i++) {
  POPCOUNT[i] = POPCOUNT[i >> 1] + (i & 1);
}

/**
 * Decode a base64 string into a Uint8Array.
 * Works in both browser and Node-style environments.
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/** Return the number of set bits in a single byte (0-255). */
export function popcount(byte) {
  return POPCOUNT[byte & 0xff];
}

/** Sum set bits across the entire Uint8Array without looping over every bit. */
export function countAllChecked(uint8array) {
  let n = 0;
  for (let i = 0; i < uint8array.length; i++) {
    n += POPCOUNT[uint8array[i]];
  }
  return n;
}
