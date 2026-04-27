import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { authMiddleware, type AuthRequest } from "./auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.warn("WARNING: RESEND_API_KEY is not set — confirmation emails will not be sent.");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

  const VALID_FEEDBACK_CATEGORIES: Record<string, string[]> = {
    "Exercise Request": ["Weights", "Circuit", "Yoga", "Cardio", "Mobility"],
    "App Functionality": ["Workout Structure", "Feature Problems", "Profile Issues"],
    "General Feedback": ["General Feedback"],
  };

  app.get("/api/feedback", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rows = await storage.getFeedback(req.userId!);
      res.json({ feedback: rows });
    } catch (err) {
      console.error("Get feedback error:", err);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { selection, category, submission } = req.body;
      if (!selection || !category || !submission) {
        res.status(400).json({ message: "selection, category, and submission are required" });
        return;
      }
      const validCategories = VALID_FEEDBACK_CATEGORIES[selection];
      if (!validCategories) {
        res.status(400).json({ message: "Invalid selection value" });
        return;
      }
      if (!validCategories.includes(category)) {
        res.status(400).json({ message: "Invalid category for the given selection" });
        return;
      }
      if (selection === "Exercise Request" && submission.length > 40) {
        res.status(400).json({ message: "Exercise Request submissions must be 40 characters or fewer" });
        return;
      }
      const id = crypto.randomUUID();
      const date = new Date().toISOString();
      await storage.saveFeedback(req.userId!, id, date, selection, category, submission);

      if (req.userEmail) {
        resend.emails.send({
          from: "Swole House <onboarding@resend.dev>",
          to: req.userEmail,
          subject: "We received your feedback!",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f0f0f0;border-radius:12px;overflow:hidden;">
              <div style="background:#C0392B;padding:24px 32px;">
                <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:1px;">SWOLE HOUSE</h1>
              </div>
              <div style="padding:32px;">
                <h2 style="margin-top:0;color:#fff;font-size:18px;">Thanks for your feedback!</h2>
                <p style="color:#ccc;line-height:1.6;">We've received your submission and our team will review it shortly. Here's a summary of what you sent:</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                  <tr>
                    <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Type</td>
                    <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:14px;">${escapeHtml(selection)}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;background:#222;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Category</td>
                    <td style="padding:10px 14px;background:#222;color:#fff;font-size:14px;">${escapeHtml(category)}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;background:#1a1a1a;border-radius:0 0 6px 6px;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Your Message</td>
                    <td style="padding:10px 14px;background:#1a1a1a;border-radius:0 0 6px 6px;color:#fff;font-size:14px;">${escapeHtml(submission)}</td>
                  </tr>
                </table>
                <p style="color:#ccc;line-height:1.6;">We appreciate you taking the time to help us improve. Stay strong!</p>
                <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #333;padding-top:16px;">This is an automated confirmation. Please do not reply to this email.</p>
              </div>
            </div>
          `,
        }).catch((err: unknown) => {
          console.error("Failed to send confirmation email:", err);
        });
      }

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("Save feedback error:", err);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
