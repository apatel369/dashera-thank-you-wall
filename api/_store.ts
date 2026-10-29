import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

export type WallMode = "qr" | "wall" | "scroll" | "burn";
export type WallState = { mode: WallMode; session: string; changedAt: number; testMode: boolean; wifiVisible: boolean };
export type ApprovalBatch = { id: string; noteIds: number[]; createdAt: number };
export type Submission = {
  id: number;
  message: string;
  colorStyle: "golden" | "rose" | "deepBlue" | "forestGreen";
  fontStyle: string;
  borderStyle: string;
  texture: "plain" | "ruled" | "dotted";
  fontColor: "warm" | "crimson" | "indigo" | "forest" | "ink";
  symbol: "none" | "namaste" | "heart" | "hug";
  hidden: false;
  whisperApproved: false;
  createdAt: string;
};

const initialState: WallState = { mode: "wall", session: "initial", changedAt: 0, testMode: false, wifiVisible: false };

export class WallConflictError extends Error {}

const DEMO_MESSAGES = [
  "Let kindness lead today", "Leave anger behind", "Choose patience over pride",
  "Carry gratitude forward", "Listen with an open heart", "Celebrate the good in others",
  "Let courage replace fear", "Share a moment of joy", "Make room for forgiveness",
  "Speak with compassion", "Release what weighs you down", "Welcome a fresh beginning",
  "Offer help without asking", "Remember the strength of community", "Let hope shine brightly",
  "Choose humility today", "Turn a challenge into growth", "Be generous with your time",
  "Find peace in the present", "Bring light to someone’s day",
];

function demoNotes(): Submission[] {
  const ids = new Set<number>();
  const colors: Submission["colorStyle"][] = ["golden", "rose", "deepBlue", "forestGreen"];
  const textures: Submission["texture"][] = ["plain", "ruled", "dotted"];
  const inks: Submission["fontColor"][] = ["warm", "crimson", "indigo", "forest", "ink"];
  const symbols: Submission["symbol"][] = ["none", "namaste", "heart", "hug"];
  const start = Date.now();
  return Array.from({ length: 100 }, (_, index) => {
    let id: number;
    do { id = Number.parseInt(randomBytes(6).toString("hex"), 16); } while (ids.has(id));
    ids.add(id);
    const colorStyle = colors[index % colors.length];
    return {
      id,
      message: `Demo ${String(index + 1).padStart(3, "0")} · ${DEMO_MESSAGES[index % DEMO_MESSAGES.length]}`,
      colorStyle,
      fontStyle: colorStyle,
      borderStyle: "simple",
      texture: textures[index % textures.length],
      fontColor: inks[index % inks.length],
      symbol: symbols[index % symbols.length],
      hidden: false,
      whisperApproved: false,
      createdAt: new Date(start + index).toISOString(),
    };
  });
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing. Connect the Neon database.");
  return neon(url);
}

export function storageErrorMessage(error: unknown): string {
  if (error instanceof WallConflictError) return error.message;
  if (error instanceof Error && error.message.startsWith("DATABASE_URL is missing")) return error.message;
  return "Wall database is unavailable";
}

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

// Failed admin logins are counted per client IP within a 15-minute window; reaching the limit locks that IP out until the window ends.
export async function loginLocked(ip: string): Promise<boolean> {
  const rows = await db().query("SELECT failures, window_start FROM admin_login_attempts WHERE ip = $1", [ip]);
  if (!rows.length) return false;
  return Number(rows[0].failures) >= LOGIN_MAX_FAILURES && Date.now() - Number(rows[0].window_start) < LOGIN_LOCK_MS;
}

export async function recordLoginFailure(ip: string): Promise<void> {
  await db().query(
    "INSERT INTO admin_login_attempts (ip, failures, window_start) VALUES ($1, 1, $2)" +
    " ON CONFLICT (ip) DO UPDATE SET" +
    " failures = CASE WHEN $2 - admin_login_attempts.window_start >= $3 THEN 1 ELSE admin_login_attempts.failures + 1 END," +
    " window_start = CASE WHEN $2 - admin_login_attempts.window_start >= $3 THEN $2 ELSE admin_login_attempts.window_start END",
    [ip, Date.now(), LOGIN_LOCK_MS],
  );
}

export async function clearLoginFailures(ip: string): Promise<void> {
  await db().query("DELETE FROM admin_login_attempts WHERE ip = $1", [ip]);
}

export async function getState(): Promise<WallState> {
  const rows = await db().query("SELECT mode, session, changed_at, test_mode, wifi_visible FROM wall_state WHERE id = 1");
  if (!rows.length) return initialState;
  const row = rows[0];
  return { mode: row.mode as WallMode, session: String(row.session), changedAt: Number(row.changed_at), testMode: Boolean(row.test_mode), wifiVisible: Boolean(row.wifi_visible) };
}

