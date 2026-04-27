import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { authMiddleware, type AuthRequest } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/workouts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rows = await storage.getWorkouts(req.userId!);
      const workouts = rows
        .map((row) => {
          try { return JSON.parse(row.data); } catch { return null; }
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
      const updated = await storage.updateWorkout(id, req.userId!, JSON.stringify(workout));
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

  app.post("/api/feedback", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { selection, category, submission } = req.body;
      if (!selection || !category || !submission) {
        res.status(400).json({ message: "selection, category, and submission are required" });
        return;
      }
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const date = new Date().toISOString();
      await storage.saveFeedback(req.userId!, id, date, selection, category, submission);
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("Save feedback error:", err);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
