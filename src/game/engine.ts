import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ZONES } from "./data/zones";
import { MOBS, NPCS, type MobDef, type NpcDef } from "./data/world";
import { CLASSES } from "./data/classes";
import { ITEMS, gearTier, rollGearDrop } from "./data/items";
import { SKILLS, skillRankMul, type SkillDef } from "./data/skills";
import { QUESTS, npcQuests } from "./data/quests";
import { mobDmg, mobGold, mobHp, mobXp, mulberry } from "./data/balance";
import { SPAWN, ZONE_NAMES, addItem, mitigation, questNeedsItem, questOnReach, questAvailable, resolveItemId } from "./logic";
import type { Appearance, ClassId, Gender, PlayerState, ZoneId } from "./types";
import { CharacterModel, type ActionKind } from "./render/character";
import { buildCreature, type Creature } from "./render/creatures";
import { World, type GatherNode } from "./render/world";
import { Vfx } from "./render/vfx";
import { bridge, useGame, type CharInfo } from "./store";

interface Label { el: HTMLDivElement; name: HTMLElement; fill: HTMLElement; marker: HTMLElement; bubble: HTMLElement; bar: HTMLElement }
interface Mob {
  id: string; def: MobDef; lvl: number; hp: number; maxHp: number; cr: Creature; pos: THREE.Vector3; home: THREE.Vector3; spawnR: number;
  state: "idle" | "chase" | "return" | "dead"; face: number; atkT: number; stun: number; slow: number; wanderT: number; wander: THREE.Vector3 | null;
  dots: { end: number; next: number; dmg: number }[]; respawnAt: number; label: Label; slamT: number; slamAt: number; dmg: number; range: number; hidden: boolean; speedN: number; lvlRange: [number, number];
}
interface Npc { def: NpcDef; model: CharacterModel; pos: THREE.Vector3; home: THREE.Vector3; label: Label; wanderT: number; wander: THREE.Vector3 | null; face: number; barkT: number; mk: string; moving: number }
interface Remote { id: number; name: string; model: CharacterModel; pos: THREE.Vector3; tpos: THREE.Vector3; face: number; tface: number; label: Label; moving: boolean; key: string; seen: number }
interface Minion { cr: Creature; pos: THREE.Vector3; until: number; atkT: number; power: number; ranged: boolean; color: string; face: number }
interface Wild { cr: Creature; pos: THREE.Vector3; home: THREE.Vector3; r: number; tgt: THREE.Vector3 | null; t: number; face: number; flee: boolean; speed: number }

const SUMMONS: Record<string, { model: string; tint: string; scale: number; count: number; ranged?: boolean }> = {
  tamer_1_1: { model: "fox", tint: "#e8802a", scale: 1.1, count: 1 },
  tamer_3_1: { model: "wolf", tint: "#cfd8ff", scale: 1.2, count: 1 },
  tamer_5_0: { model: "drake", tint: "#d04a3a", scale: 1.7, count: 1 },
  tamer_6_0: { model: "wolf", tint: "#ffcc4d", scale: 2.0, count: 1 },
  sorcerer_2_3: { model: "shadow", tint: "#7a5cff", scale: 0.9, count: 1, ranged: true },
  sorcerer_5_1: { model: "shadow", tint: "#7a5cff", scale: 0.9, count: 3, ranged: true },
};
const CLS_COLOR: Record<string, string> = { warrior: "#e0584c", assassin: "#9a6bff", mage: "#4fb4ff", sorcerer: "#c34dff", shieldbearer: "#f2c14e", archer: "#5fd68a", berserker: "#ff7a2f", tamer: "#6dd3a0" };

