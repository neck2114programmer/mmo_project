import { INV_SIZE, LEVEL_CAP, STAT_KEYS, SLOTS, type ClassId, type PlayerState, type SlotId, type StatKey, type Stats, type ZoneId } from "./types";
import { CLASSES } from "./data/classes";
import { ITEMS } from "./data/items";
import { SKILLS, SKILLS_BY_CLASS, skillRankMul, type Buff, type Passive } from "./data/skills";
import { QUESTS, type QuestDef } from "./data/quests";
import { xpFor } from "./data/balance";

export const SPAWN: Record<ZoneId, { x: number; z: number }> = {
  meadow: { x: -18, z: 5 },
  desert: { x: -84, z: 0 },
  forest: { x: -84, z: 0 },
  crypt: { x: 0, z: 76 },
};
export const ZONE_NAMES: Record<ZoneId, string> = {
  meadow: "Опушка Рассвета",
  desert: "Пески Ал-Хазар",
  forest: "Лес Друидов Эйнвуд",
  crypt: "Склеп Короля-Лича",
};

export function resolveItemId(id: string, cls: ClassId): string {
  if (id.startsWith("@")) {
    const [slot, tier] = id.slice(1).split(":");
    return `${slot}:${cls}:${tier}`;
  }
  return id;
}

export function emptyStats(): Stats {
  return { str: 0, dex: 0, int: 0, vit: 0, spi: 0 };
}

export function newPlayerState(cls: ClassId): PlayerState {
  const ps: PlayerState = {
    level: 1, xp: 0, gold: 60, hp: 1, mp: 1, statPoints: 0, skillPoints: 2, alloc: emptyStats(), skills: {},
    hotbar: Array(10).fill(null), inventory: Array(INV_SIZE).fill(null),
    equipment: { weapon: `weapon:${cls}:0`, chest: `chest:${cls}:0`, legs: `legs:${cls}:0`, boots: `boots:${cls}:0` },
    quests: {}, zone: "meadow", x: SPAWN.meadow.x, z: SPAWN.meadow.z, ry: 0,
  };
  ps.hotbar[0] = "basic";
  ps.hotbar[8] = "item:hp_s";
  ps.hotbar[9] = "item:mp_s";
  addItem(ps, "hp_s", 5);
  addItem(ps, "mp_s", 3);
  addItem(ps, "food_bread", 5);
  const d = computeDerived(ps, cls);
  ps.hp = d.maxHp;
  ps.mp = d.maxMp;
  return ps;
}

// ---------- Характеристики ----------
export interface Derived {
  stats: Stats; maxHp: number; maxMp: number; atk: number; def: number; crit: number; critDmg: number;
  speed: number; haste: number; leech: number; regen: number; mpRegen: number; dodge: number;
  weaponAtk: number; setPieces: number;
}

export function passiveSum(ps: PlayerState): Passive {
  const sum: Record<string, number> = {};
  for (const [id, rank] of Object.entries(ps.skills)) {
    const s = SKILLS[id];
    if (!s || s.type !== "passive" || !s.passive) continue;
    for (const [k, v] of Object.entries(s.passive)) sum[k] = (sum[k] ?? 0) + (v as number) * rank;
  }
  return sum as Passive;
}

