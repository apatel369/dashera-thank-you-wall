import type { VercelRequest } from "@vercel/node";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "wall_admin";

export function adminSignature(expires: string, secret: string) {
  return createHmac("sha256", secret).update(`dashera-wall:${expires}`).digest("hex");
}

// Hashing first gives equal-length buffers, so the comparison time does not reveal the password length or matching prefix.
export function passwordMatches(candidate: unknown, secret: string): boolean {
  if (typeof candidate !== "string") return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

// Vercel sets x-real-ip and x-forwarded-for itself, so clients cannot spoof them on deployed functions.
export function clientIp(req: VercelRequest): string {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real) return real;
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function authenticated(req: VercelRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  const cookie = req.cookies?.[ADMIN_COOKIE];
  if (!secret || !cookie) return false;
  const [expires, actual] = cookie.split(".");
  if (!expires || !actual || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = adminSignature(expires, secret);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
