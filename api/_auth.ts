import type { VercelRequest } from "@vercel/node";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "wall_admin";

export function adminSignature(expires: string, secret: string) {
  return createHmac("sha256", secret).update(`dashera-wall:${expires}`).digest("hex");
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
