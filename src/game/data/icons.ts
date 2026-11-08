/**
 * Процедурные SVG-иконки навыков и классов (вместо смайликов).
 * Результат — data:URL, поэтому работает и на сервере, и в браузере, и как <img src>.
 */
type Glyph = () => string;

const ST = `stroke="#2a1608" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"`;
const F = (d: string, extra = "") => `<path d="${d}" fill="url(#gl)" ${ST} ${extra}/>`;
const L = (d: string, w = 5) => `<path d="${d}" fill="none" stroke="#2a1608" stroke-width="${w + 2.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="url(#gl)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rot = (inner: string, a: number, cx = 32, cy = 32) => `<g transform="rotate(${a} ${cx} ${cy})">${inner}</g>`;

const sword = () => rot(F("M32 3 L37 10 L36 38 L28 38 L27 10 Z") + `<path d="M32 6 V36" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>` + F("M20 38 H44 V43 H20Z") + F("M29.5 43 H34.5 V54 H29.5Z") + `<circle cx="32" cy="57" r="3.4" fill="url(#gl)" ${ST}/>`, 40);
const dagger = () => rot(F("M32 8 L35.5 14 L35 34 L29 34 L28.5 14 Z") + F("M23 34 H41 V38 H23Z") + F("M30 38 H34 V48 H30Z"), -32, 32, 32) + rot(F("M32 8 L35.5 14 L35 34 L29 34 L28.5 14 Z") + F("M23 34 H41 V38 H23Z") + F("M30 38 H34 V48 H30Z"), 32, 32, 32);
const axe = () => rot(`<path d="M32 8 V58" stroke="#2a1608" stroke-width="7.5" stroke-linecap="round"/><path d="M32 8 V58" stroke="#c9a06a" stroke-width="4.5" stroke-linecap="round"/>` + F("M33 10 C50 6 60 20 55 34 C49 27 41 26 33 30 Z"), 25);
const hammer = () => rot(`<path d="M32 22 V58" stroke="#2a1608" stroke-width="7.5" stroke-linecap="round"/><path d="M32 22 V58" stroke="#c9a06a" stroke-width="4.5" stroke-linecap="round"/>` + F("M13 8 H51 Q55 8 55 12 V26 Q55 30 51 30 H13 Q9 30 9 26 V12 Q9 8 13 8Z"), 28);
const shield = () => F("M32 5 L55 12 V30 C55 45 45 55 32 60 C19 55 9 45 9 30 V12 Z") + `<path d="M32 13 L47 18 V30 C47 40 40 47 32 51 C24 47 17 40 17 30 V18 Z" fill="#2a1608" fill-opacity=".45"/>` + `<path d="M32 17 V48 M20 28 H44" stroke="url(#gl)" stroke-width="4.5" stroke-linecap="round"/>`;
const heart = () => F("M32 55 C8 38 6 21 17 15 C24 11 30 15 32 21 C34 15 40 11 47 15 C58 21 56 38 32 55Z") + `<path d="M17 22 C18 18 22 17 25 19" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const flame = () => F("M32 4 C37 18 50 24 46 40 C44 51 38 58 32 58 C25 58 18 51 18 42 C18 34 24 30 27 21 C29 25 31 27 34 27 C35 19 33 12 32 4Z") + `<path d="M32 58 C26 58 24 52 26 46 C28 42 31 40 32 35 C36 41 40 44 39 50 C38 55 35 58 32 58Z" fill="#fff6c0" fill-opacity=".85"/>`;
const bolt = () => F("M37 3 L16 35 H28 L24 61 L49 26 H35 L42 3Z");
const ice = () => L("M32 6 V58 M9.5 19 L54.5 45 M9.5 45 L54.5 19", 4.4) + L("M26 12 L32 18 L38 12 M26 52 L32 46 L38 52 M12 29 L19 28 L18 21 M52 35 L45 36 L46 43 M12 35 L19 36 L18 43 M52 29 L45 28 L46 21", 3);
const skull = () => F("M32 6 C17 6 10 17 11 29 C11 35 15 38 19 40 V50 H27 V45 H30 V50 H34 V45 H37 V50 H45 V40 C49 38 53 35 53 29 C54 17 47 6 32 6Z") + `<ellipse cx="23.5" cy="28" rx="6" ry="6.8" fill="#1a0a10"/><ellipse cx="40.5" cy="28" rx="6" ry="6.8" fill="#1a0a10"/><path d="M32 33 L28.5 41 H35.5Z" fill="#1a0a10"/>`;
const eye = () => F("M3 32 C15 12 49 12 61 32 C49 52 15 52 3 32Z") + `<circle cx="32" cy="32" r="12" fill="#1a2a4a" stroke="#2a1608" stroke-width="1.6"/><circle cx="32" cy="32" r="5.2" fill="#05050a"/><circle cx="27.5" cy="27.5" r="3" fill="#fff"/>`;
const wind = () => L("M6 22 H38 C47 22 49 11 41 10 C37 10 35 13 36 16", 5) + L("M6 34 H46 C55 34 57 45 49 46 C45 46 43 43 44 40", 5) + L("M12 46 H32 C38 46 39 54 33 54", 4);
const star = () => F("M32 3 L38.5 25.5 L61 32 L38.5 38.5 L32 61 L25.5 38.5 L3 32 L25.5 25.5Z") + `<circle cx="32" cy="32" r="4.2" fill="#fff"/>`;
const dark = () => `<circle cx="32" cy="32" r="23" fill="#0c0618" stroke="url(#gl)" stroke-width="3.5"/><path d="M40 14 C26 14 18 24 18 34 C18 46 28 52 38 50 C28 46 26 34 30 26 C32 21 35 17 40 14Z" fill="url(#gl)" ${ST}/><circle cx="43" cy="30" r="3" fill="#fff"/><circle cx="48" cy="42" r="1.8" fill="#fff"/>`;
const drop = () => F("M32 4 C32 4 13 27 13 40 C13 51 21 59 32 59 C43 59 51 51 51 40 C51 27 32 4 32 4Z") + `<path d="M21 40 C21 46 25 51 30 52" stroke="#fff" stroke-opacity=".85" stroke-width="3" fill="none" stroke-linecap="round"/>`;
const paw = () => F("M32 31 C22 31 14 40 17 48 C19 54 26 52 32 52 C38 52 45 54 47 48 C50 40 42 31 32 31Z") + [[14, 27, 5, 7, -25], [25, 16, 5.2, 7.5, -8], [39, 16, 5.2, 7.5, 8], [50, 27, 5, 7, 25]].map(([x, y, rx, ry, r]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#gl)" ${ST}/>`).join("");
const bow = () => L("M20 5 C54 16 54 48 20 59", 5) + `<path d="M20 5 L20 59" stroke="#fff" stroke-opacity=".9" stroke-width="1.4"/>` + `<path d="M6 32 H52" stroke="#2a1608" stroke-width="4.4" stroke-linecap="round"/><path d="M6 32 H50" stroke="#e8d2a0" stroke-width="2.2" stroke-linecap="round"/>` + F("M60 32 L48 26 L50 32 L48 38Z") + F("M6 32 L2 27 H10 L12 32 L10 37 H2Z");
const power = () => { let p = ""; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 15 : 29; p += `${i ? "L" : "M"}${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`; } return F(p + "Z") + `<circle cx="32" cy="32" r="8" fill="#2a1608" fill-opacity=".5"/>`; };
const book = () => F("M32 14 C24 8 12 9 6 12 V50 C12 47 24 46 32 52 C40 46 52 47 58 50 V12 C52 9 40 8 32 14Z") + `<path d="M32 14 V52" stroke="#2a1608" stroke-width="2"/><path d="M13 20 H27 M13 28 H27 M13 36 H27 M37 20 H51 M37 28 H51 M37 36 H51" stroke="#2a1608" stroke-opacity=".5" stroke-width="2"/>`;
const tree = () => `<rect x="28" y="46" width="8" height="14" fill="#8a5a2a" ${ST}/>` + F("M32 3 L48 24 H39 L52 40 H12 L25 24 H16Z");
const sun = () => { let r = ""; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; r += `M${(32 + Math.cos(a) * 18).toFixed(1)} ${(32 + Math.sin(a) * 18).toFixed(1)}L${(32 + Math.cos(a) * 28).toFixed(1)} ${(32 + Math.sin(a) * 28).toFixed(1)}`; } return L(r, 3.6) + `<circle cx="32" cy="32" r="13.5" fill="url(#gl)" ${ST}/>`; };
const chain = () => rot(L("M14 22 H34 A9 9 0 0 1 34 40 H14 A9 9 0 0 1 14 22Z", 4.6), -35, 24, 31) + rot(L("M30 24 H50 A9 9 0 0 1 50 42 H30 A9 9 0 0 1 30 24Z", 4.6), -35, 40, 33);
const spiral = () => L("M32 32 m0 0 a3 3 0 1 1 6 0 a8 8 0 1 1 -16 0 a13 13 0 1 1 26 0 a18 18 0 1 1 -36 0 a23 23 0 0 1 20 -23", 4.6);
const meteor = () => F("M4 58 L22 18 L36 32Z", `opacity=".9"`) + `<circle cx="40" cy="25" r="14" fill="url(#gl)" ${ST}/><circle cx="35" cy="20" r="3" fill="#fff" fill-opacity=".8"/><circle cx="45" cy="29" r="3.4" fill="#2a1608" fill-opacity=".35"/>`;
const crown = () => F("M8 48 L8 18 L22 32 L32 10 L42 32 L56 18 L56 48Z") + F("M8 48 H56 V55 H8Z") + `<circle cx="32" cy="38" r="4" fill="#ff5a6e" stroke="#2a1608"/>`;
const claw = () => [0, 16, 32].map((o) => `<path d="M${10 + o} 6 Q${36 + o} 28 ${18 + o} 58 Q${22 + o} 28 ${10 + o} 6Z" fill="url(#gl)" ${ST}/>`).join("");
const leaf = () => F("M10 54 C8 30 24 8 56 8 C58 36 40 56 14 54Z") + `<path d="M12 52 C26 40 36 28 48 16" stroke="#2a1608" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const wings = () => F("M32 54 C26 40 12 40 4 20 C16 24 22 24 28 30 C28 22 22 14 16 6 C28 10 34 20 32 30 C34 20 40 10 52 6 C46 14 40 22 40 30 C46 24 52 24 60 20 C52 40 38 40 32 54Z");
const fang = () => F("M12 8 C26 4 40 4 52 8 C50 28 42 46 32 58 C22 46 14 28 12 8Z") + `<path d="M20 10 C24 24 28 36 32 46" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

