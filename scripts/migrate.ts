import postgres from "postgres";

function encodeConnectionString(connStr: string): string {
  const protoMatch = connStr.match(/^(postgresql|postgres):\/\//);
  if (!protoMatch) return connStr;

  const proto = protoMatch[0];
  const rest = connStr.slice(proto.length);

  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return connStr;

  const user = rest.slice(0, colonIdx);
  const afterUser = rest.slice(colonIdx + 1);

  const lastAtIdx = afterUser.lastIndexOf("@");
  if (lastAtIdx === -1) return connStr;

  const password = afterUser.slice(0, lastAtIdx);
  const hostAndDb = afterUser.slice(lastAtIdx + 1);

  return `${proto}${user}:${encodeURIComponent(password)}@${hostAndDb}`;
}

async function migrate() {
  const raw = process.env.SUPABASE_CONNECTION_STRING;
  if (!raw) throw new Error("SUPABASE_CONNECTION_STRING is not set");

  const connectionString = encodeConnectionString(raw);
  const sql = postgres(connectionString, { prepare: false });

  console.log("Running migrations...");

  await sql`
    ALTER TABLE workouts
      DROP CONSTRAINT IF EXISTS workouts_user_id_fkey
  `;
  console.log("✓ Dropped FK constraint workouts_user_id_fkey (if existed)");

  await sql`DROP TABLE IF EXISTS users CASCADE`;
  console.log("✓ Dropped users table (if existed)");

  await sql`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      top_category TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  console.log("✓ workouts table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      selection TEXT NOT NULL,
      category TEXT NOT NULL,
      submission TEXT NOT NULL
    )
  `;
  await sql`
    ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT ''
  `;
  console.log("✓ feedback table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS custom_exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      muscles TEXT NOT NULL,
      equipment TEXT NOT NULL,
      type TEXT NOT NULL,
      top_categories TEXT NOT NULL,
      weight_sub_categories TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  console.log("✓ custom_exercises table ready");

  await sql.end();
  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
