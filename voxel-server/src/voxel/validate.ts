export const isFiniteNumber = (v: any) => typeof v === "number" && Number.isFinite(v);
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
