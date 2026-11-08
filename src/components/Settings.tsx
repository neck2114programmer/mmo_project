"use client";
import { useEffect, useState } from "react";
import { PRESETS, useGame, type GfxSettings } from "@/game/store";
import { audio, TRACKS } from "@/game/audio";

const Q: [GfxSettings["quality"], string][] = [["low", "Низкая"], ["medium", "Средняя"], ["high", "Высокая"], ["ultra", "Ультра"]];
const RES = ["auto", "1280x720", "1600x900", "1920x1080", "2560x1440"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontSize: 13, color: "#d8d6e8" }}>{label}</span><div style={{ display: "flex", gap: 6, alignItems: "center" }}>{children}</div></div>;
}
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${on ? "#e6c27a" : "rgba(255,255,255,0.18)"}`, background: on ? "rgba(230,194,122,0.22)" : "rgba(0,0,0,0.3)", color: on ? "#ffe9a8" : "#cfd0e0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{children}</button>
);
const Slider = ({ v, min, max, step, onChange, fmt }: { v: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) => (
  <><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 150, accentColor: "#e6c27a" }} /><span style={{ width: 46, textAlign: "right", fontSize: 12, color: "#ffe9a8" }}>{fmt(v)}</span></>
);

export function SettingsWindow({ onClose }: { onClose: () => void }) {
  const s = useGame((x) => x.settings), set = useGame((x) => x.setSettings), track = useGame((x) => x.track);
  const [full, setFull] = useState(false);
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", f); f(); return () => document.removeEventListener("fullscreenchange", f); }, []);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => {}); };
  return (
    <div className="frame" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 520, maxHeight: "86vh", overflowY: "auto", padding: 18, zIndex: 50 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="title-font" style={{ fontSize: 22, color: "var(--gold-l)" }}>⚙ Настройки</div>
        <button className="btn" onClick={onClose} style={{ padding: "4px 12px" }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: "#9a9ab8", margin: "6px 0 2px", fontWeight: 800, letterSpacing: "0.08em" }}>ГРАФИКА</div>
      <Row label="Качество (пресет)">{Q.map(([k, n]) => <Chip key={k} on={s.quality === k} onClick={() => set({ quality: k, ...PRESETS[k] })}>{n}</Chip>)}</Row>
      <Row label="Разрешение экрана (рендер)">
        <select value={s.fixed} onChange={(e) => set({ fixed: e.target.value })} style={{ background: "#14162a", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px" }}>
          {RES.map((r) => <option key={r} value={r}>{r === "auto" ? "Авто (по окну)" : r}</option>)}
        </select>
      </Row>
      <Row label="Масштаб рендера"><Slider v={s.res} min={0.5} max={1.5} step={0.05} onChange={(n) => set({ res: n, fixed: "auto" })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
      <Row label="Дальность прорисовки"><Slider v={s.view} min={0.4} max={1.5} step={0.05} onChange={(n) => set({ view: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
      <Row label="Тени"><Chip on={s.shadows} onClick={() => set({ shadows: !s.shadows })}>{s.shadows ? "Вкл" : "Выкл"}</Chip></Row>
      <Row label="Свечение (bloom)"><Chip on={s.bloom} onClick={() => set({ bloom: !s.bloom })}>{s.bloom ? "Вкл" : "Выкл"}</Chip></Row>
      <Row label="Лимит FPS">{[0, 30, 60].map((f) => <Chip key={f} on={s.fps === f} onClick={() => set({ fps: f })}>{f === 0 ? "Без лимита" : f}</Chip>)}</Row>
      <Row label="Автоснижение графики при лагах"><Chip on={s.auto} onClick={() => set({ auto: !s.auto })}>{s.auto ? "Вкл" : "Выкл"}</Chip></Row>
      <Row label="Полный экран"><Chip on={full} onClick={toggleFull}>{full ? "Выйти" : "Включить"}</Chip></Row>
      <div style={{ fontSize: 12, color: "#9a9ab8", margin: "14px 0 2px", fontWeight: 800, letterSpacing: "0.08em" }}>ЗВУК</div>
      <Row label="Общая громкость"><Slider v={s.master} min={0} max={1} step={0.05} onChange={(n) => set({ master: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
      <Row label="Музыка"><Slider v={s.music} min={0} max={1} step={0.05} onChange={(n) => set({ music: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
      <Row label="Звуки боя и мира"><Slider v={s.sfx} min={0} max={1} step={0.05} onChange={(n) => set({ sfx: n })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
      <Row label={`Сейчас играет: ${track || "—"}`}>
        <select value={audio.current} onChange={(e) => { audio.resume(); audio.play(e.target.value); }} style={{ background: "#14162a", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px", maxWidth: 190 }}>
          {Object.entries(TRACKS).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
      </Row>
      <div style={{ fontSize: 11, color: "#8a8aa6", marginTop: 10 }}>Совет: на ноутбуках выберите «Низкая» или «Средняя», уменьшите масштаб рендера и ограничьте FPS до 30–60.</div>
    </div>
  );
}

const fmtTime = (tod: number) => { const m = Math.floor(tod * 24 * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

export function EventsWidget() {
  const events = useGame((x) => x.events), tod = useGame((x) => x.tod), ui = useGame((x) => x.ui), toggle = useGame((x) => x.toggleUi);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const hour = tod * 24, night = hour >= 20 || hour < 5.5, active = events.filter((e) => e.status === "active").length;
  return (
    <>
      <div style={{ position: "absolute", right: 16, top: 300, display: "flex", gap: 6, alignItems: "center" }}>
        <div className="frame" style={{ padding: "4px 10px", fontSize: 13, fontWeight: 800 }}>{night ? "🌙" : hour < 8 || hour > 18 ? "🌅" : "☀️"} {fmtTime(tod)}</div>
        <div className="menu-btn" style={{ width: 34, height: 34, fontSize: 17, position: "relative", boxShadow: active ? "0 0 14px #ff6a3a" : undefined, borderColor: active ? "#ff8a4a" : undefined }} onClick={() => toggle("events")} title="События (J)">
          📯{active > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: "#e0382a", color: "#fff", borderRadius: 9, fontSize: 10, padding: "0 5px", fontWeight: 900 }}>{active}</span>}
        </div>
        <div className="menu-btn" style={{ width: 34, height: 34, fontSize: 17 }} onClick={() => toggle("settings")} title="Настройки (O)">⚙️</div>
      </div>
      {ui.events && (
        <div className="frame" style={{ position: "absolute", right: 16, top: 342, width: 320, padding: 12, zIndex: 40 }}>
          <div className="title-font" style={{ color: "var(--gold-l)", fontSize: 16, marginBottom: 6 }}>📯 События мира</div>
          {events.length === 0 && <div style={{ fontSize: 12, color: "#a8a8c4", lineHeight: 1.5 }}>Сейчас всё спокойно. Ночью (20:00–05:30) на поселения нападают налётчики и выходят ночные охотники — о каждом событии придёт уведомление в чат. Страж защищает города, а ваша помощь будет вознаграждена!</div>}
          {events.map((e) => (
            <div key={e.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 800, color: e.status === "active" ? "#ff9a5a" : e.status === "done" ? "#7dff9a" : "#9a9ab0" }}>{e.status === "active" ? "⚔" : e.status === "done" ? "✔" : "✖"} {e.title}</div>
              <div style={{ fontSize: 12, color: "#c8c8dc" }}>{e.desc}</div>
              <div style={{ fontSize: 12, color: "#ffe9a8", marginTop: 3 }}>{e.info}{e.status === "active" ? ` • осталось ${Math.max(0, Math.round((e.ends - Date.now()) / 1000))} с` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
