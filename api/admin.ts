import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearLoginFailures, endTest, getState, loginLocked, recordLoginFailure, setMode, setWifiVisible, startNewSession, startTest, storageErrorMessage, WallConflictError, type WallMode } from "./_store.js";
import { ADMIN_COOKIE, adminSignature, authenticated, clientIp, passwordMatches } from "./_auth.js";

const MAX_AGE = 12 * 60 * 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ authenticated: authenticated(req) });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const action = req.body?.action;
  if (action === "login") {
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret) return res.status(503).json({ error: "ADMIN_PASSWORD is missing" });
    const ip = clientIp(req);
    try {
      if (await loginLocked(ip)) {
        return res.status(429).json({ error: "Too many failed attempts. Try again in 15 minutes." });
      }
      if (!passwordMatches(req.body?.password, secret)) {
        await recordLoginFailure(ip);
        return res.status(401).json({ error: "Incorrect password" });
      }
      await clearLoginFailures(ip);
    } catch (error) {
      console.error(error);
      return res.status(503).json({ error: storageErrorMessage(error) });
    }
    const expires = String(Date.now() + MAX_AGE * 1000);
    const secure = process.env.VERCEL ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${expires}.${adminSignature(expires, secret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`);
    return res.status(200).json({ authenticated: true });
  }

  if (!authenticated(req)) return res.status(401).json({ error: "Admin login required" });
  if (action === "logout") {
    res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return res.status(200).json({ authenticated: false });
  }
  if (action === "mode" && ["qr", "wall", "scroll", "burn"].includes(req.body?.mode)) {
    try {
      const mode = req.body.mode as WallMode;
      return res.status(200).json(await setMode(mode));
    } catch (error) {
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "wifi" && typeof req.body?.visible === "boolean") {
    try { return res.status(200).json(await setWifiVisible(req.body.visible)); }
    catch (error) {
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "newSession") {
    try { return res.status(200).json(await startNewSession()); }
    catch (error) {
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "openAdmin") {
    try { return res.status(200).json(await startNewSession()); }
    catch (error) {
      if (error instanceof WallConflictError) {
        try {
          const state = await getState();
          if (state.testMode) return res.status(200).json(state);
        } catch (readError) {
          console.error(readError);
          return res.status(503).json({ error: storageErrorMessage(readError) });
        }
      }
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "startTest") {
    try { return res.status(200).json(await startTest()); }
    catch (error) {
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "endTest") {
    if (typeof req.body?.session !== "string") return res.status(400).json({ error: "Test session is required" });
    try { return res.status(200).json(await endTest(req.body.session)); }
    catch (error) {
      console.error(error);
      return res.status(error instanceof WallConflictError ? 409 : 503).json({ error: storageErrorMessage(error) });
    }
  }
  if (action === "approve") return res.status(410).json({ error: "Notes now appear automatically" });
  return res.status(400).json({ error: "Invalid admin action" });
}
