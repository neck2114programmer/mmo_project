import { create } from "zustand";
import type { Appearance, ClassId, Gender, PlayerState, SlotId, StatKey, ZoneId } from "./types";
import {
  acceptQuest, addItem, allocStat, computeDerived, equipFromInv, gainXp, learnSkill, newPlayerState, removeItem, resolveItemId,
  respecSkills, respecStats, turnInQuest, unequip, type Derived, questOnTalk, questOnKill, refreshQuests,
} from "./logic";
import { ITEMS, itemSellPrice } from "./data/items";
import { QUESTS } from "./data/quests";
import { NPCS } from "./data/world";
import type { Buff } from "./data/skills";
import type { GameEngine } from "./engine";

export interface ChatMsg { id: string; channel: "world" | "zone" | "system" | "combat" | "loot" | "quest"; name?: string; cls?: string; text: string }
export interface TargetInfo { id: string; kind: "mob" | "npc" | "player" | "node"; name: string; level?: number; hp: number; maxHp: number; boss?: boolean; title?: string; friendly?: boolean }
export interface BuffInfo { id: string; name: string; icon: string; end: number; buff?: Buff; color: string }
export interface Toast { id: number; text: string; kind: "info" | "good" | "bad" | "level" | "quest" }
export interface CharInfo { id: number; name: string; cls: ClassId; gender: Gender; appearance: Appearance }
export type WinKey = "inv" | "char" | "skills" | "quests" | "map";
export interface GfxSettings { quality: "low" | "medium" | "high" | "ultra"; res: number; shadows: boolean; bloom: boolean; view: number; fps: number; fixed: string; auto: boolean; master: number; music: number; sfx: number }
export const PRESETS: Record<GfxSettings["quality"], Partial<GfxSettings>> = {
  low: { res: 0.65, shadows: false, bloom: false, view: 0.55 }, medium: { res: 0.85, shadows: true, bloom: false, view: 0.8 },
  high: { res: 1, shadows: true, bloom: true, view: 1 }, ultra: { res: 1.25, shadows: true, bloom: true, view: 1.3 },
};
const DEFAULT_GFX: GfxSettings = { quality: "medium", res: 0.85, shadows: true, bloom: false, view: 0.8, fps: 0, fixed: "auto", auto: true, master: 0.8, music: 0.5, sfx: 0.8 };
function loadSettings(): GfxSettings {
  try { if (typeof window !== "undefined") { const r = localStorage.getItem("eld_settings"); if (r) return { ...DEFAULT_GFX, ...JSON.parse(r) }; if ((navigator.hardwareConcurrency ?? 8) <= 4) return { ...DEFAULT_GFX, quality: "low", ...PRESETS.low }; } } catch { /* ignore */ }
  return DEFAULT_GFX;
}
export interface GameEvent { id: string; title: string; desc: string; zone: string; ends: number; status: "active" | "done" | "failed"; info: string }
export const MM = { span: 200 };

export const bridge: { engine: GameEngine | null; minimap: HTMLCanvasElement | null; mm: () => { px: number; pz: number; yaw: number; mobs: [number, number, boolean][]; npcs: [number, number, string][]; portals: [number, number][]; players: [number, number][] } | null } = {
  engine: null, minimap: null, mm: () => null,
};

interface GameState {
  char: CharInfo | null;
  ps: PlayerState;
  derived: Derived;
  hp: number;
  mp: number;
  buffs: BuffInfo[];
  shield: number;
  target: TargetInfo | null;
  win: Record<WinKey, boolean>;
  dialog: string | null;
  shop: string | null;
  chat: ChatMsg[];
  toasts: Toast[];
  cooldowns: Record<string, number>;
  gcdEnd: number;
  autoAttack: boolean;
  dead: boolean;
  zone: ZoneId;
  loading: boolean;
  loadingText: string;
  online: number;
  settings: GfxSettings;
  setSettings: (p: Partial<GfxSettings>) => void;
  events: GameEvent[];
  tod: number;
  track: string;
  ui: { settings: boolean; events: boolean };
  toggleUi: (k: "settings" | "events") => void;
  save: boolean;
  interact: string | null;
  init: (c: CharInfo, ps: PlayerState) => void;
  recalc: (ps?: PlayerState) => void;
  mutate: (fn: (ps: PlayerState) => void) => void;
  toggleWin: (k: WinKey) => void;
  closeAll: () => void;
  addChat: (m: Omit<ChatMsg, "id"> & { id?: string }) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  setVitals: (hp: number, mp: number) => void;
  equip: (idx: number) => void;
  unequipSlot: (s: SlotId) => void;
  dropItem: (idx: number) => void;
  useItem: (id: string) => boolean;
  buy: (itemId: string) => void;
  sell: (idx: number) => void;
  learn: (id: string) => void;
  alloc: (k: StatKey) => void;
  respecS: () => void;
  respecA: () => void;
  accept: (qid: string) => void;
  turnIn: (qid: string) => void;
  setHotbar: (slot: number, id: string | null) => void;
  openDialog: (npc: string | null) => void;
  gainReward: (xp: number, gold: number) => number;
  onKill: (mob: string) => void;
}

