"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ACCENT_COLORS, BROW_NAMES, CLASS_LIST, CLASSES, EAR_NAMES, EYE_COLORS, EYE_NAMES, HAIR_COLORS, HAIR_NAMES, MARK_COLORS, MARK_NAMES, SKIN_TONES,
  TAIL_NAMES, defaultAppearance, randomAppearance,
} from "@/game/data/classes";
import { Ic } from "@/components/ui";
import { SKILLS_BY_CLASS } from "@/game/data/skills";
import { gearTier } from "@/game/data/items";
import type { Appearance, ClassId, Gender, PlayerState } from "@/game/types";

const CharacterPreview = dynamic(() => import("@/components/CharacterPreview"), { ssr: false, loading: () => <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--muted)" }}>Загрузка 3D...</div> });

interface CharRow { id: number; name: string; gender: Gender; cls: ClassId; level: number; appearance: Appearance; zone: string }

const ZONE_RU: Record<string, string> = { meadow: "Опушка Рассвета", desert: "Пески Ал-Хазар", forest: "Лес Друидов", crypt: "Склеп Короля-Лича" };

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {colors.map((c) => <div key={c} className={`swatch ${value === c ? "sel" : ""}`} style={{ background: c }} onClick={() => onChange(c)} />)}
    </div>
  );
}
function Opts({ names, value, onChange }: { names: string[]; value: number; onChange: (i: number) => void }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{names.map((n, i) => <button type="button" key={n} className={`opt-btn ${value === i ? "sel" : ""}`} onClick={() => onChange(i)}>{n}</button>)}</div>;
}
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="label">{label}</label>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function CharactersPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [chars, setChars] = useState<CharRow[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [selGear, setSelGear] = useState<{ armor: number; weapon: number; head: boolean }>({ armor: 0, weapon: 0, head: false });
  const [mode, setMode] = useState<"select" | "create">("select");
  // создание
  const [cls, setCls] = useState<ClassId>("warrior");
  const [gender, setGender] = useState<Gender>("female");
  const [app, setApp] = useState<Appearance>(defaultAppearance("female"));
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"body" | "face" | "hair" | "color" | "extra">("body");
  const [showTier, setShowTier] = useState(2);
  const [anim, setAnim] = useState<"idle" | "run" | "attack">("idle");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/characters");
    if (r.status === 401) { router.replace("/"); return; }
    const d = await r.json();
    setUser(d.user.username);
    setChars(d.characters);
    if (d.characters.length === 0) setMode("create");
    else setSel((s) => s ?? d.characters[0].id);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sel) return;
    fetch(`/api/characters?id=${sel}`).then((r) => r.json()).then((d) => {
      const st = d.character?.state as PlayerState | undefined;
      if (st) setSelGear({ armor: st.equipment.chest ? gearTier(st.equipment.chest) : 0, weapon: Math.max(0, gearTier(st.equipment.weapon)), head: !!st.equipment.head });
    }).catch(() => {});
  }, [sel]);

  const upd = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setApp((a) => ({ ...a, [k]: v }));
  const pickGender = (g: Gender) => { setGender(g); setApp((a) => ({ ...a, hair: g === "female" ? (a.hair === 0 ? 1 : a.hair) : a.hair, bust: g === "female" ? a.bust : 0.5 })); };

  const create = async () => {
    setErr("");
    if (name.trim().length < 3) { setErr("Введите имя героя (минимум 3 символа)"); return; }
    setBusy(true);
    const r = await fetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), gender, cls, appearance: app }) });
    const d = await r.json();
    if (!r.ok) { setErr(d.error ?? "Ошибка"); setBusy(false); return; }
    router.push(`/game?char=${d.id}`);
  };

  const del = async (id: number) => {
    if (!confirm("Удалить этого персонажа навсегда?")) return;
    await fetch(`/api/characters?id=${id}`, { method: "DELETE" });
    setSel(null); setChars(null); await load();
  };
  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.replace("/");
  };

  const selChar = chars?.find((c) => c.id === sel);
  const cd = CLASSES[cls];
  const skillsPreview = useMemo(() => SKILLS_BY_CLASS[cls].filter((s) => s.type === "active").slice(0, 4), [cls]);

  const bg = "radial-gradient(ellipse at 50% 0%, #2a2150 0%, #120f26 45%, #07060f 100%)";

  if (!chars) return <main style={{ position: "fixed", inset: 0, background: bg, display: "grid", placeItems: "center" }}><div className="spinner" /></main>;

  // ---------- Выбор персонажа ----------
  if (mode === "select") {
    return (
      <main style={{ position: "fixed", inset: 0, background: bg, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px" }}>
          <div className="title-font gold-text" style={{ fontSize: 30 }}>ЭЛЬДОРИЯ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "var(--muted)" }}>Аккаунт: <b style={{ color: "var(--gold-l)" }}>{user}</b></span>
            <button className="btn btn-sm" onClick={logout}>Выйти</button>
          </div>
        </header>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, padding: "0 28px 24px", minHeight: 0 }}>
          <div className="panel" style={{ padding: 18, overflow: "auto" }}>
            <h2 className="title-font" style={{ margin: "0 0 14px", fontSize: 24, color: "var(--gold-l)" }}>Ваши герои</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {chars.map((c) => (
                <div key={c.id} className={`char-slot ${sel === c.id ? "sel" : ""}`} onClick={() => setSel(c.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44 }}><Ic v={CLASSES[c.cls].icon} size="44px" /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 17 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: CLASSES[c.cls].color }}>{CLASSES[c.cls].name} • {c.gender === "female" ? "♀" : "♂"} • ур. {c.level}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{ZONE_RU[c.zone] ?? c.zone}</div>
                    </div>
                  </div>
                </div>
              ))}
              {chars.length < 6 && <button className="btn" onClick={() => { setMode("create"); setErr(""); }}>➕ Создать нового героя</button>}
            </div>
          </div>
          <div className="panel" style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>
            {selChar && (
              <>
                <CharacterPreview cls={selChar.cls} gender={selChar.gender} app={selChar.appearance} armorTier={selGear.armor} weaponTier={selGear.weapon} head={selGear.head} />
                <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                  <div className="title-font gold-text" style={{ fontSize: 40 }}>{selChar.name}</div>
                  <div style={{ color: CLASSES[selChar.cls].color, fontWeight: 800, letterSpacing: "0.12em" }}>{CLASSES[selChar.cls].name.toUpperCase()} • УРОВЕНЬ {selChar.level}</div>
                </div>
                <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 14 }}>
                  <button className="btn btn-gold" style={{ padding: "16px 54px", fontSize: 19 }} onClick={() => router.push(`/game?char=${selChar.id}`)}>⚔️ ВОЙТИ В МИР</button>
                  <button className="btn btn-danger" onClick={() => del(selChar.id)}>Удалить</button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Создание персонажа ----------
  const tabs: [typeof tab, string][] = [["body", "Тело"], ["face", "Лицо"], ["hair", "Волосы"], ["color", "Цвета"], ["extra", "Особенности"]];
  return (
    <main style={{ position: "fixed", inset: 0, background: bg, display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px" }}>
        <div className="title-font gold-text" style={{ fontSize: 30 }}>Создание героя</div>
        <div style={{ display: "flex", gap: 10 }}>
          {chars.length > 0 && <button className="btn btn-sm" onClick={() => setMode("select")}>← К выбору</button>}
          <button className="btn btn-sm" onClick={logout}>Выйти</button>
        </div>
      </header>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 360px", gap: 16, padding: "0 24px 16px", minHeight: 0 }}>
        {/* Классы */}
        <div className="panel" style={{ padding: 14, overflow: "auto" }}>
          <label className="label">Класс</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CLASS_LIST.map((c) => (
              <div key={c.id} className={`cls-card ${cls === c.id ? "sel" : ""}`} onClick={() => setCls(c.id)}>
                <div style={{ width: 40, height: 40 }}><Ic v={c.icon} size="40px" /></div>
                <div>
                  <div style={{ fontWeight: 900, color: c.color }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Превью */}
        <div className="panel" style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>
          <CharacterPreview cls={cls} gender={gender} app={app} armorTier={showTier} weaponTier={showTier} head={false} focus={tab === "face" || tab === "hair" ? "face" : "body"} anim={anim} />
          <div style={{ position: "absolute", top: 14, left: 16, right: 16, pointerEvents: "none" }}>
            <div className="title-font" style={{ fontSize: 30, color: cd.color }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Ic v={cd.icon} size="40px" /> {cd.name}</span></div>
            <div style={{ fontSize: 13, color: "#d8d6e8", maxWidth: 520, lineHeight: 1.45, textShadow: "0 1px 4px #000" }}>{cd.desc}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="chip">⚔ {cd.weaponKind}</span><span className="chip">🛡 {{ cloth: "Ткань", leather: "Кожа", mail: "Кольчуга", plate: "Латы" }[cd.armor]}</span><span className="chip">✨ {cd.role}</span>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6 }}>
            {(["idle", "run", "attack"] as const).map((a) => <button key={a} className={`opt-btn ${anim === a ? "sel" : ""}`} onClick={() => setAnim(a)}>{{ idle: "Покой", run: "Бег", attack: "Атака" }[a]}</button>)}
          </div>
          <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Экипировка:</span>
            {[[0, "Новичок"], [2, "Герой"], [4, "Легенда"]].map(([t, n]) => <button key={n} className={`opt-btn ${showTier === t ? "sel" : ""}`} onClick={() => setShowTier(t as number)}>{n}</button>)}
          </div>
          <div style={{ position: "absolute", bottom: 52, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>Перетащите мышью для вращения • колесо — приближение</div>
        </div>

        {/* Кастомизация */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
            {tabs.map(([k, n]) => <button key={k} className={`tab-btn ${tab === k ? "active" : ""}`} style={{ fontSize: 11, padding: "10px 4px" }} onClick={() => setTab(k)}>{n}</button>)}
          </div>
          <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
            {tab === "body" && (
              <>
                <label className="label">Пол</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button className={`opt-btn ${gender === "female" ? "sel" : ""}`} style={{ flex: 1, padding: 10 }} onClick={() => pickGender("female")}>♀ Женский</button>
                  <button className={`opt-btn ${gender === "male" ? "sel" : ""}`} style={{ flex: 1, padding: 10 }} onClick={() => pickGender("male")}>♂ Мужской</button>
                </div>
                <Slider label="Рост" value={app.height} onChange={(v) => upd("height", v)} />
                <Slider label="Телосложение" value={app.build} onChange={(v) => upd("build", v)} />
                {gender === "female" && <Slider label="Фигура" value={app.bust} onChange={(v) => upd("bust", v)} />}
                <Slider label="Размер головы" value={app.headSize} onChange={(v) => upd("headSize", v)} />
              </>
            )}
            {tab === "face" && (
              <>
                <label className="label">Форма глаз</label><Opts names={EYE_NAMES} value={app.eyeStyle} onChange={(v) => upd("eyeStyle", v)} />
                <div style={{ height: 12 }} /><Slider label="Размер глаз" value={app.eyeSize} onChange={(v) => upd("eyeSize", v)} />
                <label className="label">Брови</label><Opts names={BROW_NAMES} value={app.brow} onChange={(v) => upd("brow", v)} />
                <div style={{ height: 12 }} /><label className="label">Метки на лице</label><Opts names={MARK_NAMES} value={app.mark} onChange={(v) => upd("mark", v)} />
                {app.mark > 0 && <><div style={{ height: 10 }} /><label className="label">Цвет метки</label><Swatches colors={MARK_COLORS} value={app.markColor} onChange={(c) => upd("markColor", c)} /></>}
              </>
            )}
            {tab === "hair" && (
              <>
                <label className="label">Причёска</label><Opts names={HAIR_NAMES} value={app.hair} onChange={(v) => upd("hair", v)} />
                <div style={{ height: 14 }} /><label className="label">Цвет волос</label><Swatches colors={HAIR_COLORS} value={app.hairColor} onChange={(c) => upd("hairColor", c)} />
              </>
            )}
            {tab === "color" && (
              <>
                <label className="label">Цвет кожи</label><Swatches colors={SKIN_TONES} value={app.skin} onChange={(c) => upd("skin", c)} />
                <div style={{ height: 14 }} /><label className="label">Цвет глаз</label><Swatches colors={EYE_COLORS} value={app.eyeColor} onChange={(c) => upd("eyeColor", c)} />
                <div style={{ height: 14 }} /><label className="label">Акцент одежды</label><Swatches colors={ACCENT_COLORS} value={app.accent} onChange={(c) => upd("accent", c)} />
              </>
            )}
            {tab === "extra" && (
              <>
                <label className="label">Уши</label><Opts names={EAR_NAMES} value={app.ears} onChange={(v) => upd("ears", v)} />
                <div style={{ height: 14 }} /><label className="label">Хвост</label><Opts names={TAIL_NAMES} value={app.tail} onChange={(v) => upd("tail", v)} />
                <div style={{ marginTop: 18, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>Звериные уши и хвосты красятся в цвет волос — создайте кошку, лису или эльфа!</div>
              </>
            )}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
              <label className="label">Стартовые навыки класса</label>
              {skillsPreview.map((s) => <div key={s.id} style={{ fontSize: 12, color: "#d8d6e8", marginBottom: 3 }}><Ic v={s.icon} size="18px" /> <b>{s.name}</b></div>)}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Всего в дереве: 30 навыков (активные и пассивные)</div>
            </div>
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Имя героя" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
              <button className="btn" title="Случайная внешность" onClick={() => setApp(randomAppearance(gender))}>🎲</button>
            </div>
            {err && <div style={{ color: "#ff9a9a", fontSize: 13 }}>{err}</div>}
            <button className="btn btn-gold" style={{ padding: 14, fontSize: 16 }} disabled={busy} onClick={create}>{busy ? "Создание..." : "СОЗДАТЬ И ВОЙТИ В МИР"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
