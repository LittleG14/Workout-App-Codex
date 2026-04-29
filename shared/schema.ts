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

export const customExercises = pgTable("custom_exercises", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  muscles: text("muscles").notNull(),
  equipment: text("equipment").notNull(),
  type: text("type").notNull(),
  topCategories: text("top_categories").notNull(),
  weightSubCategories: text("weight_sub_categories").notNull(),
  createdAt: text("created_at").notNull(),
});

export type InsertCustomExercise = typeof customExercises.$inferInsert;
export type CustomExerciseRow = typeof customExercises.$inferSelect;
