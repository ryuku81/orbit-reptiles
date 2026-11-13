export const SEQUENCE = Object.freeze({ count: 265, columns: 16, width: 166, height: 174 });
const clamp = n => Math.max(0, Math.min(1, n));
export function sequencePosition(progress) {
  const t = clamp(((Number.isFinite(progress) ? progress : 0) - .025) / .875);
  // A continuous velocity curve; motion is baked into optical-flow in-between frames.
  return Math.pow(t, 1.15) * (SEQUENCE.count - 1);
}
export function frameRect(index) {
  const i = Math.max(0, Math.min(SEQUENCE.count - 1, Math.round(index)));
  return [(i % SEQUENCE.columns) * SEQUENCE.width, Math.floor(i / SEQUENCE.columns) * SEQUENCE.height, SEQUENCE.width, SEQUENCE.height];
}
