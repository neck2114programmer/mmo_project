/* eslint-disable */
const noop: any = new Proxy(function () {}, { get: (_t, p) => (p === "width" || p === "height" ? 64 : noop), apply: () => noop, set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 64, height: 64, style: {}, getContext: () => noop }) };
import * as THREE from "three";
import { CharacterModel } from "../src/game/render/character";
import { CLASS_IDS } from "../src/game/types";
import { defaultAppearance, randomAppearance } from "../src/game/data/classes";
import { buildCreature } from "../src/game/render/creatures";
import { MOBS } from "../src/game/data/world";
import { buildStructure } from "../src/game/render/structures";
import { World } from "../src/game/render/world";
import { Vfx } from "../src/game/render/vfx";

const count = (o: THREE.Object3D) => { let n = 0; o.traverse((c) => { if ((c as any).isMesh) n++; }); return n; };
for (const cls of CLASS_IDS) for (const g of ["male", "female"] as const) for (const tier of [0, 3, 5]) {
  const m = new CharacterModel({ cls, gender: g, app: { ...randomAppearance(g) }, armorTier: tier, weaponTier: tier, head: tier > 0 });
  for (let i = 0; i < 30; i++) { m.setSpeed(i % 2); if (i === 5) m.play("slash", 0.5); if (i === 10) m.play("shoot", 0.5); if (i === 12) m.play("cast", 0.5); m.update(0.03); }
  if (tier === 3 && g === "male") console.log(cls, "meshes", count(m.group));
}
for (const hair of [...Array(10).keys()]) { const a = defaultAppearance("female"); a.hair = hair; a.ears = hair % 4; a.tail = hair % 3; a.mark = hair % 5; new CharacterModel({ cls: "mage", gender: "female", app: a, head: hair % 2 === 0 }).update(0.02); }
for (const m of Object.values(MOBS)) { const c = buildCreature(m); for (let i = 0; i < 10; i++) c.tick(0.03, 0.5, i * 0.03); c.attack(); c.setDead(true); c.tick(0.03, 0, 1); }
for (const k of ["rabbit", "deer", "fox", "drake", "shadow"]) buildCreature({ id: k, name: k, model: k, scale: 1, speed: 1, aggro: 0, drops: [] } as any);
for (const k of ["cottage","windmill","well","campfire","stall","watchtower","bridge","dock","haystack","garden","lamp","banner","tent","bigtent","pyramid","obelisk","ruins","bones","cave","stones","giantTree","shrine","pillar","brazier","throne","sarcophagus","cryptgate","fence"]) { const s = buildStructure(k); if (!s) throw new Error("no struct " + k); s.update?.(1, 0.03); }
for (const z of ["meadow", "desert", "forest", "crypt"] as const) {
  const t0 = Date.now();
  const sc = new THREE.Scene();
  const w = new World(z, sc);
  w.update(1, 0.03, new THREE.Vector3(0, 0, 0));
  console.log(z, "world ok", Date.now() - t0, "ms; objects", count(sc), "colliders", w.grid.size, "gathers", w.gathers.length, "portals", w.portals.length);
}
const vs = new THREE.Scene(); const v = new Vfx(vs);
const p = new THREE.Vector3(0, 0, 0);
v.slash(p, 0, "#fff"); v.nova(p, 4, "#fff"); v.quake(p, 4, "#fff"); v.pillar(p, 2, "#fff"); v.heal(p, "#fff"); v.buff(p, "#fff"); v.shield(p, "#fff"); v.whirl(p, 3, "#fff"); v.summon(p, "#fff"); v.levelUp(p);
v.projectile(p, () => new THREE.Vector3(5, 1, 0), "#fff", "bolt", 30, () => {}); v.beam(p, new THREE.Vector3(3, 1, 0), "#fff"); v.rain(p, 4, "#fff", "meteor"); v.telegraph(p, 5, 1);
for (let i = 0; i < 100; i++) v.update(0.03);
console.log("SMOKE OK");
