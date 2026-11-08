export const xpFor = (level: number) => Math.round(95 * Math.pow(level, 2.0));
export const mobHp = (lvl: number) => Math.round(90 + Math.pow(lvl, 2.0) * 10);
export const mobDmg = (lvl: number) => (6 + lvl * lvl * 0.35 + lvl * 3) * 1.3;
export const mobXp = (lvl: number) => Math.round((10 + lvl * lvl * 0.9 + lvl * 10) * 0.55);
export const mobGold = (lvl: number) => Math.round(1 + lvl * 1.6);

// ---- детерминированный шум и random ----
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 144665) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}
const sm = (t: number) => t * t * (3 - 2 * t);
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = sm(x - xi), yf = sm(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x: number, y: number, oct = 4, seed = 0): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, y * f, seed + i * 17) * a;
    f *= 2;
    a *= 0.5;
  }
  return v;
}
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
