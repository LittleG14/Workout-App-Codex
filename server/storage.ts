import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { workouts, feedback, customExercises, type WorkoutRow, type FeedbackRow, type CustomExerciseRow } from "@shared/schema";

export interface IStorage {
  saveWorkout(userId: string, workoutData: string, id: string, name: string, topCategory: string, createdAt: string): Promise<WorkoutRow>;
  getWorkouts(userId: string): Promise<WorkoutRow[]>;
  getWorkout(id: string, userId: string): Promise<WorkoutRow | undefined>;
  updateWorkout(id: string, userId: string, workoutData: string): Promise<WorkoutRow | undefined>;
  deleteWorkout(id: string, userId: string): Promise<void>;
  saveFeedback(userId: string, id: string, date: string, selection: string, category: string, submission: string): Promise<FeedbackRow>;
  getFeedback(userId: string): Promise<FeedbackRow[]>;
  saveCustomExercise(userId: string, id: string, name: string, muscles: string, equipment: string, type: string, topCategories: string, weightSubCategories: string, createdAt: string): Promise<CustomExerciseRow>;
  getCustomExercises(userId: string): Promise<CustomExerciseRow[]>;
  deleteCustomExercise(id: string, userId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async saveWorkout(
    userId: string,
    workoutData: string,
    id: string,
    name: string,
    topCategory: string,
    createdAt: string
  ): Promise<WorkoutRow> {
    const row = { id, userId, name, topCategory, data: workoutData, createdAt };
    await db.insert(workouts).values(row);
    return row;
  }

  async getWorkouts(userId: string): Promise<WorkoutRow[]> {
    return db
      .select()
      .from(workouts)
      .where(eq(workouts.userId, userId))
      .orderBy(workouts.createdAt);
  }

  async getWorkout(id: string, userId: string): Promise<WorkoutRow | undefined> {
    const rows = await db
      .select()
      .from(workouts)
      .where(eq(workouts.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || row.userId !== userId) return undefined;
    return row;
  }

  async updateWorkout(
    id: string,
    userId: string,
    workoutData: string
  ): Promise<WorkoutRow | undefined> {
    const existing = await this.getWorkout(id, userId);
    if (!existing) return undefined;
    await db
      .update(workouts)
      .set({ data: workoutData })
      .where(eq(workouts.id, id));
    return { ...existing, data: workoutData };
  }

  async deleteWorkout(id: string, userId: string): Promise<void> {
    const existing = await this.getWorkout(id, userId);
    if (!existing) return;
    await db.delete(workouts).where(eq(workouts.id, id));
  }

  async saveFeedback(
    userId: string,
    id: string,
    date: string,
    selection: string,
    category: string,
    submission: string
  ): Promise<FeedbackRow> {
    const row = { id, userId, date, selection, category, submission };
    await db.insert(feedback).values(row);
    return row;
  }

  async getFeedback(userId: string): Promise<FeedbackRow[]> {
    return db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.date));
  }

  async saveCustomExercise(
    userId: string,
    id: string,
    name: string,
    muscles: string,
    equipment: string,
    type: string,
    topCategories: string,
    weightSubCategories: string,
    createdAt: string
  ): Promise<CustomExerciseRow> {
    const row = { id, userId, name, muscles, equipment, type, topCategories, weightSubCategories, createdAt };
    await db.insert(customExercises).values(row);
    return row;
  }

  async getCustomExercises(userId: string): Promise<CustomExerciseRow[]> {
    return db
      .select()
      .from(customExercises)
      .where(eq(customExercises.userId, userId))
      .orderBy(customExercises.createdAt);
  }

  async deleteCustomExercise(id: string, userId: string): Promise<void> {
    const rows = await db.select().from(customExercises).where(eq(customExercises.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.userId !== userId) return;
    await db.delete(customExercises).where(eq(customExercises.id, id));
  }
}

export const storage = new DbStorage();
