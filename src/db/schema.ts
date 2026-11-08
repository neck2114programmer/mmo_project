import { pgTable, serial, text, integer, timestamp, jsonb, real, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().unique(),
  gender: text("gender").notNull(),
  cls: text("cls").notNull(),
  appearance: jsonb("appearance").notNull(),
  level: integer("level").notNull().default(1),
  zone: text("zone").notNull().default("meadow"),
  x: real("x").notNull().default(0),
  z: real("z").notNull().default(0),
  ry: real("ry").notNull().default(0),
  moving: boolean("moving").notNull().default(false),
  gear: jsonb("gear"),
  state: jsonb("state").notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  zone: text("zone").notNull(),
  charName: text("char_name").notNull(),
  cls: text("cls").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
