import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const groupSettings = pgTable("group_settings", {
  groupId: varchar("group_id", { length: 100 }).primaryKey(),
  autoEnabled: boolean("auto_enabled").notNull().default(false),
  sensitivity: varchar("sensitivity", { length: 10 }).notNull().default("casual"),
  autoFormat: varchar("auto_format", { length: 10 }).notNull().default("both"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
