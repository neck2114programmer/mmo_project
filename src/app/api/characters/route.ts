import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { characters } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { CLASS_IDS, type ClassId } from "@/game/types";
import { newPlayerState, sanitizeState } from "@/game/logic";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;
function cleanAppearance(a: Record<string, unknown>) {
  const num = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const int = (v: unknown, max: number, d: number) => Math.floor(num(v, 0, max, d));
  const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    skin: hex(a.skin, "#f9d2b4"), hair: int(a.hair, 9, 0), hairColor: hex(a.hairColor, "#3a2418"), eyeColor: hex(a.eyeColor, "#2b7de0"),
    eyeStyle: int(a.eyeStyle, 5, 0), brow: int(a.brow, 3, 0), ears: int(a.ears, 3, 0), tail: int(a.tail, 2, 0), mark: int(a.mark, 4, 0),
    markColor: hex(a.markColor, "#ff4d4d"), height: num(a.height, 0, 1, 0.5), build: num(a.build, 0, 1, 0.5), bust: num(a.bust, 0, 1, 0.5),
    headSize: num(a.headSize, 0, 1, 0.5), eyeSize: num(a.eyeSize, 0, 1, 0.5), accent: hex(a.accent, "#c0392b"),
  };
}

export async function GET(req: Request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const rows = await db.select().from(characters).where(and(eq(characters.id, Number(id)), eq(characters.userId, user.id))).limit(1);
      if (!rows[0]) return Response.json({ error: "Персонаж не найден" }, { status: 404 });
      return Response.json({ character: rows[0] });
    }
    const rows = await db
      .select({ id: characters.id, name: characters.name, gender: characters.gender, cls: characters.cls, level: characters.level, appearance: characters.appearance, zone: characters.zone })
      .from(characters)
      .where(eq(characters.userId, user.id))
      .orderBy(characters.id);
    return Response.json({ user, characters: rows });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const body = (await req.json()) as { name?: string; gender?: string; cls?: string; appearance?: Record<string, unknown> };
    const name = (body.name ?? "").trim();
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(name)) return Response.json({ error: "Имя: 3–16 символов (буквы, цифры, _ или -)" }, { status: 400 });
    if (body.gender !== "male" && body.gender !== "female") return Response.json({ error: "Выберите пол" }, { status: 400 });
    if (!CLASS_IDS.includes(body.cls as ClassId)) return Response.json({ error: "Выберите класс" }, { status: 400 });
    const [{ n }] = await db.select({ n: count() }).from(characters).where(eq(characters.userId, user.id));
    if (n >= 6) return Response.json({ error: "Максимум 6 персонажей на аккаунте" }, { status: 400 });
    const dup = await db.select({ id: characters.id }).from(characters).where(eq(characters.name, name)).limit(1);
    if (dup.length) return Response.json({ error: "Это имя уже занято" }, { status: 409 });
    const cls = body.cls as ClassId;
    const state = newPlayerState(cls);
    const [row] = await db
      .insert(characters)
      .values({ userId: user.id, name, gender: body.gender, cls, appearance: cleanAppearance(body.appearance ?? {}), state, x: state.x, z: state.z, gear: state.equipment })
      .returning({ id: characters.id });
    return Response.json({ ok: true, id: row.id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const body = (await req.json()) as { id?: number; state?: unknown };
    const rows = await db.select().from(characters).where(and(eq(characters.id, Number(body.id)), eq(characters.userId, user.id))).limit(1);
    const ch = rows[0];
    if (!ch) return Response.json({ error: "Персонаж не найден" }, { status: 404 });
    const state = sanitizeState(body.state, ch.cls as ClassId);
    if (!state) return Response.json({ error: "bad state" }, { status: 400 });
    await db
      .update(characters)
      .set({ state, level: state.level, zone: state.zone, x: state.x, z: state.z, ry: state.ry, gear: state.equipment, lastSeen: new Date() })
      .where(eq(characters.id, ch.id));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const id = Number(new URL(req.url).searchParams.get("id"));
    await db.delete(characters).where(and(eq(characters.id, id), eq(characters.userId, user.id)));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