export async function setWifiVisible(visible: boolean): Promise<WallState> {
  const rows = await db().query(
    "UPDATE wall_state SET wifi_visible = $1 WHERE id = 1 AND test_mode = false" +
    " RETURNING mode, session, changed_at, test_mode, wifi_visible",
    [visible],
  );
  if (!rows.length) throw new WallConflictError("End test mode before changing Wi-Fi details");
  const row = rows[0];
  return { mode: row.mode as WallMode, session: String(row.session), changedAt: Number(row.changed_at), testMode: Boolean(row.test_mode), wifiVisible: Boolean(row.wifi_visible) };
}

export async function setMode(mode: WallMode): Promise<WallState> {
  const current = await getState();
  if (current.testMode && mode === "qr") {
    throw new WallConflictError("End test mode before changing the wall");
  }
  if (current.mode === mode) return current;
  const state: WallState = {
    mode,
    session: current.session,
    changedAt: Date.now(),
    testMode: current.testMode,
    wifiVisible: current.wifiVisible,
  };
  const rows = await db().query(
    "UPDATE wall_state SET mode = $1, session = $2, changed_at = $3 WHERE id = 1" +
    " AND session = $4 AND test_mode = $5" +
    " RETURNING test_mode",
    [state.mode, state.session, state.changedAt, current.session, current.testMode],
  );
  if (!rows.length) throw new WallConflictError("End test mode before changing the wall");
  state.testMode = Boolean(rows[0].test_mode);
  return state;
}

export async function startNewSession(): Promise<WallState> {
  const rows = await db().query(
    "UPDATE wall_state SET mode = 'wall', session = $1, changed_at = $2, wifi_visible = false" +
    " WHERE id = 1 AND test_mode = false" +
    " RETURNING mode, session, changed_at, test_mode, wifi_visible",
    [randomBytes(8).toString("hex"), Date.now()],
  );
  if (!rows.length) throw new WallConflictError("End test mode before starting a new session");
  const row = rows[0];
  return { mode: row.mode as WallMode, session: String(row.session), changedAt: Number(row.changed_at), testMode: Boolean(row.test_mode), wifiVisible: Boolean(row.wifi_visible) };
}

export async function startTest(): Promise<WallState> {
  const current = await getState();
  if (current.testMode) return current;
  const session = `demo-${randomBytes(8).toString("hex")}`;
  const notes = demoNotes();
  const rows = await db().query(
    "WITH activated AS (" +
    " UPDATE wall_state SET saved_mode = mode, saved_session = session, saved_changed_at = changed_at," +
    " mode = 'wall', session = $1, changed_at = $2, test_mode = true" +
    " WHERE id = 1 AND test_mode = false RETURNING id" +
    "), seeded AS (" +
    " INSERT INTO wall_notes (id, session, payload, created_at)" +
    " SELECT (demo.note ->> 'id')::bigint, $1, demo.note, (demo.note ->> 'createdAt')::timestamptz" +
    " FROM jsonb_array_elements($3::jsonb) AS demo(note)" +
    " WHERE EXISTS (SELECT 1 FROM activated) RETURNING id" +
    ") SELECT (SELECT count(*)::int FROM activated) AS activated," +
    " (SELECT count(*)::int FROM seeded) AS seeded",
    [session, Date.now(), JSON.stringify(notes)],
  );
  if (Number(rows[0]?.activated) === 0) return getState();
  if (Number(rows[0]?.seeded) !== 100) throw new Error("Demo notes were not fully created");
  return getState();
}

export async function endTest(expectedSession: string): Promise<WallState> {
  const current = await getState();
  if (!current.testMode) return current;
  if (expectedSession !== current.session) throw new WallConflictError("The test session changed. Refresh the dashboard.");
  const rows = await db().query(
    "WITH target AS (" +
    " SELECT session AS demo_session, saved_mode, saved_session, saved_changed_at" +
    " FROM wall_state WHERE id = 1 AND test_mode = true AND session = $1" +
    "), restored AS (" +
    " UPDATE wall_state AS wall SET mode = target.saved_mode, session = target.saved_session," +
    " changed_at = target.saved_changed_at, test_mode = false," +
    " saved_mode = NULL, saved_session = NULL, saved_changed_at = NULL" +
    " FROM target WHERE wall.id = 1 AND wall.test_mode = true AND wall.session = target.demo_session" +
    " RETURNING target.demo_session" +
    "), removed_batches AS (" +
    " DELETE FROM wall_approval_batches AS batches USING restored" +
    " WHERE batches.session = restored.demo_session RETURNING batches.id" +
    "), removed_notes AS (" +
    " DELETE FROM wall_notes AS notes USING restored" +
    " WHERE notes.session = restored.demo_session RETURNING notes.id" +
    ") SELECT (SELECT count(*)::int FROM restored) AS restored," +
    " (SELECT count(*)::int FROM removed_notes) AS removed_notes," +
    " (SELECT count(*)::int FROM removed_batches) AS removed_batches",
    [expectedSession],
  );
  if (Number(rows[0]?.restored) === 0) throw new WallConflictError("The test session changed. Refresh the dashboard.");
  return getState();
}