const tv = new THREE.Vector3();
const tv2 = new THREE.Vector3();
const dist2 = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export class GameEngine {
  container: HTMLElement; overlay: HTMLElement; info: CharInfo;
  renderer!: THREE.WebGLRenderer; composer!: EffectComposer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(55, 1, 0.3, 700);
  world!: World; vfx!: Vfx;
  clock = new THREE.Clock(); t = 0; raf = 0; disposed = false; ro?: ResizeObserver;
  // игрок
  player!: { model: CharacterModel; pos: THREE.Vector3; vy: number; face: number; grounded: boolean; speed: number; lock: number; moveDir: THREE.Vector3; label: Label; loop?: string };
  hp = 100; mp = 50; dead = false; lastCombat = -10; shield = 0; shieldEnd = 0;
  camYaw = Math.PI; camPitch = 0.38; camDist = 9; camTarget = new THREE.Vector3(); camSmooth = new THREE.Vector3();
  keys = new Set<string>(); rmb = false; lmbStart: { x: number; y: number } | null = null; lmbMoved = 0;
  mobs: Mob[] = []; npcs: Npc[] = []; remotes = new Map<number, Remote>(); minions: Minion[] = []; wilds: Wild[] = []; pet: Minion | null = null;
  target: Mob | Npc | Remote | GatherNode | null = null; targetKind: "mob" | "npc" | "player" | "node" | null = null;
  later: { at: number; fn: () => void }[] = [];
  buffsEnd: Record<string, number> = {};
  autoT = 0; hudT = 0; markerT = 0; reachT = 0; regenT = 0; saveT = 0; syncT = 0; syncing = false; lastChatId = 0; outbox: { channel: string; text: string }[] = [];
  loadingZone = false; interactLabel: string | null = null; equipKey = ""; unsub?: () => void; saving = false;
  tabIdx = 0; slams: { at: number; mob: Mob; pos: THREE.Vector3; r: number; dmg: number }[] = [];
  shake = 0; rnd = Math.random;
  private cleanup: (() => void)[] = [];

  constructor(container: HTMLElement, overlay: HTMLElement, info: CharInfo) {
    this.container = container; this.overlay = overlay; this.info = info;
  }

  // ======================= ИНИЦИАЛИЗАЦИЯ =======================
  async init(ps: PlayerState) {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.outline = "none";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.6, 0.88));
    this.composer.addPass(new OutputPass());
    this.vfx = new Vfx(this.scene);
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    bridge.engine = this;
    bridge.mm = () => this.minimapData();
    this.hp = ps.hp > 0 ? ps.hp : useGame.getState().derived.maxHp;
    this.mp = ps.mp;
    await this.loadZone(ps.zone, ps.x, ps.z, true);
    this.player.face = ps.ry; this.camYaw = ps.ry + Math.PI;
    this.equipKey = JSON.stringify(ps.equipment);
    this.unsub = useGame.subscribe((s, prev) => {
      if (s.ps.equipment !== prev.ps.equipment && JSON.stringify(s.ps.equipment) !== this.equipKey) { this.equipKey = JSON.stringify(s.ps.equipment); this.rebuildPlayer(); }
    });
    this.sync();
    this.loop();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.saveNow(true);
    this.unsub?.();
    this.cleanup.forEach((f) => f());
    this.ro?.disconnect();
    this.clearEntities();
    this.world?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.innerHTML = "";
    if (bridge.engine === this) bridge.engine = null;
  }

  // ======================= ВВОД =======================
  bindInput() {
    const el = this.renderer.domElement;
    const typing = () => { const a = document.activeElement; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
    const kd = (e: KeyboardEvent) => {
      if (typing()) { if (e.code === "Escape") (document.activeElement as HTMLElement).blur(); return; }
      this.keys.add(e.code);
      const st = useGame.getState();
      if (e.code.startsWith("Digit")) { const n = e.code === "Digit0" ? 9 : Number(e.code.slice(5)) - 1; if (n >= 0 && n < 10) this.useHotbar(n); }
      else if (e.code === "Tab") { e.preventDefault(); this.tabTarget(); }
      else if (e.code === "Escape") { if (st.dialog || st.shop || Object.values(st.win).some(Boolean)) st.closeAll(); else this.setTarget(null); }
      else if (e.code === "KeyI" || e.code === "KeyB") st.toggleWin("inv");
      else if (e.code === "KeyC") st.toggleWin("char");
      else if (e.code === "KeyK" || e.code === "KeyN") st.toggleWin("skills");
      else if (e.code === "KeyL" || e.code === "KeyJ") st.toggleWin("quests");
      else if (e.code === "KeyM") st.toggleWin("map");
      else if (e.code === "KeyF") this.interact();
      else if (e.code === "KeyR") { useGame.setState({ autoAttack: !st.autoAttack }); }
      else if (e.code === "Space") { e.preventDefault(); if (this.player.grounded && !this.dead) { this.player.vy = 8; this.player.grounded = false; } }
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    const pd = (e: PointerEvent) => {
      if (e.button === 2) { this.rmb = true; } else if (e.button === 0) { this.lmbStart = { x: e.clientX, y: e.clientY }; this.lmbMoved = 0; }
      el.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      const dx = e.movementX, dy = e.movementY;
      if (this.rmb || (this.lmbStart && (this.lmbMoved += Math.abs(dx) + Math.abs(dy)) > 6)) {
        this.camYaw -= dx * 0.0055; this.camPitch = clamp(this.camPitch + dy * 0.0045, -0.25, 1.35);
      }
    };
    const pu = (e: PointerEvent) => {
      if (e.button === 2) this.rmb = false;
      if (e.button === 0 && this.lmbStart) { if (this.lmbMoved <= 6) { const r = el.getBoundingClientRect(); this.click(e.clientX - r.left, e.clientY - r.top); } this.lmbStart = null; }
    };
    const wh = (e: WheelEvent) => { e.preventDefault(); this.camDist = clamp(this.camDist + e.deltaY * 0.008, 3, 20); };
    const cm = (e: Event) => e.preventDefault();
    const dbl = () => { if (this.target && this.targetKind === "mob") useGame.setState({ autoAttack: true }); };
    el.addEventListener("pointerdown", pd); el.addEventListener("pointermove", pm); el.addEventListener("pointerup", pu); el.addEventListener("wheel", wh, { passive: false }); el.addEventListener("contextmenu", cm); el.addEventListener("dblclick", dbl);
    const unload = () => this.saveNow(true);
    window.addEventListener("beforeunload", unload);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); window.removeEventListener("beforeunload", unload);
      el.removeEventListener("pointerdown", pd); el.removeEventListener("pointermove", pm); el.removeEventListener("pointerup", pu); el.removeEventListener("wheel", wh); el.removeEventListener("contextmenu", cm); el.removeEventListener("dblclick", dbl);
    });
  }

  project(v: THREE.Vector3): { x: number; y: number; ok: boolean } {
    tv2.copy(v).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (tv2.x * 0.5 + 0.5) * w, y: (-tv2.y * 0.5 + 0.5) * h, ok: tv2.z < 1 && tv2.z > -1 };
  }

  click(sx: number, sy: number) {
    let best: { d: number; apply: () => void } | null = null;
    const consider = (p: THREE.Vector3, hRad: number, apply: () => void) => {
      const s = this.project(p);
      if (!s.ok) return;
      const d = Math.hypot(s.x - sx, s.y - sy);
      const cd = this.camera.position.distanceTo(p);
      const lim = clamp(2400 / cd, 28, 90) * hRad;
      if (d < lim && (!best || d < best.d)) best = { d, apply };
    };
    for (const m of this.mobs) if (m.state !== "dead" && !m.hidden) consider(tv.set(m.pos.x, m.pos.y + m.cr.height * 0.5, m.pos.z).clone(), Math.max(1, m.def.scale * 0.8), () => this.setTarget(m));
    for (const n of this.npcs) consider(tv.set(n.pos.x, n.pos.y + 1, n.pos.z).clone(), 1, () => { if (this.target === n) this.interact(); else this.setTarget(n); });
    this.remotes.forEach((r) => consider(tv.set(r.pos.x, r.pos.y + 1, r.pos.z).clone(), 1, () => this.setTarget(r)));
    for (const g of this.world.gathers) if (!g.taken) consider(tv.set(g.x, g.obj.position.y + 0.8, g.z).clone(), 0.9, () => { this.setTarget(g); this.interact(); });
    if (best) (best as { apply: () => void }).apply();
    else if (!this.rmb) this.setTarget(null);
  }

  tabTarget() {
    const cands = this.mobs.filter((m) => m.state !== "dead" && !m.hidden && dist2(m.pos, this.player.pos) < 40).sort((a, b) => dist2(a.pos, this.player.pos) - dist2(b.pos, this.player.pos));
    if (!cands.length) return;
    const cur = cands.indexOf(this.target as Mob);
    this.setTarget(cands[(cur + 1) % cands.length]);
  }

  setTarget(t: Mob | Npc | Remote | GatherNode | null) {
    this.target = t;
    this.targetKind = !t ? null : "hp" in t ? "mob" : "def" in t ? "npc" : "item" in t ? "node" : "player";
    if (!t) { useGame.setState({ target: null, autoAttack: false }); return; }
    this.syncTarget();
  }

  syncTarget() {
    const t = this.target;
    if (!t) return;
    const lv = useGame.getState().ps.level;
    if (this.targetKind === "mob") { const m = t as Mob; useGame.setState({ target: { id: m.id, kind: "mob", name: m.def.name, level: m.lvl, hp: Math.max(0, m.hp), maxHp: m.maxHp, boss: !!m.def.boss } }); }
    else if (this.targetKind === "npc") { const n = t as Npc; useGame.setState({ target: { id: n.def.id, kind: "npc", name: n.def.name, title: n.def.title, hp: 1, maxHp: 1, friendly: true } }); }
    else if (this.targetKind === "player") { const r = t as Remote; useGame.setState({ target: { id: "p" + r.id, kind: "player", name: r.name, hp: 1, maxHp: 1, friendly: true, level: lv } }); }
    else if (this.targetKind === "node") { const g = t as GatherNode; useGame.setState({ target: { id: "n" + g.id, kind: "node", name: g.label, hp: 1, maxHp: 1, friendly: true } }); }
  }

  // ======================= СОЗДАНИЕ ЛЮДЕЙ =======================
  makeLabel(name: string, color = "#fff", lvl?: number, showBar = true): Label {
    const el = document.createElement("div");
    el.className = "np";
    el.innerHTML = `<div class="np-bubble"></div><div class="np-marker"></div><div class="np-name"></div><div class="np-bar"><i></i></div>`;
    const nameEl = el.querySelector(".np-name") as HTMLElement;
    nameEl.innerHTML = `${lvl ? `<span class="np-lv">${lvl}</span>` : ""}<span class="np-nm" style="color:${color}">${name}</span>`;
    const bar = el.querySelector(".np-bar") as HTMLElement;
    if (!showBar) bar.style.display = "none";
    this.overlay.appendChild(el);
    return { el, name: nameEl, fill: bar.querySelector("i") as HTMLElement, marker: el.querySelector(".np-marker") as HTMLElement, bubble: el.querySelector(".np-bubble") as HTMLElement, bar };
  }

  gear() {
    const ps = useGame.getState().ps;
    const eq = ps.equipment;
    const armorTier = Math.max(0, gearTier(eq.chest), gearTier(eq.legs) - 0);
    return { armorTier: eq.chest ? gearTier(eq.chest) : eq.legs ? gearTier(eq.legs) : 0, weaponTier: Math.max(0, gearTier(eq.weapon)), head: !!eq.head, armorTierMax: armorTier };
  }

  buildPlayerModel() {
    const g = this.gear();
    return new CharacterModel({ cls: this.info.cls, gender: this.info.gender, app: this.info.appearance, armorTier: g.armorTier, weaponTier: g.weaponTier, head: g.head });
  }

  rebuildPlayer() {
    const old = this.player.model;
    const m = this.buildPlayerModel();
    m.group.position.copy(old.group.position); m.group.rotation.copy(old.group.rotation);
    this.scene.add(m.group); this.scene.remove(old.group); old.dispose();
    this.player.model = m;
    this.vfx.heal(this.player.pos.clone(), "#fff0a0");
  }

  // ======================= ЗОНЫ =======================
  clearEntities() {
    for (const m of this.mobs) { m.cr.group.removeFromParent(); m.label.el.remove(); }
    for (const n of this.npcs) { n.model.group.removeFromParent(); n.model.dispose(); n.label.el.remove(); }
    this.remotes.forEach((r) => { r.model.group.removeFromParent(); r.model.dispose(); r.label.el.remove(); });
    for (const m of this.minions) m.cr.group.removeFromParent();
    for (const w of this.wilds) w.cr.group.removeFromParent();
    this.pet?.cr.group.removeFromParent();
    this.mobs = []; this.npcs = []; this.remotes.clear(); this.minions = []; this.wilds = []; this.pet = null; this.slams = []; this.later = [];
    this.overlay.querySelectorAll(".fct").forEach((e) => e.remove());
  }

  async loadZone(id: ZoneId, x?: number, z?: number, first = false) {
    this.loadingZone = true;
    useGame.setState({ loading: true, loadingText: `Вход в локацию: ${ZONE_NAMES[id]}...` });
    await new Promise((r) => setTimeout(r, 60));
    if (!first) { this.clearEntities(); this.world.dispose(); }
    this.world = new World(id, this.scene);
    const zone = ZONES[id];
    const sp = x !== undefined ? { x, z: z ?? 0 } : SPAWN[id];
    // игрок
    if (!first) { this.scene.remove(this.player.model.group); this.player.label.el.remove(); }
    const model = this.buildPlayerModel();
    this.scene.add(model.group);
    const label = this.makeLabel(this.info.name, CLS_COLOR[this.info.cls], undefined, false);
    label.el.classList.add("np-self");
    this.player = { model, pos: new THREE.Vector3(sp.x, this.world.groundY(sp.x, sp.z), sp.z), vy: 0, face: first ? 0 : Math.atan2(-sp.x, -sp.z), grounded: true, speed: 0, lock: 0, moveDir: new THREE.Vector3(), label };
    if (!first) this.camYaw = this.player.face + Math.PI;
    this.camSmooth.copy(this.player.pos);
    // NPC
    for (const n of Object.values(NPCS)) if (n.zone === id) this.spawnNpc(n);
    // мобы
    let mi = 0;
    for (const s of zone.mobs) for (let i = 0; i < s.n; i++) this.spawnMob(MOBS[s.mob], s.x, s.z, s.r, s.lvl, `${id}${mi++}`);
    // живность
    for (const w of zone.wild) for (let i = 0; i < w.n; i++) this.spawnWild(w.model, w.x, w.z, w.r, w.scale, w.tint);
    if (this.info.cls === "tamer") this.spawnPet();
    this.buildMinimap();
    useGame.setState({ zone: id, target: null, dialog: null, shop: null });
    this.target = null; this.targetKind = null;
    this.lastChatId = 0;
    this.sync();
    await new Promise((r) => setTimeout(r, 120));
    useGame.setState({ loading: false });
    useGame.getState().addChat({ channel: "system", text: `Вы вошли в локацию «${ZONE_NAMES[id]}» (уровни ${zone.levels}).` });
    this.loadingZone = false;
    if (!first) this.saveNow();
  }

  travel(to: ZoneId, tx: number, tz: number) {
    if (this.loadingZone) return;
    const st = useGame.getState();
    st.mutate((ps) => { ps.zone = to; ps.x = tx; ps.z = tz; });
    this.loadZone(to, tx, tz);
  }

  spawnNpc(def: NpcDef) {
    const app: Appearance = {
      skin: "#f1bf98", hair: 0, hairColor: "#3a2418", eyeColor: "#2b7de0", eyeStyle: 0, brow: 1, ears: 0, tail: 0, mark: 0, markColor: "#ff4d4d",
      height: 0.5, build: 0.5, bust: 0.5, headSize: 0.5, eyeSize: 0.55, accent: "#c0392b", ...def.look,
    };
    const model = new CharacterModel({ cls: def.cls, gender: def.gender, app, armorTier: def.tier ?? 1, weaponTier: def.tier ?? 1, head: !!def.helm, helm: !!def.helm, weapon: !!def.helm });
    const pos = new THREE.Vector3(def.x, this.world.groundY(def.x, def.z), def.z);
    model.group.position.copy(pos); model.group.rotation.y = def.ry;
    this.scene.add(model.group);
    const label = this.makeLabel(def.name, "#8fe0ff", undefined, false);
    label.name.innerHTML += `<span class="np-title">${def.title}</span>`;
    this.npcs.push({ def, model, pos, home: pos.clone(), label, wanderT: Math.random() * 5, wander: null, face: def.ry, barkT: 8 + Math.random() * 20, mk: "", moving: 0 });
  }

  spawnMob(def: MobDef, cx: number, cz: number, r: number, lvl: [number, number], id: string) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
    let x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    for (let i = 0; i < 12 && (!this.world.walkable(x, z) || this.world.inWater(x, z)); i++) { const b = Math.random() * 6.28, q = Math.sqrt(Math.random()) * r; x = cx + Math.cos(b) * q; z = cz + Math.sin(b) * q; }
    const L = lvl[0] + Math.floor(Math.random() * (lvl[1] - lvl[0] + 1));
    const cr = buildCreature(def);
    const pos = new THREE.Vector3(x, this.world.groundY(x, z), z);
    cr.group.position.copy(pos);
    this.scene.add(cr.group);
    const label = this.makeLabel(def.name, def.boss ? "#ff9a3a" : "#ffffff", L, true);
    label.el.classList.add("np-mob"); if (def.boss) label.el.classList.add("np-boss");
    const maxHp = Math.round(mobHp(L) * (def.hpMul ?? 1));
    this.mobs.push({
      id, def, lvl: L, hp: maxHp, maxHp, cr, pos, home: pos.clone(), spawnR: Math.max(6, r), state: "idle", face: Math.random() * 6.28, atkT: 1, stun: 0, slow: 0,
      wanderT: Math.random() * 4, wander: null, dots: [], respawnAt: 0, label, slamT: 6, slamAt: 0, dmg: mobDmg(L) * (def.dmgMul ?? 1),
      range: def.ranged ?? 2.0 + cr.radius * 0.9, hidden: false, speedN: 0, lvlRange: lvl,
    });
  }

  spawnWild(model: string, cx: number, cz: number, r: number, scale: number, tint?: string) {
    const def = { id: model, name: model, model, scale, speed: 3, aggro: 0, drops: [], tint } as MobDef;
    const cr = buildCreature(def);
    let x = cx, z = cz;
    for (let i = 0; i < 15; i++) { const a = Math.random() * 6.28, q = Math.sqrt(Math.random()) * r; x = cx + Math.cos(a) * q; z = cz + Math.sin(a) * q; if (this.world.walkable(x, z) && !this.world.inWater(x, z)) break; }
    const pos = new THREE.Vector3(x, this.world.groundY(x, z), z);
    cr.group.position.copy(pos); this.scene.add(cr.group);
    this.wilds.push({ cr, pos, home: new THREE.Vector3(cx, 0, cz), r, tgt: null, t: Math.random() * 5, face: Math.random() * 6, flee: false, speed: model === "deer" ? 4.5 : 3 });
  }

  spawnPet() {
    const cr = buildCreature({ id: "pet", name: "Спутник", model: "fox", scale: 1.0, speed: 6, aggro: 0, drops: [] });
    const pos = this.player.pos.clone().add(new THREE.Vector3(2, 0, 2));
    cr.group.position.copy(pos); this.scene.add(cr.group);
    this.pet = { cr, pos, until: Infinity, atkT: 0, power: 0, ranged: false, color: "#e8802a", face: 0 };
  }

  buildMinimap() {
    const z = this.world.zone;
    const N = 180, c = document.createElement("canvas"); c.width = N; c.height = N;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N) * 200 - 100, zz = (j / N) * 200 - 100;
      const h = z.height(x, zz);
      let r = 90, g = 130, b = 70;
      if (z.id === "desert") { r = 215; g = 185; b = 120; } else if (z.id === "forest") { r = 50; g = 100; b = 60; } else if (z.id === "crypt") { r = 60; g = 62; b = 70; }
      const sh = clamp(0.8 + h * 0.03, 0.5, 1.4);
      r *= sh; g *= sh; b *= sh;
      if (h < z.waterLevel - 0.3 && z.id !== "crypt") { r = 60; g = 130; b = 190; }
      else if (this.world.pathDist(x, zz) < 2) { r = 190; g = 160; b = 110; }
      else if (h > 12) { r = 120; g = 118; b = 112; }
      const k = (j * N + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    bridge.minimap = c;
  }

  minimapData() {
    if (!this.player) return null;
    return {
      px: this.player.pos.x, pz: this.player.pos.z, yaw: this.camYaw,
      mobs: this.mobs.filter((m) => m.state !== "dead").map((m) => [m.pos.x, m.pos.z, !!m.def.boss] as [number, number, boolean]),
      npcs: this.npcs.map((n) => [n.pos.x, n.pos.z, n.mk] as [number, number, string]),
      portals: this.world.portals.map((p) => [p.x, p.z] as [number, number]),
      players: [...this.remotes.values()].map((r) => [r.pos.x, r.pos.z] as [number, number]),
    };
  }

  // ======================= ГЛАВНЫЙ ЦИКЛ =======================
  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (this.loadingZone) { this.composer.render(); return; }
    this.update(dt);
    this.composer.render();
  };

  update(dt: number) {
    const st = useGame.getState();
    this.updatePlayer(dt, st);
    this.updateMobs(dt);
    this.updateNpcs(dt);
    this.updateRemotes(dt);
    this.updateWilds(dt);
    this.updateMinions(dt);
    this.world.update(this.t, dt, this.player.pos);
    this.vfx.update(dt);
    this.updateCamera(dt);
    // отложенные события
    const now = performance.now();
    for (let i = this.later.length - 1; i >= 0; i--) if (this.later[i].at <= now) { const f = this.later[i].fn; this.later.splice(i, 1); f(); }
    for (let i = this.slams.length - 1; i >= 0; i--) {
      const s = this.slams[i];
      if (s.at <= now) {
        this.slams.splice(i, 1);
        this.vfx.quake(s.pos, s.r, "#ff8040");
        if (dist2(this.player.pos, s.pos) < s.r && !this.dead) this.hurt(s.dmg, s.mob.def.name, s.mob.lvl);
      }
    }
    // таймеры
    this.regenT += dt;
    if (this.regenT >= 0.5) { this.regen(this.regenT); this.regenT = 0; this.expireBuffs(); }
    this.markerT -= dt; if (this.markerT <= 0) { this.markerT = 0.7; this.updateMarkers(st.ps); }
    this.reachT -= dt;
    if (this.reachT <= 0) {
      this.reachT = 1;
      const upd = (() => { let r: string[] = []; st.mutate((ps) => { r = questOnReach(ps, this.world.zone.id, this.player.pos.x, this.player.pos.z); }); return r; })();
      void upd;
    }
    this.autoAttackTick(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      const cur = useGame.getState();
      if (Math.abs(cur.hp - this.hp) > 0.4 || Math.abs(cur.mp - this.mp) > 0.4 || cur.shield !== Math.round(this.shield)) useGame.setState({ hp: this.hp, mp: this.mp, shield: Math.round(this.shield) });
      if (this.target && this.targetKind === "mob") this.syncTarget();
      this.updateInteractPrompt();
    }
    this.saveT += dt; if (this.saveT > 20) { this.saveT = 0; this.saveNow(); }
    this.syncT += dt; if (this.syncT > 1.2) { this.syncT = 0; this.sync(); }
    this.updateLabels();
    // респаун сборных узлов обрабатывается в мире (по времени t)
  }

  // ======================= ИГРОК =======================
  updatePlayer(dt: number, st: ReturnType<typeof useGame.getState>) {
    const p = this.player;
    const d = st.derived;
    const now = performance.now();
    let mx = 0, mz = 0;
    if (!this.dead && now > p.lock) {
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz -= 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    }
    const moving = mx !== 0 || mz !== 0;
    let speed = 0;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
      const rx = -fz, rz = fx;
      const dx = fx * mz - rx * mx * -1, dz = fz * mz - rz * mx * -1;
      const dir = tv.set(fx * mz + -rx * mx, 0, fz * mz + -rz * mx);
      void dx; void dz;
      dir.normalize();
      const wet = this.world.inWater(p.pos.x, p.pos.z);
      speed = 6.6 * d.speed * (wet ? 0.6 : 1) * (this.hasSlow() ? 0.6 : 1);
      this.stepMove(p.pos, dir.x * speed * dt, dir.z * speed * dt);
      const tf = Math.atan2(dir.x, dir.z);
      p.face += angDiff(p.face, tf) * Math.min(1, dt * 14);
      p.model.loop = undefined;
      if (this.rmb) p.face += angDiff(p.face, tf) * 0.0;
    }
    p.speed = speed;
    // вертикаль
    const gy = this.world.groundY(p.pos.x, p.pos.z);
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= gy) { p.pos.y = gy; p.vy = 0; p.grounded = true; } else if (p.pos.y > gy + 0.15) p.grounded = false;
    p.model.group.position.copy(p.pos);
    p.model.group.rotation.y = p.face;
    p.model.setSpeed(this.dead ? 0 : p.grounded ? clamp(speed / 6.6, 0, 1.2) : 0.5);
    if (!moving && !this.dead) p.model.loop = (p.loop as never) ?? undefined; else if (moving) p.loop = undefined;
    p.model.update(dt);
    if (moving && this.world.inWater(p.pos.x, p.pos.z) && Math.random() < dt * 8) this.vfx.impact(tv.set(p.pos.x, p.pos.y + 0.1, p.pos.z).clone(), "#cfefff", 3, 0.4);
    // порталы
    for (const po of this.world.portals) if (Math.hypot(po.x - p.pos.x, po.z - p.pos.z) < 3.3 && !this.dead) { this.travel(po.to, po.tx, po.tz); break; }
  }

  hasSlow() { return false; }

  stepMove(pos: THREE.Vector3, dx: number, dz: number, rad = 0.4) {
    const w = this.world;
    const ok = (x: number, z: number) => {
      if (!w.walkable(x, z)) return false;
      const step = Math.hypot(x - pos.x, z - pos.z) || 0.001;
      const climb = w.groundY(x, z) - w.groundY(pos.x, pos.z);
      return !(climb / step > 1.7 && pos.y <= w.groundY(pos.x, pos.z) + 0.3);
    };
    void rad;
    if (ok(pos.x + dx, pos.z + dz)) { pos.x += dx; pos.z += dz; }
    else if (ok(pos.x + dx, pos.z)) pos.x += dx;
    else if (ok(pos.x, pos.z + dz)) pos.z += dz;
  }

  updateCamera(dt: number) {
    const p = this.player;
    const target = tv.set(p.pos.x, p.pos.y + 1.55 * p.model.heightScale, p.pos.z);
    this.camSmooth.lerp(target, 1 - Math.exp(-dt * 12));
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dist = this.camDist;
    let cx = this.camSmooth.x + Math.sin(this.camYaw) * cp * dist, cz = this.camSmooth.z + Math.cos(this.camYaw) * cp * dist;
    let cy = this.camSmooth.y + sp * dist;
    const gy = this.world.groundY(cx, cz) + 0.6;
    if (cy < gy) cy = gy;
    const shk = Math.max(this.vfx.shake, this.shake) * 0.25;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.camera.position.set(cx + (Math.random() - 0.5) * shk, cy + (Math.random() - 0.5) * shk, cz + (Math.random() - 0.5) * shk);
    this.camera.lookAt(this.camSmooth.x, this.camSmooth.y + 0.2, this.camSmooth.z);
  }

  // ======================= МОБЫ =======================
  updateMobs(dt: number) {
    const now = performance.now();
    const p = this.player;
    for (const m of this.mobs) {
      const dp = dist2(m.pos, p.pos);
      if (m.state === "dead") {
        m.cr.tick(dt, 0, this.t);
        if (now > m.respawnAt) this.respawnMob(m);
        else if (now > m.respawnAt - (m.def.boss ? 118000 : 22000) + 3500) { m.cr.group.visible = false; m.hidden = true; }
        continue;
      }
      if (dp > 90 && m.state === "idle") { m.cr.group.visible = false; m.hidden = true; continue; }
      if (m.hidden) { m.hidden = false; m.cr.group.visible = true; }
      // DoT
      for (let i = m.dots.length - 1; i >= 0; i--) {
        const d = m.dots[i];
        if (now >= d.next) { d.next += 1000; this.hitMob(m, d.dmg, false, "#9dff5a", true); if ((m.state as string) === "dead") break; }
        if (now >= d.end) m.dots.splice(i, 1);
      }
      if ((m.state as string) === "dead") continue;
      const stunned = now < m.stun;
      let moveSpeed = 0;
      const sp = m.def.speed * (now < m.slow ? 0.5 : 1);
      if (m.state === "idle") {
        const aggroR = m.def.aggro;
        if (!this.dead && dp < aggroR && Math.abs(m.pos.y - p.pos.y) < 6 && !stunned) { m.state = "chase"; m.atkT = 0.6; }
        else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) { m.wanderT = 3 + Math.random() * 5; if (Math.random() < 0.7) { const a = Math.random() * 6.28, r = Math.random() * Math.min(7, m.spawnR); m.wander = new THREE.Vector3(m.home.x + Math.cos(a) * r, 0, m.home.z + Math.sin(a) * r); } else m.wander = null; }
          if (m.wander && !stunned) {
            const dd = dist2(m.pos, m.wander);
            if (dd > 0.6) { moveSpeed = sp * 0.35; this.moveEntity(m.pos, m.wander, moveSpeed * dt, m); } else m.wander = null;
          }
        }
      } else if (m.state === "chase") {
        const dh = dist2(m.pos, m.home);
        if (this.dead || dh > 55 || (dp > m.def.aggro * 3 && dh > 25)) m.state = "return";
        else if (!stunned) {
          const stopAt = m.range * 0.85;
          if (dp > stopAt) { moveSpeed = sp; this.moveEntity(m.pos, p.pos, sp * dt, m); }
          else { m.face += angDiff(m.face, Math.atan2(p.pos.x - m.pos.x, p.pos.z - m.pos.z)) * Math.min(1, dt * 10); }
          m.atkT -= dt;
          if (dp <= m.range && m.atkT <= 0) {
            m.atkT = m.def.atkSpeed ?? (m.def.boss ? 2.2 : 2.0);
            m.cr.attack();
            m.face = Math.atan2(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
            const dmg = m.dmg * (0.85 + Math.random() * 0.3);
            if (m.def.ranged) {
              const from = tv.set(m.pos.x, m.pos.y + m.cr.height * 0.7, m.pos.z).clone();
              this.vfx.projectile(from, () => tv2.set(p.pos.x, p.pos.y + 1.2, p.pos.z).clone(), m.def.projectile ?? "#ffffff", "bolt", 16, () => { if (!this.dead) this.hurt(dmg, m.def.name, m.lvl); });
            } else this.later.push({ at: now + 350, fn: () => { if (m.state !== "dead" && dist2(m.pos, p.pos) < m.range + 1.2 && !this.dead) this.hurt(dmg, m.def.name, m.lvl); } });
          }
          if (m.def.boss) {
            m.slamT -= dt;
            if (m.slamT <= 0 && dp < 14) {
              m.slamT = 8 + Math.random() * 3;
              const sp2 = p.pos.clone(); const r = 6 + m.def.scale;
              this.vfx.telegraph(sp2, r, 1.5);
              this.slams.push({ at: now + 1500, mob: m, pos: sp2, r, dmg: m.dmg * 2.0 });
              this.chat("combat", `${m.def.name} готовит мощный удар!`);
            }
          }
        }
      } else if (m.state === "return") {
        moveSpeed = sp * 1.6;
        this.moveEntity(m.pos, m.home, moveSpeed * dt, m);
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.2);
        if (dist2(m.pos, m.home) < 1.2) { m.state = "idle"; m.hp = m.maxHp; }
        if (!this.dead && dp < m.def.aggro * 0.6 && dist2(m.pos, m.home) < 20) m.state = "chase";
      }
      m.pos.y = this.world.groundY(m.pos.x, m.pos.z);
      m.cr.group.position.copy(m.pos);
      m.cr.group.rotation.y = m.face;
      m.speedN += (moveSpeed / 6 - m.speedN) * Math.min(1, dt * 8);
      m.cr.tick(dt, m.speedN, this.t);
    }
  }

  moveEntity(pos: THREE.Vector3, to: THREE.Vector3, step: number, m?: { face: number }) {
    const dx = to.x - pos.x, dz = to.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (m) m.face += angDiff(m.face, Math.atan2(dx, dz)) * 0.25;
    const nx = pos.x + (dx / d) * Math.min(step, d), nz = pos.z + (dz / d) * Math.min(step, d);
    if (this.world.walkable(nx, nz) && !this.world.inWater(nx, nz)) { pos.x = nx; pos.z = nz; }
    else if (this.world.walkable(nx, pos.z)) pos.x = nx;
    else if (this.world.walkable(pos.x, nz)) pos.z = nz;
  }

  respawnMob(m: Mob) {
    m.lvl = m.lvlRange[0] + Math.floor(Math.random() * (m.lvlRange[1] - m.lvlRange[0] + 1));
    m.maxHp = Math.round(mobHp(m.lvl) * (m.def.hpMul ?? 1)); m.hp = m.maxHp; m.dmg = mobDmg(m.lvl) * (m.def.dmgMul ?? 1);
    m.state = "idle"; m.dots = []; m.stun = 0; m.slow = 0; m.hidden = false;
    m.pos.copy(m.home); m.cr.group.visible = true; m.cr.setDead(false);
    m.label.el.style.display = "";
    (m.label.name.querySelector(".np-lv") as HTMLElement | null)!.textContent = String(m.lvl);
    if (m.def.boss) this.chat("system", `${m.def.name} возродился!`);
  }

  // ======================= БОЙ =======================
  hitMob(m: Mob, amt: number, crit: boolean, color = "#ffffff", dot = false) {
    if (m.state === "dead") return;
    amt = Math.max(1, Math.round(amt));
    m.hp -= amt;
    this.lastCombat = this.t;
    if (m.state === "idle" || m.state === "return") { m.state = "chase"; m.atkT = 0.8; }
    this.floatText(tv.set(m.pos.x, m.pos.y + m.cr.height + 0.3, m.pos.z), String(amt), crit ? "crit" : dot ? "dot" : "dmg");
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m: Mob) {
    m.state = "dead"; m.hp = 0;
    m.respawnAt = performance.now() + (m.def.boss ? 120000 : 25000);
    m.cr.setDead(true);
    m.label.el.style.display = "none";
    const st = useGame.getState();
    const lvl = st.ps.level;
    const diff = m.lvl - lvl;
    const xp = Math.max(1, Math.round(mobXp(m.lvl) * (m.def.xpMul ?? 1) * clamp(1 + diff * 0.12, 0.1, 1.5)));
    const gold = Math.round(mobGold(m.lvl) * (0.6 + Math.random() * 0.8) * (m.def.boss ? 8 : 1));
    const lv = st.gainReward(xp, gold);
    this.chat("combat", `Вы победили: ${m.def.name} (ур. ${m.lvl}). Опыт +${xp}, золото +${gold}.`);
    this.floatText(tv.set(m.pos.x, m.pos.y + m.cr.height + 1.0, m.pos.z), `+${xp} XP`, "xp");
    // добыча
    const drops: string[] = [];
    for (const [id, ch] of m.def.drops) {
      if (Math.random() < ch * (m.def.boss ? 1 : 1)) {
        const it = ITEMS[id];
        if (it && it.kind === "quest" && !questNeedsItem(useGame.getState().ps, id)) continue;
        drops.push(id);
      }
    }
    const gearChance = m.def.boss ? 1 : 0.07;
    if (Math.random() < gearChance) { const g = rollGearDrop(this.info.cls, m.lvl, !!m.def.boss); if (g) drops.push(g); }
    if (drops.length) {
      st.mutate((ps) => { for (const id of drops) if (!addItem(ps, id, 1)) st.toast("Инвентарь полон!", "bad"); });
      drops.forEach((id) => { const it = ITEMS[id]; this.chat("loot", `Добыча: ${it.name}`); st.toast(`${it.icon} ${it.name}`, "good"); });
    }
    st.onKill(m.def.id);
    if (lv > 0) this.onLevelUp();
    if (this.target === m) { this.setTarget(null); }
    this.vfx.impact(tv.set(m.pos.x, m.pos.y + 0.8, m.pos.z).clone(), "#ffffff", 14, 1.4);
  }

  onLevelUp() {
    const st = useGame.getState();
    this.vfx.levelUp(this.player.pos.clone());
    const d = st.derived;
    this.hp = d.maxHp; this.mp = d.maxMp;
    st.toast(`Новый уровень: ${st.ps.level}!  Очки навыков и характеристик получены.`, "level");
    this.chat("system", `Поздравляем! Вы достигли ${st.ps.level} уровня.`);
    this.saveNow();
  }

  hurt(raw: number, from: string, lvl: number) {
    if (this.dead) return;
    const st = useGame.getState();
    const d = st.derived;
    this.lastCombat = this.t;
    if (Math.random() * 100 < d.dodge) { this.floatText(tv.set(this.player.pos.x, this.player.pos.y + 2.2, this.player.pos.z), "Уклонение", "miss"); return; }
    let dmg = Math.max(1, Math.round(raw * (1 - mitigation(d.def, lvl))));
    if (this.shield > 0) { const ab = Math.min(this.shield, dmg); this.shield -= ab; dmg -= ab; }
    if (dmg > 0) {
      this.hp -= dmg;
      this.floatText(tv.set(this.player.pos.x, this.player.pos.y + 2.2, this.player.pos.z), String(dmg), "hurt");
      if (!this.player.model.acting) this.player.model.play("hit", 0.35);
      this.chat("combat", `${from} наносит вам ${dmg} урона.`);
    } else this.floatText(tv.set(this.player.pos.x, this.player.pos.y + 2.2, this.player.pos.z), "Поглощено", "miss");
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0; this.dead = true;
    this.player.model.setDead(true);
    useGame.setState({ dead: true, autoAttack: false, hp: 0 });
    this.chat("system", "Вы погибли. Нажмите «Возродиться».");
    this.setTarget(null);
  }

  respawn() {
    if (!this.dead) return;
    const st = useGame.getState();
    this.dead = false; this.player.model.setDead(false);
    const sp = SPAWN[this.world.zone.id];
    const pos = this.world.zone.id === "crypt" ? { x: 0, z: 76 } : sp;
    this.player.pos.set(pos.x, this.world.groundY(pos.x, pos.z), pos.z);
    this.hp = st.derived.maxHp * 0.6; this.mp = st.derived.maxMp * 0.5;
    useGame.setState({ dead: false, hp: this.hp, mp: this.mp });
    this.vfx.heal(this.player.pos.clone(), "#fff0a0");
    for (const m of this.mobs) if (m.state === "chase") m.state = "return";
  }

  restore(hp: number, mp: number) {
    const d = useGame.getState().derived;
    if (hp) { this.hp = Math.min(d.maxHp, this.hp + hp); this.floatText(tv.set(this.player.pos.x, this.player.pos.y + 2.2, this.player.pos.z), `+${hp}`, "heal"); }
    if (mp) { this.mp = Math.min(d.maxMp, this.mp + mp); this.floatText(tv.set(this.player.pos.x + 0.3, this.player.pos.y + 2.0, this.player.pos.z), `+${mp}`, "mana"); }
    this.vfx.heal(this.player.pos.clone(), hp ? "#7dff7a" : "#7fb8ff");
  }

  regen(dt: number) {
    if (this.dead) return;
    const d = useGame.getState().derived;
    const inCombat = this.t - this.lastCombat < 6;
    this.hp = Math.min(d.maxHp, this.hp + d.maxHp * (inCombat ? d.regen : 0.012 + d.regen * 2) * dt);
    this.mp = Math.min(d.maxMp, this.mp + d.mpRegen * (inCombat ? 1 : 2.5) * dt);
    if (this.shield > 0 && performance.now() > this.shieldEnd) this.shield = 0;
  }

  expireBuffs() {
    const st = useGame.getState();
    const now = performance.now();
    if (st.buffs.some((b) => b.end < now)) { useGame.setState({ buffs: st.buffs.filter((b) => b.end >= now) }); useGame.getState().recalc(); }
  }

  autoAttackTick(dt: number) {
    this.autoT -= dt;
    const st = useGame.getState();
    if (!st.autoAttack || this.dead || this.autoT > 0) return;
    if (!this.target || this.targetKind !== "mob" || (this.target as Mob).state === "dead") return;
    this.useSkill("basic", true);
  }

  useHotbar(i: number) {
    const id = useGame.getState().ps.hotbar[i];
    if (!id) return;
    if (id.startsWith("item:")) useGame.getState().useItem(id.slice(5));
    else this.useSkill(id);
  }

  say(text: string, kind: "bad" | "info" = "bad") { useGame.getState().toast(text, kind); }

  useSkill(id: string, auto = false): boolean {
    const st = useGame.getState();
    if (this.dead || this.loadingZone) return false;
    const now = performance.now();
    const cls = CLASSES[this.info.cls];
    const isBasic = id === "basic";
    const skill: SkillDef | null = isBasic ? null : SKILLS[id];
    const rank = isBasic ? 1 : st.ps.skills[id] ?? 0;
    if (!isBasic && (!skill || skill.type !== "active" || rank < 1)) return false;
    const d = st.derived;
    const haste = 1 / (1 + d.haste);
    if ((st.cooldowns[id] ?? 0) > now) { if (!auto) this.say("Способность ещё не готова"); return false; }
    if (!isBasic && st.gcdEnd > now) return false;
    const mpCost = isBasic ? 0 : Math.round(skill!.mp * (1 + 0.05 * (rank - 1)));
    if (this.mp < mpCost) { if (!auto) this.say("Недостаточно маны"); return false; }
    const kind = isBasic ? "tgt" : skill!.kind!;
    const range = isBasic ? cls.basic.range : skill!.range;
    const needsTarget = kind === "tgt" || kind === "dash";
    let mob: Mob | null = this.targetKind === "mob" ? (this.target as Mob) : null;
    if (mob && mob.state === "dead") mob = null;
    if (needsTarget && !mob) {
      // авто-выбор ближайшей цели
      const c = this.mobs.filter((m) => m.state !== "dead" && !m.hidden && dist2(m.pos, this.player.pos) < Math.max(range, 8)).sort((a, b) => dist2(a.pos, this.player.pos) - dist2(b.pos, this.player.pos))[0];
      if (c) { this.setTarget(c); mob = c; } else { if (!auto) this.say("Нет цели — нажмите Tab или кликните по монстру"); return false; }
    }
    const p = this.player;
    if (needsTarget && mob) {
      const dd = dist2(mob.pos, p.pos) - mob.cr.radius * 0.5;
      if (dd > range) { if (!auto) this.say("Цель слишком далеко"); return false; }
      p.face = Math.atan2(mob.pos.x - p.pos.x, mob.pos.z - p.pos.z);
    }
    // --- платим ---
    this.mp -= mpCost;
    const cd = isBasic ? cls.basic.speed * haste : skill!.cd * haste;
    const cooldowns = { ...st.cooldowns, [id]: now + cd * 1000 };
    if (isBasic) this.autoT = cd; else useGame.setState({ gcdEnd: now + 900 * haste });
    useGame.setState({ cooldowns });
    if (isBasic) useGame.setState({ autoAttack: true });
    this.lastCombat = this.t;
    p.lock = now + 250;
    // --- анимация ---
    const style = cls.style;
    const color = isBasic ? ({ steel: "#e3ecff", ice: "#7fd8ff", dark: "#b25dff", blood: "#ff3050", nature: "#6dff9c" }[cls.basic.color] ?? "#fff") : skill!.color;
    const vfxKind = isBasic ? cls.basic.vfx : skill!.vfx;
    let anim: ActionKind = style === "slash" ? "slash" : style === "stab" ? "stab" : style === "cast" ? "cast" : style === "shoot" ? "shoot" : style === "bash" ? "bash" : "whip";
    let dur = isBasic ? 0.55 : 0.7;
    if (kind === "aoe" && ["slash", "stab", "bash", "whip"].includes(style)) { anim = "spin"; dur = 0.8; }
    else if (kind === "aoet" && !["cast", "shoot"].includes(style)) { anim = "leap"; dur = 0.8; }
    else if (kind === "aoet") { anim = style === "shoot" ? "shoot" : "cast"; dur = 0.9; }
    else if (kind === "dash") { anim = "leap"; dur = 0.6; }
    else if (kind === "heal" || kind === "shield") { anim = "heal"; dur = 0.9; }
    else if (kind === "buff") { anim = "buff"; dur = 0.9; }
    else if (kind === "summon") { anim = "cast"; dur = 0.9; }
    p.model.play(anim, dur);
    const hand = () => tv.set(p.pos.x + Math.sin(p.face) * 0.6, p.pos.y + 1.3, p.pos.z + Math.cos(p.face) * 0.6).clone();
    const chest = (m: Mob) => tv.set(m.pos.x, m.pos.y + m.cr.height * 0.55, m.pos.z).clone();
    const power = isBasic ? 1.0 : skill!.power * skillRankMul(rank);

    // --- эффект навыка ---
    const strike = (m: Mob, mult: number, delayMs: number, extra?: (m: Mob) => void) => {
      this.later.push({ at: now + delayMs, fn: () => {
        if (m.state === "dead") return;
        this.dealSkill(m, power * mult, skill, rank, vfxKind, color, extra);
      } });
    };
    const applyCC = (m: Mob) => {
      if (!skill) return;
      if (skill.stun) m.stun = performance.now() + skill.stun * 1000;
      if (skill.slow) m.slow = performance.now() + Math.max(3, skill.dur) * 1000;
      if (skill.dot) {
        const total = d.atk * skill.dot * skillRankMul(rank);
        const ticks = Math.max(2, Math.round(skill.dur || 6));
        m.dots.push({ end: performance.now() + ticks * 1000, next: performance.now() + 1000, dmg: total / ticks });
      }
    };
    if (kind === "tgt" && mob) {
      const m = mob;
      const hits = isBasic ? 1 : skill!.hits;
      const projectile = vfxKind === "bolt" || vfxKind === "arrow";
      for (let i = 0; i < hits; i++) {
        if (projectile) {
          this.later.push({ at: now + 250 + i * 130, fn: () => {
            if (m.state === "dead") return;
            this.vfx.projectile(hand(), () => chest(m), color, vfxKind === "arrow" ? "arrow" : "bolt", 30, () => { this.dealSkill(m, power, skill, rank, "impact", color, i === hits - 1 ? applyCC : undefined, true); });
          } });
        } else if (vfxKind === "beam" || vfxKind === "whip") {
          this.later.push({ at: now + 250 + i * 130, fn: () => { if (m.state === "dead") return; this.vfx.beam(hand(), chest(m), color, 0.3); this.dealSkill(m, power, skill, rank, "none", color, i === hits - 1 ? applyCC : undefined); } });
        } else strike(m, 1, 280 + i * 120, i === hits - 1 ? applyCC : undefined);
      }
    } else if (kind === "dash" && mob) {
      const m = mob;
      const from = p.pos.clone();
      const dirx = m.pos.x - from.x, dirz = m.pos.z - from.z; const dl = Math.hypot(dirx, dirz) || 1;
      const to = new THREE.Vector3(m.pos.x - (dirx / dl) * (m.cr.radius * 0.6 + 1.4), 0, m.pos.z - (dirz / dl) * (m.cr.radius * 0.6 + 1.4));
      const t0 = performance.now();
      const stepDash = () => {
        const u = clamp((performance.now() - t0) / 220, 0, 1);
        const x = from.x + (to.x - from.x) * u, zz = from.z + (to.z - from.z) * u;
        if (this.world.walkable(x, zz)) { p.pos.x = x; p.pos.z = zz; }
        if (u < 1 && !this.disposed) requestAnimationFrame(stepDash);
      };
      stepDash();
      this.vfx.impact(from.clone().setY(from.y + 1), color, 10, 1);
      strike(m, 1, 260, applyCC);
    } else if (kind === "aoe") {
      const r = skill!.radius;
      if (vfxKind === "whirl") this.vfx.whirl(p.pos.clone(), r, color); else if (vfxKind === "quake") this.later.push({ at: now + 300, fn: () => this.vfx.quake(p.pos.clone(), r, color) }); else this.later.push({ at: now + 300, fn: () => this.vfx.nova(p.pos.clone(), r, color) });
      this.later.push({ at: now + 380, fn: () => this.areaDamage(p.pos.clone(), r, power, skill, rank, color, applyCC) });
    } else if (kind === "aoet") {
      const r = skill!.radius;
      const center = mob ? mob.pos.clone() : p.pos.clone().add(new THREE.Vector3(Math.sin(p.face) * 7, 0, Math.cos(p.face) * 7));
      if (mob) { const dd = dist2(mob.pos, p.pos); if (dd > skill!.range + 6) { /* слишком далеко: бьём по ближней точке */ } }
      const casterRange = ["rain", "pillar", "nova"].includes(vfxKind);
      if (casterRange) {
        if (vfxKind === "rain") this.vfx.rain(center, r, color, cls.id === "archer" ? "arrow" : "meteor", () => this.areaDamage(center, r, power, skill, rank, color, applyCC));
        else if (vfxKind === "pillar") { this.later.push({ at: now + 350, fn: () => { this.vfx.pillar(center, r * 0.5, color); this.areaDamage(center, r, power, skill, rank, color, applyCC); } }); }
        else this.later.push({ at: now + 350, fn: () => { this.vfx.nova(center, r, color); this.areaDamage(center, r, power, skill, rank, color, applyCC); } });
      } else {
        // ближний aoet: рывок/прыжок на цель
        const from = p.pos.clone();
        const t0 = performance.now();
        const stepJ = () => {
          const u = clamp((performance.now() - t0) / 380, 0, 1);
          const x = from.x + (center.x - from.x) * u * 0.85, zz = from.z + (center.z - from.z) * u * 0.85;
          if (this.world.walkable(x, zz)) { p.pos.x = x; p.pos.z = zz; }
          p.pos.y = Math.max(p.pos.y, this.world.groundY(p.pos.x, p.pos.z)) + (u < 1 ? Math.sin(u * Math.PI) * 0.15 : 0);
          if (u < 1 && !this.disposed) requestAnimationFrame(stepJ);
        };
        if (mob && dist2(mob.pos, p.pos) > 3) stepJ();
        this.later.push({ at: now + 430, fn: () => { if (vfxKind === "pillar") this.vfx.pillar(center, r * 0.5, color); else this.vfx.quake(center, r, color); this.areaDamage(center, r, power, skill, rank, color, applyCC); } });
      }
    } else if (kind === "heal") {
      const amt = d.maxHp * skill!.heal * skillRankMul(rank);
      this.later.push({ at: now + 250, fn: () => { this.restore(Math.round(amt), 0); this.vfx.heal(p.pos.clone(), color); } });
    } else if (kind === "shield") {
      const amt = Math.round(d.maxHp * skill!.shield * skillRankMul(rank));
      this.later.push({ at: now + 250, fn: () => { this.shield = amt; this.shieldEnd = performance.now() + 15000; this.vfx.shield(p.pos.clone(), color); if (skill!.heal) this.restore(Math.round(d.maxHp * skill!.heal), 0); } });
    } else if (kind === "buff") {
      const dur = skill!.dur;
      this.later.push({ at: now + 250, fn: () => {
        this.vfx.buff(p.pos.clone(), color);
        const cur = useGame.getState().buffs.filter((b) => b.id !== id);
        const bf = { ...skill!.buff } as NonNullable<SkillDef["buff"]>;
        useGame.setState({ buffs: [...cur, { id, name: skill!.name, icon: skill!.icon, end: performance.now() + dur * 1000, buff: bf, color }] });
        useGame.getState().recalc();
        this.chat("combat", `Вы получили эффект: ${skill!.name}.`);
      } });
    } else if (kind === "summon") {
      this.later.push({ at: now + 300, fn: () => this.summon(id, skill!, rank, color) });
    }
    return true;
  }

  dealSkill(m: Mob, power: number, skill: SkillDef | null, rank: number, vfxKind: string, color: string, extra?: (m: Mob) => void, projectileLanded = false) {
    const st = useGame.getState();
    const d = st.derived;
    let amt = d.atk * power * (0.9 + Math.random() * 0.2) * clamp(1 + (st.ps.level - m.lvl) * 0.025, 0.55, 1.3);
    const crit = Math.random() * 100 < d.crit;
    if (crit) amt *= d.critDmg / 100;
    if (power > 0) this.hitMob(m, amt, crit, color);
    const leech = d.leech + (skill?.leech ?? 0);
    if (leech > 0 && power > 0) { this.hp = Math.min(d.maxHp, this.hp + amt * leech); }
    const pos = tv.set(m.pos.x, m.pos.y + m.cr.height * 0.55, m.pos.z).clone();
    if (!projectileLanded) {
      if (vfxKind === "slash" || vfxKind === "cleave") this.vfx.slash(pos, this.player.face, color, vfxKind === "cleave" ? 2 : 1.5);
      else if (vfxKind === "stab") this.vfx.slash(pos, this.player.face + 0.5, color, 1.0, 0.5);
      else if (vfxKind === "bash") { this.vfx.impact(pos, color, 12, 1.2); this.vfx.ring(m.pos, 1.8, color, 0.4); this.shake = 0.3; }
      else if (vfxKind !== "none") this.vfx.impact(pos, color, 8, 1);
    } else this.vfx.impact(pos, color, 8, 1);
    extra?.(m);
  }

  areaDamage(center: THREE.Vector3, r: number, power: number, skill: SkillDef | null, rank: number, color: string, cc?: (m: Mob) => void) {
    let n = 0;
    for (const m of this.mobs) {
      if (m.state === "dead" || m.hidden) continue;
      if (dist2(m.pos, center) - m.cr.radius * 0.5 <= r) {
        n++;
        if (power > 0) this.dealSkill(m, power, skill, rank, "none", color, cc); else cc?.(m);
        this.vfx.impact(tv.set(m.pos.x, m.pos.y + m.cr.height * 0.5, m.pos.z).clone(), color, 6, 0.8);
      }
    }
    void n;
  }

  summon(id: string, skill: SkillDef, rank: number, color: string) {
    const cfg = SUMMONS[id];
    if (!cfg) return;
    this.minions = this.minions.filter((mn) => { if ((mn as Minion & { sid?: string }).sid === id) { mn.cr.group.removeFromParent(); return false; } return true; });
    const d = useGame.getState().derived;
    for (let i = 0; i < cfg.count; i++) {
      const def = { id: "minion", name: "Спутник", model: cfg.model, scale: cfg.scale, speed: 6, aggro: 0, drops: [], tint: cfg.tint } as MobDef;
      const cr = buildCreature(def);
      const a = (i / cfg.count) * 6.28 + this.player.face;
      const pos = this.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 2.2, 0, Math.cos(a) * 2.2));
      cr.group.position.copy(pos); this.scene.add(cr.group);
      this.vfx.summon(pos, color);
      const mn: Minion & { sid?: string } = { cr, pos, until: performance.now() + skill.dur * 1000, atkT: 0.5 + i * 0.3, power: d.atk * skill.power * skillRankMul(rank) * 0.55, ranged: !!cfg.ranged, color, face: 0 };
      mn.sid = id;
      this.minions.push(mn);
    }
    this.chat("combat", `${skill.name}: призыв на ${skill.dur} сек.`);
  }

  updateMinions(dt: number) {
    const now = performance.now();
    const p = this.player;
    const all = this.pet ? [this.pet, ...this.minions] : this.minions;
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const mn = this.minions[i];
      if (now > mn.until) { this.vfx.impact(tv.set(mn.pos.x, mn.pos.y + 0.8, mn.pos.z).clone(), mn.color, 10, 1); mn.cr.group.removeFromParent(); this.minions.splice(i, 1); }
    }
    for (const mn of all) {
      const isPet = mn === this.pet;
      let tgt: Mob | null = null;
      if (!isPet) {
        tgt = this.targetKind === "mob" && (this.target as Mob).state !== "dead" ? (this.target as Mob) : null;
        if (!tgt) tgt = this.mobs.find((m) => m.state === "chase" && dist2(m.pos, p.pos) < 18) ?? null;
      }
      let speedN = 0;
      if (tgt && dist2(mn.pos, tgt.pos) > 2.4 + tgt.cr.radius * 0.5 && !mn.ranged) { this.moveEntity(mn.pos, tgt.pos, 7.5 * dt, mn); speedN = 1.1; }
      else if (tgt && mn.ranged && dist2(mn.pos, tgt.pos) > 9) { this.moveEntity(mn.pos, tgt.pos, 6 * dt, mn); speedN = 1; }
      else if (!tgt || isPet) {
        const dd = dist2(mn.pos, p.pos);
        if (dd > 3.2) { this.moveEntity(mn.pos, p.pos, Math.min(9, 3 + dd) * dt, mn); speedN = Math.min(1.2, dd / 6); }
        if (dd > 35) { mn.pos.set(p.pos.x + 1.5, 0, p.pos.z + 1.5); }
      }
      if (tgt && !isPet) {
        mn.face = Math.atan2(tgt.pos.x - mn.pos.x, tgt.pos.z - mn.pos.z);
        mn.atkT -= dt;
        if (mn.atkT <= 0 && dist2(mn.pos, tgt.pos) < (mn.ranged ? 11 : 3.2 + tgt.cr.radius * 0.5)) {
          mn.atkT = 1.4; mn.cr.attack();
          const t = tgt; const dmg = mn.power * (0.8 + Math.random() * 0.4);
          if (mn.ranged) this.vfx.projectile(tv.set(mn.pos.x, mn.pos.y + 1.2, mn.pos.z).clone(), () => tv2.set(t.pos.x, t.pos.y + t.cr.height * 0.5, t.pos.z).clone(), mn.color, "bolt", 20, () => { if (t.state !== "dead") this.hitMob(t, dmg, false, mn.color); });
          else this.later.push({ at: now + 250, fn: () => { if (t.state !== "dead") { this.hitMob(t, dmg, false, mn.color); this.vfx.impact(tv.set(t.pos.x, t.pos.y + t.cr.height * 0.5, t.pos.z).clone(), mn.color, 6, 0.8); } } });
        }
      } else if (!tgt || isPet) mn.face += angDiff(mn.face, Math.atan2(p.pos.x - mn.pos.x, p.pos.z - mn.pos.z)) * Math.min(1, dt * 4) * (speedN > 0 ? 0 : 0.2);
      mn.pos.y = this.world.groundY(mn.pos.x, mn.pos.z);
      mn.cr.group.position.copy(mn.pos);
      mn.cr.group.rotation.y = mn.face;
      mn.cr.tick(dt, speedN, this.t);
    }
  }

  // ======================= NPC / ИГРОКИ / ЖИВНОСТЬ =======================
  updateNpcs(dt: number) {
    const p = this.player;
    for (const n of this.npcs) {
      const dp = dist2(n.pos, p.pos);
      n.model.group.visible = dp < 120; if (dp > 120) continue;
      let sp = 0;
      if (n.def.wander) {
        n.wanderT -= dt;
        if (n.wanderT <= 0) { n.wanderT = 3 + Math.random() * 6; n.wander = Math.random() < 0.65 ? new THREE.Vector3(n.home.x + (Math.random() - 0.5) * 2 * n.def.wander, 0, n.home.z + (Math.random() - 0.5) * 2 * n.def.wander) : null; }
        if (n.wander && dp > 5) { const dd = dist2(n.pos, n.wander); if (dd > 0.5) { this.moveEntity(n.pos, n.wander, 1.5 * dt, n); sp = 0.3; } else n.wander = null; }
      }
      if (dp < 6 && sp === 0) { n.face += angDiff(n.face, Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z)) * Math.min(1, dt * 3); n.model.loop = this.target === n ? "talk" : (n.def.id === "pip" || n.def.id === "lunamoth" ? "cheer" : n.mk === "!" ? "wave" : undefined); }
      else if (sp === 0 && dp >= 6) { n.face += angDiff(n.face, n.def.ry) * Math.min(1, dt * 1.5); n.model.loop = undefined; }
      else n.model.loop = undefined;
      n.model.setSpeed(sp);
      n.pos.y = this.world.groundY(n.pos.x, n.pos.z);
      n.model.group.position.copy(n.pos); n.model.group.rotation.y = n.face;
      n.model.update(dt);
      // реплики
      n.barkT -= dt;
      if (n.barkT <= 0) {
        n.barkT = 18 + Math.random() * 25;
        if (dp < 18) { n.label.bubble.textContent = n.def.lines[Math.floor(Math.random() * n.def.lines.length)]; n.label.bubble.classList.add("show"); setTimeout(() => n.label.bubble.classList.remove("show"), 4200); }
      }
    }
  }

  updateMarkers(ps: PlayerState) {
    for (const n of this.npcs) {
      let mk = "";
      for (const q of npcQuests(n.def.id)) {
        const qp = ps.quests[q.id];
        if (q.turnIn === n.def.id && qp?.state === "ready") { mk = "?"; break; }
        if (q.giver === n.def.id && !qp && questAvailable(ps, q) && ps.level >= q.level - 2) { mk = "!"; }
        else if (q.turnIn === n.def.id && qp?.state === "active" && !mk) mk = "…";
      }
      if (mk !== n.mk) { n.mk = mk; n.label.marker.textContent = mk; n.label.marker.className = `np-marker ${mk === "!" ? "avail" : mk === "?" ? "ready" : mk === "…" ? "prog" : ""}`; }
    }
  }

  updateRemotes(dt: number) {
    const now = performance.now();
    this.remotes.forEach((r, id) => {
      if (now - r.seen > 9000) { r.model.group.removeFromParent(); r.model.dispose(); r.label.el.remove(); this.remotes.delete(id); if (this.target === r) this.setTarget(null); return; }
      const dx = r.tpos.x - r.pos.x, dz = r.tpos.z - r.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 30) r.pos.copy(r.tpos); else { const k = Math.min(1, dt * 4); r.pos.x += dx * k; r.pos.z += dz * k; }
      r.face += angDiff(r.face, d > 0.3 ? Math.atan2(dx, dz) : r.tface) * Math.min(1, dt * 8);
      r.pos.y = this.world.groundY(r.pos.x, r.pos.z);
      r.model.setSpeed(d > 0.4 ? 1 : 0);
      r.model.group.position.copy(r.pos); r.model.group.rotation.y = r.face;
      r.model.update(dt);
    });
  }

  updateWilds(dt: number) {
    const p = this.player;
    for (const w of this.wilds) {
      const dp = dist2(w.pos, p.pos);
      w.cr.group.visible = dp < 100; if (dp > 100) continue;
      let sp = 0;
      if (dp < 7) { const a = Math.atan2(w.pos.x - p.pos.x, w.pos.z - p.pos.z); w.tgt = new THREE.Vector3(w.pos.x + Math.sin(a) * 8, 0, w.pos.z + Math.cos(a) * 8); w.flee = true; }
      else if (w.flee && dp > 12) { w.flee = false; w.tgt = null; }
      w.t -= dt;
      if (!w.flee && w.t <= 0) { w.t = 2 + Math.random() * 6; w.tgt = Math.random() < 0.6 ? new THREE.Vector3(w.pos.x + (Math.random() - 0.5) * 10, 0, w.pos.z + (Math.random() - 0.5) * 10) : null; }
      if (w.tgt) { const dd = dist2(w.pos, w.tgt); if (dd > 0.5) { const s = w.flee ? w.speed * 1.8 : w.speed * 0.4; this.moveEntity(w.pos, w.tgt, s * dt, w); sp = s / 5; } else w.tgt = null; }
      w.pos.y = this.world.groundY(w.pos.x, w.pos.z);
      w.cr.group.position.copy(w.pos); w.cr.group.rotation.y = w.face;
      w.cr.tick(dt, sp, this.t);
    }
  }

  // ======================= ВЗАИМОДЕЙСТВИЕ =======================
  nearest() {
    const p = this.player.pos;
    let best: { kind: "npc" | "node"; d: number; ref: Npc | GatherNode; label: string } | null = null;
    for (const n of this.npcs) { const d = dist2(n.pos, p); if (d < 5 && (!best || d < best.d)) best = { kind: "npc", d, ref: n, label: `Говорить: ${n.def.name}` }; }
    for (const g of this.world.gathers) { if (g.taken) continue; const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < 3.6 && (!best || d < best.d)) best = { kind: "node", d, ref: g, label: g.item === "river_fish" ? "Ловить рыбу" : `Собрать: ${g.label}` }; }
    return best;
  }

  updateInteractPrompt() {
    const b = this.nearest();
    const label = b && !useGame.getState().dialog ? b.label : null;
    if (label !== this.interactLabel) { this.interactLabel = label; useGame.setState({ interact: label }); }
  }

  interact() {
    if (this.dead) return;
    const st = useGame.getState();
    if (this.target && (this.targetKind === "npc") && dist2((this.target as Npc).pos, this.player.pos) < 6) { st.openDialog((this.target as Npc).def.id); return; }
    if (this.target && this.targetKind === "node" && Math.hypot((this.target as GatherNode).x - this.player.pos.x, (this.target as GatherNode).z - this.player.pos.z) < 4) { this.gather(this.target as GatherNode); return; }
    if (this.target && this.targetKind === "npc") { this.say("Подойдите ближе к собеседнику"); return; }
    const b = this.nearest();
    if (!b) { return; }
    if (b.kind === "npc") { this.setTarget(b.ref as Npc); st.openDialog((b.ref as Npc).def.id); }
    else this.gather(b.ref as GatherNode);
  }

  gather(g: GatherNode) {
    const st = useGame.getState();
    if (g.taken) return;
    let ok = true;
    st.mutate((ps) => { ok = addItem(ps, g.item, 1); });
    if (!ok) { this.say("Инвентарь полон"); return; }
    g.taken = true; g.obj.visible = false; g.respawn = this.t + 45;
    this.player.model.play("heal", 0.7);
    this.vfx.heal(tv.set(g.x, g.obj.position.y, g.z).clone(), g.color);
    const it = ITEMS[g.item];
    st.toast(`${it.icon} Получено: ${it.name}`, "good");
    this.chat("loot", `Вы собрали: ${it.name}`);
    if (this.target && this.targetKind === "node") this.setTarget(null);
  }

  // ======================= ЧАТ / СЕТЬ / СОХРАНЕНИЕ =======================
  chat(channel: "system" | "combat" | "loot" | "quest", text: string) { useGame.getState().addChat({ channel, text }); }

  sendChat(text: string, channel: "world" | "zone") {
    const t = text.trim();
    if (!t) return;
    if (t.startsWith("/")) {
      const cmd = t.slice(1).split(" ")[0].toLowerCase();
      const emo: Record<string, string> = { wave: "wave", hello: "wave", cheer: "cheer", dance: "cheer", sit: "sit" };
      if (emo[cmd]) { this.player.loop = emo[cmd]; this.chat("system", `* ${this.info.name} ${cmd === "sit" ? "присаживается" : cmd === "wave" || cmd === "hello" ? "машет рукой" : "радуется"} *`); }
      else if (cmd === "stop") { this.player.loop = undefined; }
      else this.chat("system", "Команды: /wave /cheer /dance /sit /stop. Каналы: Мир и Локация.");
      return;
    }
    this.outbox.push({ channel, text: t });
    this.sync();
  }

  async sync() {
    if (this.syncing || this.disposed || this.loadingZone) return;
    this.syncing = true;
    try {
      const ps = useGame.getState().ps;
      const p = this.player;
      const send = this.outbox.shift();
      const res = await fetch("/api/world", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.info.id, zone: this.world.zone.id, x: p.pos.x, z: p.pos.z, ry: p.face, mv: p.speed > 0.1, since: this.lastChatId, gear: ps.equipment, send }),
      });
      if (res.ok) {
        const d = (await res.json()) as { players: { id: number; name: string; cls: ClassId; gender: Gender; level: number; appearance: Appearance; x: number; z: number; ry: number; gear: Record<string, string> | null }[]; chat: { id: number; channel: string; name: string; cls: string; text: string }[]; lastChatId: number };
        const st = useGame.getState();
        const first = this.lastChatId === 0;
        for (const m of d.chat) { st.addChat({ id: `s${m.id}`, channel: m.channel as "world" | "zone", name: m.name, cls: m.cls, text: m.text }); }
        this.lastChatId = first ? d.lastChatId : Math.max(this.lastChatId, ...d.chat.map((m) => m.id), 0);
        const now = performance.now();
        for (const o of d.players) {
          const gear = o.gear ?? {};
          const key = JSON.stringify(gear) + o.cls;
          let r = this.remotes.get(o.id);
          if (r && r.key !== key) { r.model.group.removeFromParent(); r.model.dispose(); r.label.el.remove(); this.remotes.delete(o.id); r = undefined; }
          if (!r) {
            const model = new CharacterModel({ cls: o.cls, gender: o.gender, app: o.appearance, armorTier: gear.chest ? gearTier(gear.chest) : 0, weaponTier: Math.max(0, gearTier(gear.weapon)), head: !!gear.head });
            model.group.position.set(o.x, this.world.groundY(o.x, o.z), o.z); this.scene.add(model.group);
            const label = this.makeLabel(o.name, CLS_COLOR[o.cls], o.level, false); label.el.classList.add("np-player");
            r = { id: o.id, name: o.name, model, pos: new THREE.Vector3(o.x, 0, o.z), tpos: new THREE.Vector3(o.x, 0, o.z), face: o.ry, tface: o.ry, label, moving: false, key, seen: now };
            this.remotes.set(o.id, r);
          }
          r.tpos.set(o.x, 0, o.z); r.tface = o.ry; r.seen = now;
        }
        useGame.setState({ online: this.remotes.size + 1 });
      }
    } catch { /* офлайн: продолжаем игру */ }
    this.syncing = false;
  }

  saveNow(beacon = false) {
    if (!this.player || this.saving) return;
    const st = useGame.getState();
    const ps: PlayerState = { ...structuredClone(st.ps), hp: Math.max(1, Math.round(this.hp)), mp: Math.round(this.mp), zone: this.world.zone.id, x: this.player.pos.x, z: this.player.pos.z, ry: this.player.face };
    const body = JSON.stringify({ id: this.info.id, state: ps });
    if (beacon) { try { fetch("/api/characters", { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: true }); } catch { /* ignore */ } return; }
    this.saving = true;
    fetch("/api/characters", { method: "PUT", headers: { "Content-Type": "application/json" }, body }).catch(() => {}).finally(() => { this.saving = false; });
  }

  // ======================= UI ПОВЕРХ 3D =======================
  floatText(world: THREE.Vector3, text: string, kind: string) {
    const s = this.project(world);
    if (!s.ok) return;
    const el = document.createElement("div");
    el.className = `fct fct-${kind}`;
    el.textContent = text;
    el.style.left = `${s.x + (Math.random() - 0.5) * 40}px`;
    el.style.top = `${s.y}px`;
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  updateLabels() {
    const cp = this.camera.position;
    const place = (l: Label, pos: THREE.Vector3, h: number, maxD: number, visible = true) => {
      tv.set(pos.x, pos.y + h, pos.z);
      const d = cp.distanceTo(tv);
      const s = this.project(tv);
      if (!visible || !s.ok || d > maxD) { l.el.style.display = "none"; return; }
      l.el.style.display = "";
      l.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%) scale(${clamp(26 / d + 0.55, 0.6, 1.05).toFixed(2)})`;
      l.el.style.zIndex = String(Math.round(1000 - d));
    };
    place(this.player.label, this.player.pos, this.player.model.topY + 0.15, 60);
    for (const n of this.npcs) place(n.label, n.pos, n.model.topY + 0.3, 40);
    this.remotes.forEach((r) => place(r.label, r.pos, r.model.topY + 0.25, 45));
    for (const m of this.mobs) {
      if (m.state === "dead" || m.hidden) { m.label.el.style.display = "none"; continue; }
      place(m.label, m.pos, m.cr.height + 0.5, m.def.boss ? 70 : 32);
      m.label.fill.style.width = `${clamp((m.hp / m.maxHp) * 100, 0, 100)}%`;
      const sel = this.target === m;
      m.label.el.classList.toggle("sel", sel);
      const lvDiff = m.lvl - useGame.getState().ps.level;
      m.label.el.dataset.diff = lvDiff >= 5 ? "hard" : lvDiff <= -5 ? "easy" : "even";
    }
    // подсветка выбранного NPC/игрока
    for (const n of this.npcs) n.label.el.classList.toggle("sel", this.target === n);
  }
}
void mulberry; void resolveItemId; void QUESTS;
