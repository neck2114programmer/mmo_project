import { sql } from "drizzle-orm";
import { db } from "@/db";

// Создаёт таблицы автоматически (если их ещё нет), чтобы игра запускалась локально
// без дополнительных шагов. Эквивалент `drizzle-kit push` для нашей схемы.
const g = globalThis as typeof globalThis & { __rpgSchemaReady?: Promise<void> };

export function ensureSchema(): Promise<void> {
  if (!g.__rpgSchemaReady) {
    g.__rpgSchemaReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now())`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY,
        user_id integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now())`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS characters (
        id serial PRIMARY KEY,
        user_id integer NOT NULL,
        name text NOT NULL UNIQUE,
        gender text NOT NULL,
        cls text NOT NULL,
        appearance jsonb NOT NULL,
        level integer NOT NULL DEFAULT 1,
        zone text NOT NULL DEFAULT 'meadow',
        x real NOT NULL DEFAULT 0,
        z real NOT NULL DEFAULT 0,
        ry real NOT NULL DEFAULT 0,
        moving boolean NOT NULL DEFAULT false,
        gear jsonb,
        state jsonb NOT NULL,
        last_seen timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now())`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS chat_messages (
        id serial PRIMARY KEY,
        channel text NOT NULL,
        zone text NOT NULL,
        char_name text NOT NULL,
        cls text NOT NULL,
        text text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now())`);
    })().catch((e) => {
      g.__rpgSchemaReady = undefined;
      throw e;
    });
  }
  return g.__rpgSchemaReady;
}
