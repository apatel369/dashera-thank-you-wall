import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

const databaseUrl = process.env.PREVIEW_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
const sql = neon(databaseUrl);

await sql.query(
  "CREATE TABLE IF NOT EXISTS wall_state (" +
  " id SMALLINT PRIMARY KEY CHECK (id = 1)," +
  " mode TEXT NOT NULL CHECK (mode IN ('qr', 'wall', 'burn'))," +
  " session TEXT NOT NULL," +
  " changed_at BIGINT NOT NULL" +
  ")",
);
await sql.query("ALTER TABLE wall_state ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT false");
await sql.query("ALTER TABLE wall_state ADD COLUMN IF NOT EXISTS wifi_visible BOOLEAN NOT NULL DEFAULT false");
await sql.query("ALTER TABLE wall_state ADD COLUMN IF NOT EXISTS saved_mode TEXT");
await sql.query("ALTER TABLE wall_state ADD COLUMN IF NOT EXISTS saved_session TEXT");
await sql.query("ALTER TABLE wall_state ADD COLUMN IF NOT EXISTS saved_changed_at BIGINT");
await sql.query("ALTER TABLE wall_state DROP CONSTRAINT IF EXISTS wall_state_mode_check");
await sql.query("ALTER TABLE wall_state ADD CONSTRAINT wall_state_mode_check CHECK (mode IN ('qr', 'wall', 'scroll', 'burn'))");
await sql.query(
  "CREATE TABLE IF NOT EXISTS wall_notes (" +
  " id BIGINT PRIMARY KEY," +
  " session TEXT NOT NULL," +
  " payload JSONB NOT NULL," +
  " created_at TIMESTAMPTZ NOT NULL," +
  " approval_batch TEXT" +
  ")",
);
await sql.query(
  "CREATE INDEX IF NOT EXISTS wall_notes_session_created_idx ON wall_notes (session, created_at, id)",
);
await sql.query(
  "CREATE TABLE IF NOT EXISTS wall_approval_batches (" +
  " id TEXT PRIMARY KEY," +
  " session TEXT NOT NULL," +
  " note_ids JSONB NOT NULL," +
  " created_at BIGINT NOT NULL" +
  ")",
);
await sql.query(
  "CREATE INDEX IF NOT EXISTS wall_approval_batches_session_created_idx" +
  " ON wall_approval_batches (session, created_at, id)",
);
await sql.query(
  "CREATE TABLE IF NOT EXISTS rate_limits (" +
  " key TEXT PRIMARY KEY," +
  " hits INTEGER NOT NULL," +
  " window_start BIGINT NOT NULL" +
  ")",
);
await sql.query(
  "INSERT INTO wall_state (id, mode, session, changed_at) VALUES (1, 'wall', $1, $2)" +
  " ON CONFLICT (id) DO NOTHING",
  [randomBytes(8).toString("hex"), Date.now()],
);
console.log("Wall database schema is ready.");
