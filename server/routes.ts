import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import {
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
  type AuthRequest,
} from "./auth";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

function safeUser(user: any) {
  const { password: _p, googleId: _g, appleId: _a, ...safe } = user;
  return safe;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid input",
        });
        return;
      }

      const { name, email, password } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ message: "An account with this email already exists" });
        return;
      }

      const hashed = await hashPassword(password);
      const user = await storage.createUser({ name, email, password: hashed });

      const token = generateToken(user.id);
      res.status(201).json({ token, user: safeUser(user) });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid input",
        });
        return;
      }

      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      const token = generateToken(user.id);
      res.json({ token, user: safeUser(user) });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) {
        res.status(400).json({ message: "Access token required" });
        return;
      }

      const googleRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!googleRes.ok) {
        res.status(401).json({ message: "Invalid Google token" });
        return;
      }

      const googleUser = await googleRes.json() as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };

      let user = await storage.getUserByGoogleId(googleUser.id);

      if (!user) {
        user = await storage.getUserByEmail(googleUser.email);
        if (user) {
          user = await storage.updateUser(user.id, { googleId: googleUser.id }) ?? user;
        } else {
          user = await storage.createUser({
            name: googleUser.name,
            email: googleUser.email,
            googleId: googleUser.id,
            avatarUrl: googleUser.picture,
          });
        }
      }

      const token = generateToken(user.id);
      res.json({ token, user: safeUser(user) });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  app.post("/api/auth/apple", async (req, res) => {
    try {
      const { identityToken, fullName, email } = req.body;
      if (!identityToken) {
        res.status(400).json({ message: "Identity token required" });
        return;
      }

      const parts = identityToken.split(".");
      if (parts.length !== 3) {
        res.status(401).json({ message: "Invalid Apple token format" });
        return;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8")
      ) as { sub: string; email?: string };

      const appleId = payload.sub;
      const appleEmail = email || payload.email || "";

      let user = await storage.getUserByAppleId(appleId);

      if (!user) {
        if (appleEmail) {
          user = await storage.getUserByEmail(appleEmail);
          if (user) {
            user = await storage.updateUser(user.id, { appleId }) ?? user;
          }
        }

        if (!user) {
          const displayName =
            fullName
              ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
              : appleEmail.split("@")[0] || "Apple User";
          user = await storage.createUser({
            name: displayName,
            email: appleEmail,
            appleId,
          });
        }
      }

      const token = generateToken(user.id);
      res.json({ token, user: safeUser(user) });
    } catch (err) {
      console.error("Apple auth error:", err);
      res.status(500).json({ message: "Apple sign-in failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        res.status(401).json({ message: "User not found" });
        return;
      }
      res.json({ user: safeUser(user) });
    } catch (err) {
      console.error("Me error:", err);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/workouts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rows = await storage.getWorkouts(req.userId!);
      const workouts = rows
        .map((row) => {
          try {
            return JSON.parse(row.data);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();
      res.json({ workouts });
    } catch (err) {
      console.error("Get workouts error:", err);
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  app.post("/api/workouts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const workout = req.body;
      if (!workout || !workout.id) {
        res.status(400).json({ message: "Invalid workout data" });
        return;
      }
      await storage.saveWorkout(
        req.userId!,
        JSON.stringify(workout),
        workout.id,
        workout.name || "Workout",
        workout.topCategory || "weight_lifting",
        workout.createdAt || new Date().toISOString()
      );
      res.status(201).json({ ok: true });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.json({ ok: true });
        return;
      }
      console.error("Save workout error:", err);
      res.status(500).json({ message: "Failed to save workout" });
    }
  });

  app.put("/api/workouts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workout = req.body;
      if (!workout) {
        res.status(400).json({ message: "Invalid workout data" });
        return;
      }
      const updated = await storage.updateWorkout(
        id,
        req.userId!,
        JSON.stringify(workout)
      );
      if (!updated) {
        res.status(404).json({ message: "Workout not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Update workout error:", err);
      res.status(500).json({ message: "Failed to update workout" });
    }
  });

  app.delete("/api/workouts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWorkout(id, req.userId!);
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete workout error:", err);
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
