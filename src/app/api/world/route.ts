import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { characters, chatMessages } from "@/db/schema";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Синхронизация мира: позиции других игроков + чат (опрос раз в ~1 сек)
export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    await ensureSchema();
    const b = (await req.json()) as {
      id: number; zone: string; x: number; z: number; ry: number; mv: boolean; since: number;
      gear?: Record<string, string>; send?: { channel: string; text: string };
    };
    const rows = await db.select().from(characters).where(and(eq(characters.id, Number(b.id)), eq(characters.userId, user.id))).limit(1);
    const me = rows[0];
    if (!me) return Response.json({ error: "not found" }, { status: 404 });
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
    await db
      .update(characters)
      .set({ zone: String(b.zone).slice(0, 12), x: num(b.x), z: num(b.z), ry: num(b.ry), moving: !!b.mv, gear: b.gear ?? me.gear, lastSeen: new Date() })
      .where(eq(characters.id, me.id));

    if (b.send && typeof b.send.text === "string") {
      const text = b.send.text.trim().slice(0, 200);
      if (text) {
        const channel = ["world", "zone"].includes(b.send.channel) ? b.send.channel : "zone";
        await db.insert(chatMessages).values({ channel, zone: String(b.zone).slice(0, 12), charName: me.name, cls: me.cls, text });
        if (Math.random() < 0.02) await db.delete(chatMessages).where(sql`created_at < now() - interval '2 hours'`);
      }
    }

    const since = Number(b.since) || 0;
    let msgs;
    if (since <= 0) {
      msgs = (await db.select().from(chatMessages).orderBy(desc(chatMessages.id)).limit(25)).reverse();
    } else {
      msgs = await db.select().from(chatMessages).where(gt(chatMessages.id, since)).orderBy(chatMessages.id).limit(50);
    }
    msgs = msgs.filter((m) => m.channel === "world" || m.zone === b.zone);

    const cutoff = new Date(Date.now() - 8000);
    const others = await db
      .select({
        id: characters.id, name: characters.name, cls: characters.cls, gender: characters.gender, level: characters.level,
        appearance: characters.appearance, x: characters.x, z: characters.z, ry: characters.ry, moving: characters.moving, gear: characters.gear,
      })
      .from(characters)
      .where(and(eq(characters.zone, String(b.zone)), gt(characters.lastSeen, cutoff), ne(characters.id, me.id)))
      .limit(40);
    const last = await db.select({ id: chatMessages.id }).from(chatMessages).orderBy(desc(chatMessages.id)).limit(1);
    return Response.json({
      players: others,
      chat: msgs.map((m) => ({ id: m.id, channel: m.channel, name: m.charName, cls: m.cls, text: m.text })),
      lastChatId: last[0]?.id ?? 0,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
