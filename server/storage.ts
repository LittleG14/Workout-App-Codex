import { type User } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.googleId === googleId);
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.appleId === appleId);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      name: input.name,
      email: input.email,
      password: input.password ?? null,
      googleId: input.googleId ?? null,
      appleId: input.appleId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
