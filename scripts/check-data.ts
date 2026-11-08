import { SKILLS_BY_CLASS, SKILLS } from "../src/game/data/skills";
import { QUESTS } from "../src/game/data/quests";
import { NPCS, MOBS } from "../src/game/data/world";
import { ITEMS } from "../src/game/data/items";
import { ZONES } from "../src/game/data/zones";
import { resolveItemId } from "../src/game/logic";
import { CLASS_IDS } from "../src/game/types";

let bad = 0;
const err = (m: string) => { bad++; console.log("ERR", m); };
for (const c of CLASS_IDS) {
  const l = SKILLS_BY_CLASS[c];
  const act = l.filter((s) => s.type === "active").length;
  console.log(c, l.length, "active", act, "passive", l.length - act);
  if (l.length !== 30) err(`${c} skills ${l.length}`);
  for (const s of l) if (s.parent && !SKILLS[s.parent]) err(`parent ${s.id}`);
}
console.log("items", Object.keys(ITEMS).length, "quests", Object.keys(QUESTS).length);
for (const q of Object.values(QUESTS)) {
  if (!NPCS[q.giver]) err(`giver ${q.id}`);
  if (!NPCS[q.turnIn]) err(`turnIn ${q.id}`);
  if (q.requires && !QUESTS[q.requires]) err(`req ${q.id}`);
  for (const o of q.objectives) {
    if (o.type === "kill" && !MOBS[o.mob]) err(`mob ${q.id} ${o.mob}`);
    if (o.type === "collect" && !ITEMS[o.item]) err(`item ${q.id} ${o.item}`);
    if (o.type === "talk" && !NPCS[o.npc]) err(`talk ${q.id}`);
    if (o.type === "collect") {
      // источник предмета должен существовать
      const fromNode = Object.values(ZONES).some((z) => z.gathers.some((g) => g.item === o.item));
      const fromMob = Object.values(MOBS).some((m) => m.drops.some(([i]) => i === o.item));
      if (!fromNode && !fromMob) err(`no source for ${o.item} (${q.id})`);
    }
    if (o.type === "kill") {
      const sp = Object.values(ZONES).some((z) => z.mobs.some((m) => m.mob === o.mob));
      if (!sp) err(`mob not spawned ${o.mob}`);
    }
  }
  for (const r of q.reward.items ?? []) for (const c of CLASS_IDS) if (!ITEMS[resolveItemId(r.id, c)]) err(`reward ${q.id} ${r.id}`);
}
for (const n of Object.values(NPCS)) if (!ZONES[n.zone]) err(`npc zone ${n.id}`);
for (const m of Object.values(MOBS)) for (const [i] of m.drops) if (!ITEMS[i]) err(`drop ${m.id} ${i}`);
console.log(bad ? `${bad} problems` : "DATA OK");
