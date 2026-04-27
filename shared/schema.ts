import { pgTable, text } from "drizzle-orm/pg-core";

export const workouts = pgTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  topCategory: text("top_category").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export type InsertWorkout = typeof workouts.$inferInsert;
export type WorkoutRow = typeof workouts.$inferSelect;

export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  selection: text("selection").notNull(),
  category: text("category").notNull(),
  submission: text("submission").notNull(),
});

export type InsertFeedback = typeof feedback.$inferInsert;
export type FeedbackRow = typeof feedback.$inferSelect;