export function computeDerived(ps: PlayerState, cls: ClassId, buff?: Buff): Derived {
  const c = CLASSES[cls];
  const pas = passiveSum(ps);
  const stats = emptyStats();
  for (const k of STAT_KEYS) {
    stats[k] = c.base[k] + c.growth[k] * (ps.level - 1) + ps.alloc[k] + (pas[k] ?? 0);
  }
  let weaponAtk = 4;
  let armor = 0;
  const setCount: Record<string, number> = {};
  for (const slot of SLOTS) {
    const id = ps.equipment[slot];
    const it = id ? ITEMS[id] : undefined;
    if (!it) continue;
    for (const k of STAT_KEYS) stats[k] += it.stats[k] ?? 0;
    if (it.atk) weaponAtk = it.atk;
    if (it.armor) armor += it.armor;
    if (it.kind === "armor") setCount[`${it.cls}${it.tier}`] = (setCount[`${it.cls}${it.tier}`] ?? 0) + 1;
  }
  const setPieces = Math.max(0, ...Object.values(setCount));
  const setAtk = setPieces >= 5 ? 0.12 : setPieces >= 3 ? 0.05 : 0;
  const setDef = setPieces >= 5 ? 0.12 : setPieces >= 3 ? 0.05 : 0;
  const setHp = setPieces >= 5 ? 0.05 : 0;
  const mainStat = c.magic ? stats.int : c.primary === "dex" ? stats.dex : stats.str;
  const atkPct = (pas.atk ?? 0) / 100 + setAtk + (buff?.atk ?? 0);
  const atk = (weaponAtk + mainStat * 2.2) * (1 + atkPct);
  const defPct = (pas.def ?? 0) / 100 + setDef + (buff?.def ?? 0);
  const def = (armor + stats.vit * 0.6) * (1 + defPct);
  const maxHp = Math.round((80 + ps.level * 18 + stats.vit * 9) * c.hpMul * (1 + (pas.hp ?? 0) / 100 + setHp));
  const maxMp = Math.round((40 + ps.level * 6 + stats.spi * 7 + stats.int * 2) * c.mpMul * (1 + (pas.mp ?? 0) / 100));
  return {
    stats, maxHp, maxMp, atk, def,
    crit: 5 + stats.dex * 0.12 + (pas.crit ?? 0) + (buff?.crit ?? 0),
    critDmg: 150 + (pas.critDmg ?? 0),
    speed: 1 + (pas.spd ?? 0) / 100 + (buff?.spd ?? 0),
    haste: (pas.haste ?? 0) / 100 + (buff?.haste ?? 0),
    leech: (pas.leech ?? 0) / 100,
    regen: (pas.regen ?? 0) / 100,
    mpRegen: 1.5 + stats.spi * 0.12 + (pas.mpRegen ?? 0),
    dodge: 3 + stats.dex * 0.05 + (pas.dodge ?? 0) + (buff?.dodge ?? 0),
    weaponAtk, setPieces,
  };
}

export function mitigation(def: number, attackerLevel: number) {
  return def / (def + 50 + attackerLevel * 12);
}

// ---------- Инвентарь ----------
const stackable = (id: string) => {
  const k = ITEMS[id]?.kind;
  return k === "consumable" || k === "material" || k === "quest";
};

export function addItem(ps: PlayerState, id: string, n = 1): boolean {
  if (!ITEMS[id]) return false;
  if (stackable(id)) {
    for (const s of ps.inventory) if (s && s.id === id && s.n < 99) {
      const put = Math.min(99 - s.n, n);
      s.n += put;
      n -= put;
      if (n <= 0) return true;
    }
  }
  while (n > 0) {
    const idx = ps.inventory.findIndex((s) => !s);
    if (idx < 0) return false;
    const put = stackable(id) ? Math.min(99, n) : 1;
    ps.inventory[idx] = { id, n: put };
    n -= put;
  }
  return true;
}

export function countItem(ps: PlayerState, id: string): number {
  return ps.inventory.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
}

export function removeItem(ps: PlayerState, id: string, n = 1): boolean {
  if (countItem(ps, id) < n) return false;
  for (let i = 0; i < ps.inventory.length && n > 0; i++) {
    const s = ps.inventory[i];
    if (s && s.id === id) {
      const take = Math.min(n, s.n);
      s.n -= take;
      n -= take;
      if (s.n <= 0) ps.inventory[i] = null;
    }
  }
  return true;
}

export function canEquip(ps: PlayerState, cls: ClassId, id: string): string | null {
  const it = ITEMS[id];
  if (!it || !it.slot) return "Этот предмет нельзя надеть";
  if (it.cls && it.cls !== cls) return `Предмет для класса «${CLASSES[it.cls].name}»`;
  if (ps.level < it.reqLevel) return `Требуется ${it.reqLevel} уровень`;
  return null;
}

export function equipFromInv(ps: PlayerState, cls: ClassId, idx: number): string | null {
  const s = ps.inventory[idx];
  if (!s) return "Пусто";
  const err = canEquip(ps, cls, s.id);
  if (err) return err;
  const slot = ITEMS[s.id].slot as SlotId;
  const old = ps.equipment[slot];
  ps.equipment[slot] = s.id;
  ps.inventory[idx] = old ? { id: old, n: 1 } : null;
  return null;
}

