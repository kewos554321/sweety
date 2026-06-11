import { pgTable, varchar, boolean, timestamp, serial, text, unique } from "drizzle-orm/pg-core";

export const groupSettings = pgTable("group_settings", {
  groupId: varchar("group_id", { length: 100 }).primaryKey(),
  autoEnabled: boolean("auto_enabled").notNull().default(false),
  sensitivity: varchar("sensitivity", { length: 10 }).notNull().default("casual"),
  autoFormat: varchar("auto_format", { length: 10 }).notNull().default("both"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companions = pgTable("companions", {
  id: serial("id").primaryKey(),
  lineUserId: varchar("line_user_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 20 }).notNull(),
  personality: text("personality").notNull(),
  avatar: varchar("avatar", { length: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueNamePerUser: unique().on(t.lineUserId, t.name),
}));

export type Companion = typeof companions.$inferSelect;
export type NewCompanion = typeof companions.$inferInsert;
