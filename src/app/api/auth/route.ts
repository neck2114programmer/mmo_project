import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { createSession, destroySession, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    return Response.json({ user });
  } catch {
    return Response.json({ user: null });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = (await req.json()) as { action?: string; username?: string; password?: string };
    const action = body.action;
    if (action === "logout") {
      await destroySession();
      return Response.json({ ok: true });
    }
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(username)) {
      return Response.json({ error: "Логин: 3–20 символов (буквы, цифры, _ или -)" }, { status: 400 });
    }
    if (password.length < 6 || password.length > 100) {
      return Response.json({ error: "Пароль должен содержать минимум 6 символов" }, { status: 400 });
    }
    if (action === "register") {
      const exists = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (exists.length) return Response.json({ error: "Такой логин уже занят" }, { status: 409 });
      const passwordHash = await bcrypt.hash(password, 10);
      const [row] = await db.insert(users).values({ username, passwordHash }).returning({ id: users.id });
      await createSession(row.id);
      return Response.json({ ok: true, username });
    }
    if (action === "login") {
      const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
      const u = rows[0];
      if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
        return Response.json({ error: "Неверный логин или пароль" }, { status: 401 });
      }
      await createSession(u.id);
      return Response.json({ ok: true, username });
    }
    return Response.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Ошибка сервера. Проверьте подключение к базе данных." }, { status: 500 });
  }
}
