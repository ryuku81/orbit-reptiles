export const SEQUENCE = Object.freeze({ count: 12, width: 627, height: 627 });
export function sequencePosition(progress) {
 const value=Number.isFinite(progress)?progress:0;
 const t=Math.max(0,Math.min(1,(value-.025)/.875));
 return Math.pow(t,1.15)*(SEQUENCE.count-1);
}