export const GLYPHS: Record<string, Glyph> = { sword, dagger, axe, hammer, shield, heart, flame, bolt, ice, skull, eye, wind, star, dark, drop, paw, bow, power, book, tree, sun, chain, spiral, meteor, crown, claw, leaf, wings, fang };

const MAP: Record<string, string> = {
  sword: "⚔️🗡️🌅🔱⚖️", dagger: "🔪🪡📌✂️✴️🦵", axe: "🪓🛁⚙️", hammer: "🔨💥", claw: "🐾🌙🐺", fang: "🦷🦴🐍🦇",
  shield: "🛡️🔰🧱🚧🤺🏰🏯⛪✝️🗿🪨🏔️🗻🦾↩️🔆", heart: "❤️💚💜🫀🩹🍖🌸🌱🍀💋", flame: "🔥🕯️🌋", bolt: "⚡🌩️", ice: "❄️🧊🥶🌨️💠",
  skull: "☠️💀⚰️👹😈🧿", eye: "👁️🔭👂🎯🦅", wind: "💨🌬️🌫️🍃🌪️👣👟", star: "✨🌟🌠💎🌈🏆", dark: "🌑🌘🌓🌌🕳️⚫👤🎭👻👥🌀",
  drop: "🩸💧☣️🧪🦠🥀🌹", paw: "🐻🐗🐂🦁🦣🐕🐲🦊🐉🦌🦬☯️", bow: "🏹🪤📍↪️🌧️☔💣🎗️", power: "💪🖐️🦘🏋️💢😠😡🗣️📣📢🚩💃",
  book: "📖📕📚📜🎼🔮🧘🧠🎓♾️", tree: "🌲🌳🏕️", sun: "☀️", chain: "⛓️", spiral: "🌀", meteor: "☄️", crown: "👑", leaf: "🌿", wings: "🦅",
};
const LOOKUP: Record<string, string> = {};
for (const [g, chars] of Object.entries(MAP)) for (const ch of Array.from(chars)) if (ch !== "\uFE0F") LOOKUP[ch] = g;
LOOKUP["🌀"] = "spiral"; LOOKUP["🦅"] = "eye"; LOOKUP["🌿"] = "leaf";

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const norm = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#7a8cff");

