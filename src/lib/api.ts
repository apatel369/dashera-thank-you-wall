import type { CrackerType } from "./crackers.ts";

export type Submission = {
  id: number;
  message: string;
  colorStyle: "golden" | "rose" | "deepBlue" | "forestGreen";
  cracker: CrackerType;
  fontStyle: string;
  borderStyle: string;
  texture: "plain" | "ruled" | "dotted";
  fontColor: "warm" | "crimson" | "indigo" | "forest" | "ink";
  symbol: "none" | "namaste" | "heart" | "hug";
  hidden: boolean;
  whisperApproved: boolean;
  createdAt: string;
};

export type WallState = { mode: "qr" | "wall" | "scroll" | "burn"; session: string; changedAt: number; testMode: boolean };
export type SubmissionCursor = { createdAt: string; id: number };
export type SubmissionList = { items: Submission[]; total: number; state: WallState; reset: boolean; cursor: SubmissionCursor | null; serverTime: number };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as Error & { status: number; data: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export const getState = () => json<WallState>("/api/state");
export const listSubmissions = (admin = false, session?: string, cursor?: SubmissionCursor | null) => {
  const query = new URLSearchParams();
  if (admin) query.set("admin", "1");
  if (session && cursor) {
    query.set("session", session);
    query.set("afterAt", cursor.createdAt);
    query.set("afterId", String(cursor.id));
  }
  return json<SubmissionList>(`/api/submissions${query.size ? `?${query}` : ""}`);
};
export const createSubmission = (data: Pick<Submission, "message" | "colorStyle" | "cracker"> & { session?: string }) =>
  json<Submission>("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export const adminSession = () => json<{ authenticated: boolean }>("/api/admin");
export const adminAction = (action: string, extra: Record<string, unknown> = {}) =>
  json<WallState & { authenticated?: boolean }>("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