export function unequip(ps: PlayerState, slot: SlotId): string | null {
  const id = ps.equipment[slot];
  if (!id) return null;
  if (!addItem(ps, id, 1)) return "Инвентарь полон";
  delete ps.equipment[slot];
  return null;
}

// ---------- Опыт / уровень ----------
export function gainXp(ps: PlayerState, amount: number): number {
  if (ps.level >= LEVEL_CAP) return 0;
  ps.xp += amount;
  let gained = 0;
  while (ps.level < LEVEL_CAP && ps.xp >= xpFor(ps.level)) {
    ps.xp -= xpFor(ps.level);
    ps.level++;
    gained++;
    ps.statPoints += 2;
    ps.skillPoints += 1 + (ps.level % 5 === 0 ? 1 : 0);
  }
  if (ps.level >= LEVEL_CAP) ps.xp = 0;
  return gained;
}

export function totalSkillPoints(level: number) {
  let n = 2;
  for (let l = 2; l <= level; l++) n += 1 + (l % 5 === 0 ? 1 : 0);
  return n;
}

// ---------- Навыки ----------
export function canLearn(ps: PlayerState, id: string): string | null {
  const s = SKILLS[id];
  if (!s) return "Неизвестный навык";
  const rank = ps.skills[id] ?? 0;
  if (rank >= s.maxRank) return "Максимальный ранг";
  if (ps.level < s.reqLevel) return `Требуется ${s.reqLevel} уровень`;
  if (s.parent && !(ps.skills[s.parent] > 0)) return `Сначала изучите «${SKILLS[s.parent].name}»`;
  if (ps.skillPoints < 1) return "Нет очков навыков";
  return null;
}

export function learnSkill(ps: PlayerState, id: string): string | null {
  const err = canLearn(ps, id);
  if (err) return err;
  const s = SKILLS[id];
  ps.skills[id] = (ps.skills[id] ?? 0) + 1;
  ps.skillPoints -= 1;
  if (ps.skills[id] === 1 && s.type === "active" && !ps.hotbar.includes(id)) {
    const slot = ps.hotbar.findIndex((h, i) => !h && i < 8);
    if (slot >= 0) ps.hotbar[slot] = id;
  }
  return null;
}

export function respecSkills(ps: PlayerState) {
  ps.skills = {};
  ps.skillPoints = totalSkillPoints(ps.level);
  ps.hotbar = ps.hotbar.map((h) => (h && h !== "basic" && !h.startsWith("item:") ? null : h));
}

export function respecStats(ps: PlayerState) {
  const total = Object.values(ps.alloc).reduce((a, b) => a + b, 0);
  ps.statPoints += total;
  ps.alloc = emptyStats();
}

export function allocStat(ps: PlayerState, k: StatKey): boolean {
  if (ps.statPoints < 1) return false;
  ps.alloc[k] += 1;
  ps.statPoints -= 1;
  return true;
}

export function skillValue(skillId: string, rank: number) {
  return skillRankMul(rank);
}
export { SKILLS_BY_CLASS };

// ---------- Квесты ----------
export function questObjProgress(ps: PlayerState, q: QuestDef, i: number): number {
  const o = q.objectives[i];
  const qp = ps.quests[q.id];
  if (o.type === "collect") return Math.min(o.n, countItem(ps, o.item));
  if (!qp) return 0;
  const v = qp.prog[i] ?? 0;
  return o.type === "kill" ? Math.min(o.n, v) : Math.min(1, v);
}
export const questObjTarget = (q: QuestDef, i: number) => {
  const o = q.objectives[i];
  return o.type === "kill" || o.type === "collect" ? o.n : 1;
};

export function questIsComplete(ps: PlayerState, q: QuestDef): boolean {
  return q.objectives.every((_, i) => questObjProgress(ps, q, i) >= questObjTarget(q, i));
}