const colors = new Set(["golden", "rose", "deepBlue", "forestGreen"]);
const textures = new Set(["plain", "ruled", "dotted"]);
const inks = new Set(["warm", "crimson", "indigo", "forest", "ink"]);
const symbols = new Set(["none", "namaste", "heart", "hug"]);

export function parseInput(raw: unknown): Omit<Submission, "id" | "createdAt" | "hidden" | "whisperApproved"> | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message || message.length > 120) return null;
  if (!colors.has(String(input.colorStyle)) || !textures.has(String(input.texture)) ||
      !inks.has(String(input.fontColor)) || !symbols.has(String(input.symbol))) return null;
  return {
    message,
    colorStyle: input.colorStyle as Submission["colorStyle"],
    fontStyle: String(input.colorStyle),
    borderStyle: "simple",
    texture: input.texture as Submission["texture"],
    fontColor: input.fontColor as Submission["fontColor"],
    symbol: input.symbol as Submission["symbol"],
  };
}

export async function addSubmission(input: ReturnType<typeof parseInput>, session: string): Promise<Submission> {
  if (!input) throw new Error("Invalid submission");
  const submission: Submission = {
    ...input,
    id: Number.parseInt(randomBytes(6).toString("hex"), 16),
    createdAt: new Date().toISOString(),
    hidden: false,
    whisperApproved: false,
  };
  const rows = await db().query(
    "INSERT INTO wall_notes (id, session, payload, created_at)" +
    " SELECT $1, $2, $3::jsonb, $4 WHERE EXISTS (" +
    " SELECT 1 FROM wall_state WHERE id = 1 AND test_mode = false AND mode <> 'burn' AND session = $2 FOR SHARE" +
    ") RETURNING id",
    [submission.id, session, JSON.stringify(submission), submission.createdAt],
  );
  if (!rows.length) throw new WallConflictError("Submissions are paused or this QR code has expired");
  return submission;
}

export async function getSubmissions(session: string): Promise<Submission[]> {
  const rows = await db().query("SELECT payload FROM wall_notes WHERE session = $1 ORDER BY created_at, id", [session]);
  return rows.map(row => row.payload as Submission);
}

export type SubmissionCursor = { createdAt: string; id: number };

export async function getSubmissionsAfter(session: string, cursor: SubmissionCursor): Promise<Submission[]> {
  const rows = await db().query(
    "SELECT payload FROM wall_notes WHERE session = $1" +
    " AND (created_at, id) > ($2::timestamptz, $3::bigint) ORDER BY created_at, id",
    [session, cursor.createdAt, cursor.id],
  );
  return rows.map(row => row.payload as Submission);
}

export async function getApprovalBatches(session: string): Promise<ApprovalBatch[]> {
  const rows = await db().query(
    "SELECT id, note_ids, created_at FROM wall_approval_batches WHERE session = $1 ORDER BY created_at, id",
    [session],
  );
  return rows.map(row => ({
    id: String(row.id),
    noteIds: (row.note_ids as (number | string)[]).map(Number),
    createdAt: Number(row.created_at),
  }));
}

export async function approveSubmissions(session: string, ids: number[]): Promise<ApprovalBatch> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0 || uniqueIds.length > 12 || !uniqueIds.every(Number.isSafeInteger)) {
    throw new Error("Choose 1 to 12 notes");
  }
  const batchId = randomBytes(6).toString("hex");
  const createdAt = Date.now();
  // One SQL statement prevents simultaneous admin actions from approving a note twice.
  const rows = await db().query(
    "WITH selected AS (" +
    " UPDATE wall_notes SET approval_batch = $3" +
    " WHERE session = $1 AND id = ANY($2::bigint[]) AND approval_batch IS NULL" +
    " AND EXISTS (SELECT 1 FROM wall_state WHERE id = 1 AND session = $1 AND mode = 'wall' FOR SHARE)" +
    " RETURNING id" +
    "), saved AS (" +
    " INSERT INTO wall_approval_batches (id, session, note_ids, created_at)" +
    " SELECT $3, $1, jsonb_agg(id ORDER BY array_position($2::bigint[], id)), $4" +
    " FROM selected HAVING count(*) > 0" +
    " RETURNING id, note_ids, created_at" +
    ") SELECT id, note_ids, created_at FROM saved",
    [session, uniqueIds, batchId, createdAt],
  );
  if (!rows.length) throw new Error("These notes have already been shown or are unavailable");
  const row = rows[0];
  return { id: String(row.id), noteIds: (row.note_ids as (number | string)[]).map(Number), createdAt: Number(row.created_at) };
}
