/* Процедурная музыка и звуки (WebAudio, без внешних файлов) */
export interface AudioSettings { master: number; music: number; sfx: number }
const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MODES: Record<string, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], ionian: [0, 2, 4, 5, 7, 9, 11],
};
interface Track { name: string; bpm: number; root: number; mode: string; prog: number[]; seed: number; lead: "flute" | "pluck" | "brass" | "bell"; drums: number; pad: number; arp: number; density: number }
export const TRACKS: Record<string, Track> = {
  dawn: { name: "Рассвет над опушкой", bpm: 88, root: 50, mode: "dorian", prog: [0, 5, 3, 4], seed: 11, lead: "flute", drums: 0.3, pad: 0.6, arp: 1, density: 0.55 },
  tavern: { name: "Хмельная таверна", bpm: 116, root: 55, mode: "mixo", prog: [0, 3, 4, 0], seed: 23, lead: "pluck", drums: 1, pad: 0.2, arp: 0.6, density: 0.8 },
  night: { name: "Лунная тропа", bpm: 62, root: 57, mode: "aeolian", prog: [0, 5, 2, 6], seed: 37, lead: "bell", drums: 0, pad: 1, arp: 0.8, density: 0.3 },
  battle: { name: "Клинки и пламя", bpm: 138, root: 52, mode: "phryg", prog: [0, 1, 0, 6], seed: 41, lead: "brass", drums: 1.6, pad: 0.7, arp: 0.2, density: 0.7 },
  desert: { name: "Ветер Ал-Хазар", bpm: 96, root: 50, mode: "harm", prog: [0, 0, 5, 4], seed: 53, lead: "flute", drums: 0.8, pad: 0.4, arp: 0.5, density: 0.6 },
  crypt: { name: "Зов склепа", bpm: 54, root: 48, mode: "phryg", prog: [0, 1, 0, 5], seed: 67, lead: "bell", drums: 0.1, pad: 1.1, arp: 0.3, density: 0.25 },
  forest: { name: "Шёпот древних лесов", bpm: 72, root: 52, mode: "dorian", prog: [0, 6, 5, 6], seed: 71, lead: "flute", drums: 0.1, pad: 0.9, arp: 1, density: 0.45 },
  snow: { name: "Белая вьюга", bpm: 66, root: 53, mode: "ionian", prog: [0, 4, 5, 3], seed: 79, lead: "bell", drums: 0.1, pad: 1, arp: 0.9, density: 0.4 },
  ash: { name: "Пепел и железо", bpm: 100, root: 45, mode: "harm", prog: [0, 5, 0, 4], seed: 83, lead: "brass", drums: 1.2, pad: 0.8, arp: 0.3, density: 0.55 },
  coast: { name: "Солёный бриз", bpm: 104, root: 55, mode: "ionian", prog: [0, 4, 5, 3], seed: 89, lead: "pluck", drums: 0.6, pad: 0.3, arp: 1, density: 0.7 },
};
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashS = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; verb!: ConvolverNode; verbSend!: GainNode; noiseBuf!: AudioBuffer;
  settings: AudioSettings = { master: 0.8, music: 0.5, sfx: 0.8 };
  current = ""; trackGain: GainNode | null = null; timer = 0; step = 0; nextT = 0; track: Track | null = null; melody: number[][] = []; want = "";
  onTrack?: (name: string) => void;

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain();
    this.musicBus.connect(comp); this.sfxBus.connect(comp); comp.connect(this.master);
    const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.32; this.verbSend.connect(this.verb); this.verb.connect(comp);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.apply();
  }
  resume() { this.init(); if (this.ctx && this.ctx.state !== "running") void this.ctx.resume(); }
  apply() {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.musicBus.gain.value = this.settings.music * 0.55;
    this.sfxBus.gain.value = this.settings.sfx;
  }
  set(s: Partial<AudioSettings>) { this.settings = { ...this.settings, ...s }; this.apply(); }

  // ---------- примитивы ----------
  private osc(type: OscillatorType, f: number, t: number, dur: number, vol: number, dest: AudioNode, opt: { f2?: number; atk?: number; lp?: number; q?: number; verb?: number; detune?: number } = {}) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (opt.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f2), t + dur);
    if (opt.detune) o.detune.value = opt.detune;
    const atk = opt.atk ?? 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n: AudioNode = o;
    if (opt.lp) { const f1 = c.createBiquadFilter(); f1.type = "lowpass"; f1.frequency.value = opt.lp; f1.Q.value = opt.q ?? 0.7; o.connect(f1); n = f1; }
    n.connect(g); g.connect(dest);
    if (opt.verb) { const s = c.createGain(); s.gain.value = opt.verb; g.connect(s); s.connect(this.verbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(t: number, dur: number, vol: number, dest: AudioNode, o: { type?: BiquadFilterType; f?: number; f2?: number; q?: number; atk?: number; verb?: number } = {}) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type ?? "bandpass"; f.frequency.setValueAtTime(o.f ?? 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + dur); f.Q.value = o.q ?? 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.atk ?? 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    if (o.verb) { const v = c.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(this.verbSend); }
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------- музыкальные инструменты ----------
  private pluck(f: number, t: number, d: number, v: number) { const b = this.trackGain ?? this.musicBus; this.osc("triangle", f, t, d, v, b, { lp: 2600, verb: 0.5, atk: 0.004 }); this.osc("sawtooth", f, t, d * 0.5, v * 0.25, b, { lp: 1800, atk: 0.003 }); this.osc("sine", f * 2, t, d * 0.4, v * 0.2, b); }
  private flute(f: number, t: number, d: number, v: number) {
    const c = this.ctx!, b = this.trackGain ?? this.musicBus; const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = "sine"; o.frequency.value = f; o2.type = "triangle"; o2.frequency.value = f * 2; lfo.frequency.value = 5 + Math.random(); lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.07); g.gain.setValueAtTime(v * 0.9, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    const g2 = c.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o.connect(g); g.connect(b);
    const s = c.createGain(); s.gain.value = 0.55; g.connect(s); s.connect(this.verbSend);
    o.start(t); o2.start(t); lfo.start(t); o.stop(t + d + 0.2); o2.stop(t + d + 0.2); lfo.stop(t + d + 0.2);
    this.noise(t, 0.12, v * 0.2, b, { type: "bandpass", f: f * 2, q: 2, atk: 0.02 });
  }
  private brass(f: number, t: number, d: number, v: number) { const b = this.trackGain ?? this.musicBus; this.osc("sawtooth", f, t, d, v * 0.55, b, { lp: 1400, atk: 0.04, verb: 0.3 }); this.osc("sawtooth", f, t, d, v * 0.4, b, { lp: 900, atk: 0.05, detune: 9 }); }
  private bell(f: number, t: number, d: number, v: number) { const b = this.trackGain ?? this.musicBus; for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) this.osc("sine", f * m, t, d * (m === 1 ? 1.6 : 0.8), v * a * 0.7, b, { verb: 0.8, atk: 0.003 }); }
  private pad(freqs: number[], t: number, d: number, v: number) { const b = this.trackGain ?? this.musicBus; for (const f of freqs) for (const dt of [-8, 8]) this.osc("sawtooth", f, t, d, v * 0.16, b, { lp: 650, atk: d * 0.35, detune: dt, verb: 0.6 }); }
  private drum(t: number, kind: "low" | "mid" | "tick", v: number) {
    const b = this.trackGain ?? this.musicBus;
    if (kind === "tick") { this.noise(t, 0.05, v * 0.5, b, { type: "highpass", f: 5000 }); return; }
    this.osc("sine", kind === "low" ? 110 : 170, t, 0.28, v, b, { f2: kind === "low" ? 48 : 85 }); this.noise(t, 0.09, v * 0.5, b, { type: "lowpass", f: 900 });
  }

  // ---------- сочинение ----------
  private degFreq(tr: Track, deg: number) {
    const sc = MODES[tr.mode]; const oct = Math.floor(deg / 7); const d = ((deg % 7) + 7) % 7;
    return NOTE(tr.root + sc[d] + 12 * oct);
  }
  private compose(tr: Track) {
    const r = rng(tr.seed); const phr: number[][] = [];
    // 4 такта по 16 шагов: [шаг, ступень, длительность в шагах]
    for (let bar = 0; bar < 8; bar++) {
      const chord = tr.prog[bar % 4]; const ev: number[] = [];
      let pos = 0, deg = chord + 7 + (r() < 0.5 ? 2 : 4);
      while (pos < 16) {
        const len = [2, 2, 4, 3, 1, 4, 6][Math.floor(r() * 7)];
        if (r() < tr.density) { deg += Math.round((r() - 0.5) * 4); deg = Math.max(chord + 3, Math.min(chord + 13, deg)); if (pos + len >= 16 && bar % 4 === 3) deg = chord + 7; ev.push(pos, deg, Math.min(len, 16 - pos)); }
        pos += len;
      }
      phr.push(ev);
    }
    this.melody = phr;
  }
  private schedule() {
    const c = this.ctx!, tr = this.track; if (!tr) return;
    const sixteenth = 60 / tr.bpm / 4;
    while (this.nextT < c.currentTime + 0.35) {
      const s = this.step, bar = Math.floor(s / 16), st = s % 16, t = this.nextT, chord = tr.prog[bar % 4];
      const A = bar % 8 < 4 ? 0 : 1;
      // бас
      if (st === 0 || (st === 8 && tr.drums > 0.5)) this.pluck(this.degFreq(tr, chord - 7) , t, sixteenth * 7, 0.2);
      // арпеджио (лютня/арфа)
      if (tr.arp > 0 && st % 2 === 0 && Math.random() < tr.arp + 0.2) { const k = [0, 2, 4, 7, 4, 2, 0, 2][(st / 2) % 8]; this.pluck(this.degFreq(tr, chord + k), t, sixteenth * 4, 0.075); }
      // подкладка
      if (st === 0 && bar % 2 === 0 && tr.pad > 0) this.pad([this.degFreq(tr, chord - 7), this.degFreq(tr, chord), this.degFreq(tr, chord + 2), this.degFreq(tr, chord + 4)], t, sixteenth * 30, tr.pad * 0.5);
      // барабаны
      if (tr.drums > 0) {
        const hard = tr.drums;
        if (st === 0 || (st === 10 && hard > 0.5)) this.drum(t, "low", 0.35 * Math.min(1, hard));
        if ((st === 4 || st === 12) && hard > 0.25) this.drum(t, "mid", 0.22 * Math.min(1, hard));
        if (st % 2 === 0 && hard > 0.7) this.drum(t, "tick", 0.14);
      }
      // мелодия
      const ev = this.melody[bar % 8];
      for (let i = 0; i < ev.length; i += 3) if (ev[i] === st) {
        const f = this.degFreq(tr, ev[i + 1] + (A ? 0 : 0)), d = ev[i + 2] * sixteenth;
        if (tr.lead === "flute") this.flute(f, t, d * 0.95, 0.16); else if (tr.lead === "pluck") this.pluck(f, t, d * 1.4, 0.16); else if (tr.lead === "brass") this.brass(f * 0.5, t, d * 0.9, 0.15); else this.bell(f, t, d, 0.12);
      }
      this.nextT += sixteenth; this.step++;
    }
  }
  play(key: string) {
    if (!this.ctx || this.current === key) { this.want = key; return; }
    const tr = TRACKS[key]; if (!tr) return;
    const c = this.ctx; this.want = key;
    const old = this.trackGain;
    if (old) { old.gain.cancelScheduledValues(c.currentTime); old.gain.setValueAtTime(old.gain.value, c.currentTime); old.gain.linearRampToValueAtTime(0, c.currentTime + 2.2); setTimeout(() => old.disconnect(), 2600); }
    const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(1, c.currentTime + 2.5); g.connect(this.musicBus);
    this.trackGain = g; this.track = tr; this.current = key; this.step = 0; this.nextT = c.currentTime + 0.1; this.compose(tr);
    if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 90);
    this.onTrack?.(tr.name);
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = 0; } this.current = ""; }

  // ---------- звуковые эффекты ----------
  private d() { return this.sfxBus; }
  sfx(name: string, o: { pitch?: number; vol?: number } = {}) {
    const c = this.ctx; if (!c || c.state !== "running") return;
    const t = c.currentTime, p = o.pitch ?? 1, v = o.vol ?? 1, d = this.d();
    switch (name) {
      case "slash": this.noise(t, 0.22, 0.5 * v, d, { type: "bandpass", f: 1400 * p, f2: 5200 * p, q: 0.9, atk: 0.02 }); this.osc("triangle", 1800 * p, t + 0.05, 0.1, 0.08 * v, d, { f2: 900 * p }); break;
      case "slash2": this.noise(t, 0.18, 0.45 * v, d, { type: "bandpass", f: 5000 * p, f2: 1200 * p, q: 1, atk: 0.015 }); this.osc("square", 2400 * p, t + 0.04, 0.07, 0.05 * v, d, { f2: 1200 * p }); break;
      case "stab": this.noise(t, 0.09, 0.5 * v, d, { type: "highpass", f: 3000 * p }); this.noise(t + 0.09, 0.09, 0.4 * v, d, { type: "highpass", f: 3600 * p }); this.osc("sine", 700 * p, t, 0.08, 0.1 * v, d, { f2: 300 }); break;
      case "bash": this.osc("sine", 140 * p, t, 0.3, 0.7 * v, d, { f2: 45 }); this.noise(t, 0.15, 0.45 * v, d, { type: "lowpass", f: 1500 }); this.osc("square", 320 * p, t, 0.08, 0.12 * v, d, { f2: 120 }); break;
      case "axe": this.noise(t, 0.3, 0.6 * v, d, { type: "bandpass", f: 500 * p, f2: 2500 * p, atk: 0.05 }); this.osc("sine", 90 * p, t + 0.18, 0.35, 0.8 * v, d, { f2: 38 }); this.noise(t + 0.18, 0.12, 0.5 * v, d, { type: "lowpass", f: 1800 }); break;
      case "whip": this.noise(t, 0.16, 0.3 * v, d, { type: "bandpass", f: 800 * p, f2: 6000 * p, atk: 0.04 }); this.noise(t + 0.13, 0.05, 0.9 * v, d, { type: "highpass", f: 4500 }); break;
      case "shoot": this.osc("triangle", 330 * p, t, 0.28, 0.35 * v, d, { f2: 110 * p, verb: 0.2 }); this.noise(t + 0.02, 0.2, 0.3 * v, d, { type: "bandpass", f: 3000 * p, f2: 900, q: 0.8 }); break;
      case "charge": this.osc("sine", 300 * p, t, 0.5, 0.14 * v, d, { f2: 900 * p, atk: 0.3 }); this.osc("triangle", 150 * p, t, 0.5, 0.1 * v, d, { f2: 90 }); break;
      case "arrowhit": this.osc("sine", 220 * p, t, 0.12, 0.35 * v, d, { f2: 90 }); this.noise(t, 0.06, 0.3 * v, d, { type: "highpass", f: 2500 }); break;
      case "hit": this.osc("sine", 160 * p, t, 0.14, 0.45 * v, d, { f2: 60 }); this.noise(t, 0.08, 0.35 * v, d, { type: "lowpass", f: 1800 }); break;
      case "crit": this.osc("sine", 180 * p, t, 0.2, 0.55 * v, d, { f2: 55 }); this.noise(t, 0.12, 0.5 * v, d, { type: "bandpass", f: 3000 }); this.osc("triangle", 1500 * p, t, 0.25, 0.14 * v, d, { f2: 2400, verb: 0.4 }); break;
      case "hurt": this.osc("sawtooth", 200 * p, t, 0.22, 0.3 * v, d, { f2: 90, lp: 900 }); this.noise(t, 0.1, 0.3 * v, d, { type: "lowpass", f: 1200 }); break;
      case "die": this.osc("sawtooth", 260 * p, t, 0.6, 0.3 * v, d, { f2: 50, lp: 700 }); this.noise(t, 0.4, 0.25 * v, d, { type: "lowpass", f: 600, f2: 120 }); break;
      case "levelup": [0, 4, 7, 12, 16, 19].forEach((n, i) => { this.osc("triangle", NOTE(72 + n), t + i * 0.09, 0.9, 0.22 * v, d, { verb: 0.7 }); this.osc("sine", NOTE(84 + n), t + i * 0.09, 0.6, 0.1 * v, d, { verb: 0.7 }); }); break;
      case "quest": [0, 7, 12, 16].forEach((n, i) => this.brass(NOTE(60 + n), t + i * 0.13, 0.5, 0.3 * v)); break;
      case "loot": this.osc("square", 1318, t, 0.07, 0.1 * v, d); this.osc("square", 1760, t + 0.06, 0.12, 0.1 * v, d, { verb: 0.4 }); break;
      case "click": this.osc("sine", 900, t, 0.04, 0.12 * v, d); break;
      case "heal": [0, 4, 7, 11].forEach((n, i) => this.osc("sine", NOTE(79 + n) * p, t + i * 0.07, 0.7, 0.16 * v, d, { verb: 0.8 })); break;
      case "buff": this.osc("triangle", 300 * p, t, 0.7, 0.2 * v, d, { f2: 900 * p, atk: 0.2, verb: 0.5 }); this.osc("sine", 600 * p, t + 0.2, 0.6, 0.12 * v, d, { f2: 1500 * p, verb: 0.5 }); break;
      case "fire": this.noise(t, 0.6, 0.55 * v, d, { type: "bandpass", f: 500 * p, f2: 2200 * p, atk: 0.08, verb: 0.2 }); this.noise(t + 0.1, 0.4, 0.3 * v, d, { type: "highpass", f: 4000 }); this.osc("sawtooth", 120 * p, t, 0.5, 0.25 * v, d, { f2: 60, lp: 500 }); break;
      case "ice": [0, 3, 7, 10, 14].forEach((n, i) => this.osc("sine", NOTE(88 + n) * p, t + i * 0.04, 0.5, 0.12 * v, d, { verb: 0.8 })); this.noise(t, 0.25, 0.25 * v, d, { type: "highpass", f: 6000 }); break;
      case "bolt": this.osc("sawtooth", 1800 * p, t, 0.18, 0.28 * v, d, { f2: 120, lp: 3000 }); this.noise(t, 0.3, 0.45 * v, d, { type: "highpass", f: 2500, atk: 0.002 }); this.osc("sine", 70, t + 0.05, 0.5, 0.5 * v, d, { f2: 35 }); break;
      case "dark": this.osc("sawtooth", 110 * p, t, 0.7, 0.3 * v, d, { f2: 55, lp: 600, detune: 12, verb: 0.5 }); this.osc("sawtooth", 117 * p, t, 0.7, 0.25 * v, d, { f2: 52, lp: 600, verb: 0.5 }); this.noise(t, 0.5, 0.2 * v, d, { type: "bandpass", f: 300, f2: 120 }); break;
      case "poison": for (let i = 0; i < 5; i++) this.osc("sine", (300 + Math.random() * 300) * p, t + i * 0.07, 0.12, 0.2 * v, d, { f2: 700 * p }); this.noise(t, 0.4, 0.15 * v, d, { type: "bandpass", f: 1800, q: 3 }); break;
      case "holy": [0, 4, 7, 12].forEach((n, i) => { this.osc("sine", NOTE(72 + n) * p, t + i * 0.03, 1.1, 0.16 * v, d, { verb: 1, atk: 0.1 }); this.osc("triangle", NOTE(84 + n) * p, t + i * 0.03, 1.0, 0.06 * v, d, { verb: 1, atk: 0.1 }); }); break;
      case "quake": this.osc("sine", 70 * p, t, 0.9, 0.8 * v, d, { f2: 28 }); this.noise(t, 0.8, 0.55 * v, d, { type: "lowpass", f: 400, f2: 80, atk: 0.02 }); break;
      case "wind": this.noise(t, 0.7, 0.4 * v, d, { type: "bandpass", f: 400 * p, f2: 3000 * p, q: 1.2, atk: 0.25 }); break;
      case "blood": this.osc("sine", 120 * p, t, 0.3, 0.5 * v, d, { f2: 50 }); this.noise(t, 0.25, 0.35 * v, d, { type: "bandpass", f: 700, q: 2 }); this.osc("sawtooth", 80 * p, t + 0.1, 0.4, 0.2 * v, d, { lp: 400 }); break;
      case "summon": this.osc("sine", 110 * p, t, 1, 0.4 * v, d, { f2: 330 * p, atk: 0.4, verb: 0.8 }); this.bell(NOTE(60) * p, t + 0.4, 1.5, 0.3 * v); break;
      case "dash": this.noise(t, 0.3, 0.5 * v, d, { type: "bandpass", f: 3500 * p, f2: 700, atk: 0.02 }); break;
      case "shield": this.osc("square", 440 * p, t, 0.4, 0.12 * v, d, { f2: 430, lp: 2500, verb: 0.5 }); this.osc("triangle", 880 * p, t, 0.6, 0.15 * v, d, { verb: 0.6 }); this.noise(t, 0.08, 0.4 * v, d, { type: "highpass", f: 3000 }); break;
      case "roar": this.osc("sawtooth", 90 * p, t, 0.9, 0.4 * v, d, { f2: 60, lp: 700, atk: 0.12 }); this.noise(t, 0.9, 0.4 * v, d, { type: "bandpass", f: 400, f2: 200, q: 1.5, atk: 0.1 }); break;
      case "horn": this.brass(NOTE(55), t, 1.2, 0.5 * v); this.brass(NOTE(62), t + 0.5, 1.4, 0.5 * v); break;
      case "portal": this.osc("sine", 200, t, 1.2, 0.3 * v, d, { f2: 1200, atk: 0.5, verb: 0.9 }); this.osc("triangle", 400, t, 1.2, 0.2 * v, d, { f2: 2000, atk: 0.5, verb: 0.9 }); break;
      case "step": this.noise(t, 0.06, 0.12 * v, d, { type: "lowpass", f: 700 * p }); break;
      default: this.osc("sine", 600, t, 0.1, 0.15 * v, d);
    }
  }
  /** Звук атаки класса (базовая атака) */
  attack(cls: string, hit = false) {
    const m: Record<string, [string, number]> = { warrior: ["slash", 1], assassin: ["stab", 1.1], mage: ["bolt", 1.4], sorcerer: ["dark", 1.2], shieldbearer: ["bash", 1], archer: ["shoot", 1], berserker: ["axe", 1], tamer: ["whip", 1] };
    const [n, p] = m[cls] ?? ["slash", 1]; this.sfx(n, { pitch: p * (0.95 + Math.random() * 0.1) });
    if (hit && n !== "shoot") this.sfx("hit", { vol: 0.5 });
  }
  /** Уникальный звук навыка: стихия (цвет) + вид + индивидуальная высота по id */
  skill(s: { id: string; vfx: string; color: string; kind?: string; cls: string }) {
    const el: Record<string, string> = { "#ff6a2b": "fire", "#7fd8ff": "ice", "#ffe45e": "bolt", "#b25dff": "dark", "#8dff4d": "poison", "#fff1a8": "holy", "#ff3050": "blood", "#6dff9c": "wind", "#e3ecff": "", "#aef5e6": "wind", "#ffcc4d": "holy", "#7a5cff": "dark" };
    const h = hashS(s.id), pitch = Math.pow(2, ((h % 9) - 4) / 12);
    let e = el[s.color.toLowerCase()] ?? "";
    if (s.kind === "heal") e = "heal"; else if (s.kind === "buff") e = "buff"; else if (s.kind === "shield") e = "shield"; else if (s.kind === "summon") e = "summon"; else if (s.kind === "dash") e = "dash";
    if (/quake|ground/.test(s.vfx)) e = "quake";
    if (!e) { e = s.cls === "archer" ? "shoot" : s.cls === "berserker" ? "axe" : s.cls === "shieldbearer" ? "bash" : s.cls === "assassin" ? "stab" : s.cls === "tamer" ? "whip" : "slash"; }
    this.sfx(e, { pitch });
    if (h % 3 === 0) setTimeout(() => this.sfx("hit", { vol: 0.5, pitch }), 120);
    if (h % 5 === 0 && e !== "heal" && e !== "buff") setTimeout(() => this.sfx("crit", { vol: 0.3, pitch }), 200);
  }
}
export const audio = new AudioEngine();
