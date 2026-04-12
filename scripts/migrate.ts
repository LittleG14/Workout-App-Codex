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
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      google_id TEXT UNIQUE,
      apple_id TEXT UNIQUE,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    )
  `;
  console.log("✓ users table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      top_category TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  console.log("✓ workouts table ready");

  await sql.end();
  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
