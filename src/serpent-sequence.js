export const SEQUENCE = Object.freeze({ count: 112, columns: 16, width: 100, height: 128 });
export function sequencePosition(progress) {
  const p = Number.isFinite(progress) ? progress : 0;
  return Math.max(0, Math.min(1, (p - .025) / .875)) * (SEQUENCE.count - 1);
}
export function frameRect(index) {
  const i = Math.max(0, Math.min(SEQUENCE.count - 1, Math.floor(index)));
  return [(i % SEQUENCE.columns) * SEQUENCE.width, Math.floor(i / SEQUENCE.columns) * SEQUENCE.height, SEQUENCE.width, SEQUENCE.height];
}
