import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

/**
 * Supabase-generated passwords often contain special characters (e.g. @, #, +)
 * that break standard URL parsing. This encodes only the password portion so
 * the URL remains valid.
 */
export function encodeConnectionString(connStr: string): string {
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

const rawConn = process.env.SUPABASE_CONNECTION_STRING;

if (!rawConn) {
  throw new Error("SUPABASE_CONNECTION_STRING is not set");
}

const connectionString = encodeConnectionString(rawConn);

const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10,
  max: 5,
});

export const db = drizzle(client, { schema });
