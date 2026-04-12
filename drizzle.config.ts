import { defineConfig } from "drizzle-kit";

if (!process.env.SUPABASE_CONNECTION_STRING) {
  throw new Error("SUPABASE_CONNECTION_STRING is not set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_CONNECTION_STRING,
  },
});