let toastId = 1;

export const useGame = create<GameState>((set, get) => ({
  char: null,
  ps: newPlayerState("warrior"),
  derived: computeDerived(newPlayerState("warrior"), "warrior"),
  hp: 100, mp: 50, buffs: [], shield: 0, target: null,
  win: { inv: false, char: false, skills: false, quests: false, map: false },
  dialog: null, shop: null, chat: [], toasts: [], cooldowns: {}, gcdEnd: 0, autoAttack: false, dead: false,
  zone: "meadow", loading: true, loadingText: "Загрузка мира...", online: 1, save: false, interact: null,
  settings: loadSettings(),
  setSettings: (p) => { const s = { ...get().settings, ...p }; try { localStorage.setItem("eld_settings", JSON.stringify(s)); } catch { /* ignore */ } set({ settings: s }); },
  events: [], tod: 0.4, track: "", ui: { settings: false, events: false },
  toggleUi: (k) => set((s) => ({ ui: { ...s.ui, [k]: !s.ui[k] } })),

  init: (c, ps) => {
    const derived = computeDerived(ps, c.cls);
    set({ char: c, ps, derived, hp: Math.min(ps.hp || derived.maxHp, derived.maxHp), mp: Math.min(ps.mp || derived.maxMp, derived.maxMp), zone: ps.zone, dead: false, chat: [{ id: "sys0", channel: "system", text: `Добро пожаловать в Эльдорию, ${c.name}! Нажмите H — помощь по управлению.` }] });
  },
  recalc: (psIn) => {
    const { char, buffs } = get();
    if (!char) return;
    const ps = psIn ?? get().ps;
    const b: Buff = {};
    for (const x of buffs) if (x.buff) for (const [k, v] of Object.entries(x.buff)) (b as Record<string, number>)[k] = ((b as Record<string, number>)[k] ?? 0) + (v as number);
    const derived = computeDerived(ps, char.cls, b);
    set({ ps, derived, hp: Math.min(get().hp, derived.maxHp), mp: Math.min(get().mp, derived.maxMp) });
  },
  mutate: (fn) => {
    const ps = structuredClone(get().ps);
    fn(ps);
    get().recalc(ps);
  },
  toggleWin: (k) => set((s) => ({ win: { ...s.win, [k]: !s.win[k] } })),
  closeAll: () => set({ win: { inv: false, char: false, skills: false, quests: false, map: false }, dialog: null, shop: null }),
  addChat: (m) => set((s) => ({ chat: [...s.chat.slice(-120), { ...m, id: m.id ?? `c${Date.now()}${Math.random()}` }] })),
  toast: (text, kind = "info") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "level" ? 4500 : 3000);
  },
  setVitals: (hp, mp) => set({ hp, mp }),

  equip: (idx) => {
    const { char } = get();
    if (!char) return;
    let err: string | null = null;
    get().mutate((ps) => { err = equipFromInv(ps, char.cls, idx); });
    if (err) get().toast(err, "bad");
  },
  unequipSlot: (s) => { let err: string | null = null; get().mutate((ps) => { err = unequip(ps, s); }); if (err) get().toast(err, "bad"); },
  dropItem: (idx) => get().mutate((ps) => { ps.inventory[idx] = null; }),
  useItem: (id) => {
    const it = ITEMS[id];
    if (!it || it.kind !== "consumable") return false;
    const now = performance.now();
    if ((get().cooldowns["potion"] ?? 0) > now) { get().toast("Зелья ещё не готовы", "bad"); return false; }
    if (get().dead) return false;
    let ok = false;
    get().mutate((ps) => { ok = removeItem(ps, id, 1); });
    if (!ok) { get().toast("Предмет закончился", "bad"); return false; }
    set((s) => ({ cooldowns: { ...s.cooldowns, potion: now + 6000 } }));
    bridge.engine?.restore(it.heal ?? 0, it.mana ?? 0);
    get().toast(`Использовано: ${it.name}`, "info");
    return true;
  },
  buy: (itemId) => {
    const it = ITEMS[itemId];
    const { ps } = get();
    if (!it) return;
    if (ps.gold < it.price) { get().toast("Недостаточно золота", "bad"); return; }
    let ok = true;
    get().mutate((p) => { if (addItem(p, itemId, 1)) p.gold -= it.price; else ok = false; });
    if (!ok) get().toast("Инвентарь полон", "bad"); else get().toast(`Куплено: ${it.name}`, "good");
  },
  sell: (idx) => {
    const s = get().ps.inventory[idx];
    if (!s) return;
    const price = itemSellPrice(s.id) * s.n;
    get().mutate((p) => { p.inventory[idx] = null; p.gold += price; });
    get().toast(`Продано за ${price} зол.`, "good");
  },
  learn: (id) => { let err: string | null = null; get().mutate((ps) => { err = learnSkill(ps, id); }); if (err) get().toast(err, "bad"); },
  alloc: (k) => get().mutate((ps) => { allocStat(ps, k); }),
  respecS: () => {
    const cost = get().ps.level * 50;
    if (get().ps.gold < cost) { get().toast(`Нужно ${cost} золота`, "bad"); return; }
    get().mutate((ps) => { ps.gold -= cost; respecSkills(ps); });
    get().toast("Навыки сброшены", "info");
  },
  respecA: () => {
    const cost = get().ps.level * 30;
    if (get().ps.gold < cost) { get().toast(`Нужно ${cost} золота`, "bad"); return; }
    get().mutate((ps) => { ps.gold -= cost; respecStats(ps); });
    get().toast("Характеристики сброшены", "info");
  },
  accept: (qid) => {
    const q = QUESTS[qid];
    if (!q) return;
    let ok = false;
    get().mutate((ps) => { ok = acceptQuest(ps, q); });
    if (ok) { get().toast(`Задание принято: ${q.name}`, "quest"); get().addChat({ channel: "quest", text: `Принято задание «${q.name}»` }); }
  },
  turnIn: (qid) => {
    const q = QUESTS[qid];
    const { char } = get();
    if (!q || !char) return;
    let res: { levels: number; items: string[] } | null = null;
    get().mutate((ps) => { res = turnInQuest(ps, char.cls, q); });
    const r = res as { levels: number; items: string[] } | null;
    if (!r) return;
    get().toast(`Задание выполнено: ${q.name}  +${q.reward.xp} опыта, +${q.reward.gold} зол.`, "quest");
    get().addChat({ channel: "quest", text: `Задание «${q.name}» выполнено: +${q.reward.xp} опыта, +${q.reward.gold} золота` });
    r.items.forEach((id) => get().addChat({ channel: "loot", text: `Получено: ${ITEMS[id].name}` }));
    if (r.levels > 0) bridge.engine?.onLevelUp();
    void resolveItemId;
  },
  setHotbar: (slot, id) => get().mutate((ps) => {
    if (id) { const i = ps.hotbar.indexOf(id); if (i >= 0) ps.hotbar[i] = null; }
    ps.hotbar[slot] = id;
  }),
  openDialog: (npc) => {
    if (npc) {
      const n = NPCS[npc];
      if (n) get().mutate((ps) => { questOnTalk(ps, npc); });
    }
    set({ dialog: npc, shop: null });
  },
  gainReward: (xp, gold) => {
    let lv = 0;
    get().mutate((ps) => { ps.gold += gold; lv = gainXp(ps, xp); });
    return lv;
  },
  onKill: (mob) => get().mutate((ps) => { questOnKill(ps, mob); refreshQuests(ps); }),
}));