export interface IconOpts { color?: string; tier?: number; passive?: boolean; cls?: boolean }

export function makeIcon(emoji: string, o: IconOpts = {}): string {
  const key = Array.from(emoji).filter((c) => c !== "\uFE0F").join("");
  const glyphName = LOOKUP[Array.from(key)[0]] ?? (["star", "sword", "flame"][hash(emoji) % 3]);
  const color = norm(o.color ?? "#8a9bff");
  const tier = o.tier ?? 1;
  const c1 = mixHex(color, "#ffffff", 0.35), c2 = mixHex(color, "#10101c", 0.5), c3 = mixHex(color, "#05050a", 0.82);
  const h = hash(emoji + color);
  const bgBase = o.passive ? "#3a4258" : c2;
  const gold = tier >= 4 || o.cls ? ["#fff2b0", "#e0a83a", "#7a4a12"] : tier >= 2 ? ["#f4e2b8", "#b08a46", "#5a3c14"] : ["#d8dce8", "#8a90a4", "#40455a"];
  const shape = o.passive
    ? (inset: number) => `<circle cx="32" cy="32" r="${30 - inset}"`
    : o.cls
      ? (inset: number) => `<path d="M32 ${2 + inset} L${54 - inset} ${10 + inset} L${60 - inset} 32 L${54 - inset} ${54 - inset} L32 ${62 - inset} L${10 + inset} ${54 - inset} L${4 + inset} 32 L${10 + inset} ${10 + inset}Z"`
      : (inset: number) => `<rect x="${2 + inset}" y="${2 + inset}" width="${60 - inset * 2}" height="${60 - inset * 2}" rx="${11 - inset}"`;
  let rays = "";
  const n = 8 + (h % 5);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (h % 7); rays += `<path d="M32 32 L${(32 + Math.cos(a) * 46).toFixed(1)} ${(32 + Math.sin(a) * 46).toFixed(1)} L${(32 + Math.cos(a + 0.12) * 46).toFixed(1)} ${(32 + Math.sin(a + 0.12) * 46).toFixed(1)}Z" fill="#fff" fill-opacity=".07"/>`; }
  const orn = tier >= 5 ? `<path d="M32 -1 L36 6 H28Z M32 65 L36 58 H28Z" fill="url(#fr)"/><circle cx="6" cy="6" r="3" fill="url(#fr)"/><circle cx="58" cy="6" r="3" fill="url(#fr)"/><circle cx="6" cy="58" r="3" fill="url(#fr)"/><circle cx="58" cy="58" r="3" fill="url(#fr)"/>` : tier >= 3 && !o.passive ? `<circle cx="6" cy="6" r="2.4" fill="url(#fr)"/><circle cx="58" cy="6" r="2.4" fill="url(#fr)"/>` : "";
  const glyph = GLYPHS[glyphName]();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 68 68" width="64" height="64"><defs>