export function questAvailable(ps: PlayerState, q: QuestDef): boolean {
  if (ps.quests[q.id]) return false;
  if (ps.level < q.level - 3) return false;
  if (q.requires && ps.quests[q.requires]?.state !== "done") return false;
  return true;
}

export function refreshQuests(ps: PlayerState): string[] {
  const changed: string[] = [];
  for (const [id, qp] of Object.entries(ps.quests)) {
    if (qp.state === "done") continue;
    const q = QUESTS[id];
    if (!q) continue;
    const ok = questIsComplete(ps, q);
    const ns = ok ? "ready" : "active";
    if (qp.state !== ns) {
      qp.state = ns;
      changed.push(id);
    }
  }
  return changed;
}

export function acceptQuest(ps: PlayerState, q: QuestDef): boolean {
  if (!questAvailable(ps, q)) return false;
  ps.quests[q.id] = { state: "active", prog: q.objectives.map(() => 0) };
  if (q.give) for (const g of q.give) addItem(ps, g.id, g.n);
  refreshQuests(ps);
  return true;
}

export function questOnKill(ps: PlayerState, mobId: string): string[] {
  const upd: string[] = [];
  for (const [id, qp] of Object.entries(ps.quests)) {
    if (qp.state !== "active") continue;
    const q = QUESTS[id];
    q.objectives.forEach((o, i) => {
      if (o.type === "kill" && o.mob === mobId && (qp.prog[i] ?? 0) < o.n) {
        qp.prog[i] = (qp.prog[i] ?? 0) + 1;
        upd.push(id);
      }
    });
  }
  refreshQuests(ps);
  return upd;
}

export function questOnTalk(ps: PlayerState, npcId: string): string[] {
  const upd: string[] = [];
  for (const [id, qp] of Object.entries(ps.quests)) {
    if (qp.state !== "active") continue;
    QUESTS[id].objectives.forEach((o, i) => {
      if (o.type === "talk" && o.npc === npcId && !qp.prog[i]) {
        qp.prog[i] = 1;
        upd.push(id);
      }
    });
  }
  refreshQuests(ps);
  return upd;
}

export function questOnReach(ps: PlayerState, zone: ZoneId, x: number, z: number): string[] {
  const upd: string[] = [];
  for (const [id, qp] of Object.entries(ps.quests)) {
    if (qp.state !== "active") continue;
    QUESTS[id].objectives.forEach((o, i) => {
      if (o.type === "reach" && o.zone === zone && !qp.prog[i] && Math.hypot(o.x - x, o.z - z) < o.r) {
        qp.prog[i] = 1;
        upd.push(id);
      }
    });
  }
  if (upd.length) refreshQuests(ps);
  return upd;
}

export function questNeedsItem(ps: PlayerState, itemId: string): boolean {
  for (const [id, qp] of Object.entries(ps.quests)) {
    if (qp.state !== "active") continue;
    if (QUESTS[id].objectives.some((o) => o.type === "collect" && o.item === itemId && countItem(ps, itemId) < o.n)) return true;
  }
  return false;
}

export function turnInQuest(ps: PlayerState, cls: ClassId, q: QuestDef): { levels: number; items: string[] } | null {
  const qp = ps.quests[q.id];
  if (!qp || qp.state !== "ready") return null;
  for (const o of q.objectives) if (o.type === "collect") removeItem(ps, o.item, o.n);
  qp.state = "done";
  ps.gold += q.reward.gold;
  const items: string[] = [];
  for (const r of q.reward.items ?? []) {
    const id = resolveItemId(r.id, cls);
    if (addItem(ps, id, r.n)) items.push(id);
  }
  const levels = gainXp(ps, q.reward.xp);
  refreshQuests(ps);
  return { levels, items };
}

export function sanitizeState(raw: unknown, cls: ClassId): PlayerState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as PlayerState;
  if (typeof s.level !== "number" || !Array.isArray(s.inventory) || !s.equipment) return null;
  const base = newPlayerState(cls);
  return { ...base, ...s, alloc: { ...base.alloc, ...(s.alloc ?? {}) }, hotbar: Array.from({ length: 10 }, (_, i) => s.hotbar?.[i] ?? null), inventory: Array.from({ length: INV_SIZE }, (_, i) => s.inventory[i] ?? null) };
}
