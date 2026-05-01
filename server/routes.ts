import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import { authMiddleware, type AuthRequest } from "./auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.warn("WARNING: RESEND_API_KEY is not set — confirmation emails will not be sent.");
}

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  : null;

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
      await storage.saveFeedback(req.userId!, req.userEmail ?? "", id, date, selection, category, submission);

      // Admin notification email — fires and forgets, never blocks the response
      resend.emails.send({
        from: "Swole House <noreply@swolehousefitness.com>",
        to: "swolehousefitness@gmail.com",
        subject: `[Feedback] ${escapeHtml(selection)} — ${escapeHtml(category)}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f0f0f0;border-radius:12px;overflow:hidden;">
            <div style="background:#C0392B;padding:24px 32px;">
              <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:1px;">SWOLE HOUSE — New Feedback</h1>
            </div>
            <div style="padding:32px;">
              <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
                <tr>
                  <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;width:110px;">From</td>
                  <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:14px;">${escapeHtml(req.userEmail ?? "Unknown")}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background:#222;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Type</td>
                  <td style="padding:10px 14px;background:#222;color:#fff;font-size:14px;">${escapeHtml(selection)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background:#1a1a1a;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Category</td>
                  <td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:14px;">${escapeHtml(category)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background:#222;border-radius:0 0 6px 6px;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Message</td>
                  <td style="padding:10px 14px;background:#222;border-radius:0 0 6px 6px;color:#fff;font-size:14px;">${escapeHtml(submission)}</td>
                </tr>
              </table>
              <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #333;padding-top:16px;">Submitted ${new Date(date).toLocaleString()} · User ID: ${escapeHtml(req.userId ?? "")}</p>
            </div>
          </div>
        `,
      }).catch((err: unknown) => {
        console.error("Failed to send admin notification email:", err);
      });

      if (req.userEmail) {
        resend.emails.send({
          from: "Swole House <noreply@swolehousefitness.com>",
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

  app.get("/api/admin/is-admin", authMiddleware, async (req: AuthRequest, res) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const isAdmin = adminEmails.length > 0 && !!req.userEmail && adminEmails.includes(req.userEmail);
    res.json({ isAdmin });
  });

  app.get("/api/admin/feedback", authMiddleware, async (req: AuthRequest, res) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length === 0 || !req.userEmail || !adminEmails.includes(req.userEmail)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    try {
      const rows = await storage.getAllFeedback();
      res.json({ feedback: rows });
    } catch (err) {
      console.error("Admin get feedback error:", err);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.get("/api/admin/email-domain-status", authMiddleware, async (req: AuthRequest, res) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length === 0 || !req.userEmail || !adminEmails.includes(req.userEmail)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ error: "RESEND_API_KEY not configured" });
      return;
    }
    try {
      const listResponse = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (!listResponse.ok) {
        res.status(502).json({ error: `Resend API error: ${listResponse.status} ${listResponse.statusText}` });
        return;
      }
      const listData = (await listResponse.json()) as { data?: Array<{ name: string; status: string; id: string }> };
      const domainEntry = listData.data?.find((d) => d.name === "swolehousefitness.com");
      if (!domainEntry) {
        res.json({
          domain: "swolehousefitness.com",
          status: "not_registered",
          message: "Domain not yet added to Resend.",
        });
        return;
      }

      const detailResponse = await fetch(`https://api.resend.com/domains/${domainEntry.id}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (!detailResponse.ok) {
        res.status(502).json({ error: `Resend domain detail error: ${detailResponse.status} ${detailResponse.statusText}` });
        return;
      }
      type ResendRecord = { record: string; name: string; type: string; value: string; status: string; ttl: string; priority?: number };
      const detail = (await detailResponse.json()) as { id: string; name: string; status: string; records: ResendRecord[] };

      res.json({
        domain: detail.name,
        id: detail.id,
        status: detail.status,
        verified: detail.status === "verified",
        message:
          detail.status === "verified"
            ? "Domain is verified. Emails from noreply@swolehousefitness.com will send."
            : "Domain is registered but not yet verified. Add the DNS records below and wait for propagation (up to 48h).",
        dns_records_needed: detail.status !== "verified" ? detail.records : undefined,
      });
    } catch (err) {
      console.error("Email domain status check failed:", err);
      res.status(500).json({ error: "Failed to check domain status" });
    }
  });

  app.post("/api/admin/verify-domain", authMiddleware, async (req: AuthRequest, res) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length === 0 || !req.userEmail || !adminEmails.includes(req.userEmail)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ error: "RESEND_API_KEY not configured" });
      return;
    }
    try {
      const verifyResponse = await fetch(
        `https://api.resend.com/domains/93993891-8d5a-475a-a151-da57bf113e64/verify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        }
      );
      if (!verifyResponse.ok) {
        const body = await verifyResponse.text();
        res.status(502).json({ error: `Resend verify error: ${verifyResponse.status}`, detail: body });
        return;
      }
      const data = await verifyResponse.json();
      res.json({ ok: true, data });
    } catch (err) {
      console.error("Domain verification trigger failed:", err);
      res.status(500).json({ error: "Failed to trigger domain verification" });
    }
  });

  app.post("/api/admin/send-test-email", authMiddleware, async (req: AuthRequest, res) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length === 0 || !req.userEmail || !adminEmails.includes(req.userEmail)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ error: "RESEND_API_KEY not configured" });
      return;
    }
    const to: string = req.body?.to || req.userEmail;
    if (!to) {
      res.status(400).json({ error: "No recipient email address provided" });
      return;
    }
    try {
      const { data, error } = await resend.emails.send({
        from: "Swole House <noreply@swolehousefitness.com>",
        to,
        subject: "Swole House — test email delivery",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f0f0f0;border-radius:12px;overflow:hidden;">
            <div style="background:#C0392B;padding:24px 32px;">
              <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:1px;">SWOLE HOUSE</h1>
            </div>
            <div style="padding:32px;">
              <h2 style="margin-top:0;color:#fff;font-size:18px;">Email delivery confirmed!</h2>
              <p style="color:#ccc;line-height:1.6;">This is a test email sent from <strong>noreply@swolehousefitness.com</strong> via Resend to verify the domain is verified and delivering correctly.</p>
              <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #333;padding-top:16px;">Sent by admin test tool. You can ignore this email.</p>
            </div>
          </div>
        `,
      });
      if (error) {
        res.status(502).json({ error: "Resend rejected the email", detail: error.message });
        return;
      }
      res.json({ ok: true, id: data?.id ?? null });
    } catch (err) {
      console.error("Test email send failed:", err);
      res.status(500).json({ error: "Failed to send test email", detail: String(err) });
    }
  });

  app.get("/api/exercises", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rows = await storage.getCustomExercises(req.userId!);
      const exercises = rows.map((row) => ({
        id: row.id,
        name: row.name,
        muscles: JSON.parse(row.muscles),
        equipment: row.equipment,
        type: row.type,
        topCategories: JSON.parse(row.topCategories),
        weightSubCategories: JSON.parse(row.weightSubCategories),
        createdAt: row.createdAt,
      }));
      res.json({ exercises });
    } catch (err) {
      console.error("Get custom exercises error:", err);
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  app.post("/api/exercises", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, muscles, equipment, type, topCategories, weightSubCategories } = req.body;
      if (!name || !muscles || !equipment || !type || !topCategories) {
        res.status(400).json({ message: "name, muscles, equipment, type, and topCategories are required" });
        return;
      }
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 40) {
        res.status(400).json({ message: "name must be between 1 and 40 characters" });
        return;
      }
      if (!Array.isArray(topCategories) || topCategories.length === 0) {
        res.status(400).json({ message: "At least one category is required" });
        return;
      }
      if (!Array.isArray(muscles) || muscles.length === 0) {
        res.status(400).json({ message: "At least one muscle group is required" });
        return;
      }
      if (type !== "compound" && type !== "isolation") {
        res.status(400).json({ message: "type must be compound or isolation" });
        return;
      }
      const id = "cx_" + Date.now().toString() + Math.random().toString(36).substr(2, 6);
      const createdAt = new Date().toISOString();
      await storage.saveCustomExercise(
        req.userId!,
        id,
        name.trim(),
        JSON.stringify(muscles),
        equipment,
        type,
        JSON.stringify(topCategories),
        JSON.stringify(weightSubCategories ?? []),
        createdAt
      );
      res.status(201).json({
        exercise: {
          id,
          name: name.trim(),
          muscles,
          equipment,
          type,
          topCategories,
          weightSubCategories: weightSubCategories ?? [],
          createdAt,
        },
      });
    } catch (err) {
      console.error("Save custom exercise error:", err);
      res.status(500).json({ message: "Failed to save exercise" });
    }
  });

  app.delete("/api/exercises/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomExercise(id, req.userId!);
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete custom exercise error:", err);
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  app.delete("/api/account", authMiddleware, async (req: AuthRequest, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ message: "Account deletion is not configured on this server." });
      return;
    }
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(req.userId!);
      if (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: "Failed to delete account." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete account error:", err);
      res.status(500).json({ message: "Failed to delete account." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