<radialGradient id="bg" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="${o.passive ? "#6a7694" : c1}"/><stop offset=".55" stop-color="${bgBase}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${mixHex(color, "#fff6d8", 0.78)}"/><stop offset="1" stop-color="${mixHex(color, "#ffd070", 0.5)}"/></linearGradient>
<linearGradient id="fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gold[0]}"/><stop offset=".5" stop-color="${gold[1]}"/><stop offset="1" stop-color="${gold[2]}"/></linearGradient>
<radialGradient id="gw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c1}" stop-opacity=".75"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.3" flood-color="#000" flood-opacity=".85"/></filter>
<clipPath id="cp">${shape(0)}/></clipPath></defs>
${shape(0)} fill="url(#bg)"/>
<g clip-path="url(#cp)">${rays}<circle cx="32" cy="34" r="26" fill="url(#gw)"/><path d="M0 0 H64 V26 Q32 38 0 26Z" fill="#fff" fill-opacity=".1"/></g>
<g filter="url(#sh)" transform="translate(32 32) scale(.78) translate(-32 -32)">${glyph}</g>
${shape(0)} fill="none" stroke="#0a0608" stroke-width="4.6"/>
${shape(0)} fill="none" stroke="url(#fr)" stroke-width="3"/>
${shape(2.6)} fill="none" stroke="#000" stroke-opacity=".55" stroke-width="1"/>${orn}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const CLASS_GLYPH: Record<string, string> = { warrior: "⚔️", assassin: "🔪", mage: "🔥", sorcerer: "🌑", shieldbearer: "🛡️", archer: "🏹", berserker: "🪓", tamer: "🐾" };
