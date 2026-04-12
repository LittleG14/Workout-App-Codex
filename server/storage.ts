import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, workouts, type User, type WorkoutRow } from "@shared/schema";
import { randomUUID } from "crypto";

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  appleId?: string;
  avatarUrl?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  saveWorkout(userId: string, workoutData: string, id: string, name: string, topCategory: string, createdAt: string): Promise<WorkoutRow>;
  getWorkouts(userId: string): Promise<WorkoutRow[]>;
  getWorkout(id: string, userId: string): Promise<WorkoutRow | undefined>;
  updateWorkout(id: string, userId: string, workoutData: string): Promise<WorkoutRow | undefined>;
  deleteWorkout(id: string, userId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return rows[0];
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.appleId, appleId))
      .limit(1);
    return rows[0];
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const id = randomUUID();
    const user = {
      id,
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.password ?? null,
      googleId: input.googleId ?? null,
      appleId: input.appleId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(users).values(user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    await db.update(users).set(updates).where(eq(users.id, id));
    return this.getUser(id);
  }

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
}

export const storage = new DbStorage();
