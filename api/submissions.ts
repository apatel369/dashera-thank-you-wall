import type { VercelRequest, VercelResponse } from "@vercel/node";
import { addSubmission, getState, getSubmissions, getSubmissionsAfter, parseInput, reserveSubmission, storageErrorMessage, WallConflictError } from "./_store.js";
import { clientIp } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const state = await getState();
    if (req.method === "GET") {
      const sameSession = req.query.session === state.session;
      const afterAt = typeof req.query.afterAt === "string" ? req.query.afterAt : "";
      const afterId = typeof req.query.afterId === "string" ? Number(req.query.afterId) : NaN;
      if ((req.query.afterAt || req.query.afterId) && (!Number.isSafeInteger(afterId) || !Number.isFinite(Date.parse(afterAt)))) {
        return res.status(400).json({ error: "Invalid note cursor" });
      }
      const incremental = sameSession && afterAt && Number.isSafeInteger(afterId);
      const items = incremental
        ? await getSubmissionsAfter(state.session, { createdAt: afterAt, id: afterId })
        : await getSubmissions(state.session);
      const last = items.at(-1);
      return res.status(200).json({
        items, total: items.length, state, reset: !incremental,
        cursor: last ? { createdAt: last.createdAt, id: last.id } :
          incremental ? { createdAt: afterAt, id: afterId } : null,
      });
    }
    if (req.method === "POST") {
      if (state.testMode) return res.status(423).json({ error: "Test mode is active. Guest submissions are temporarily paused." });
      if (state.mode === "burn") return res.status(400).json({ error: "Submissions are closed" });
      if (typeof req.body?.session === "string" && req.body.session !== state.session) {
        return res.status(409).json({ error: "This QR code has expired. Please scan the code on the display again." });
      }
      const input = parseInput(req.body);
      if (!input) return res.status(400).json({ error: "Invalid sticky note" });
      if (!(await reserveSubmission(clientIp(req)))) {
        return res.status(429).json({ error: "You're adding notes very quickly. Please wait a minute and try again." });
      }
      return res.status(201).json(await addSubmission(input, state.session));
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (req.method === "POST" && error instanceof WallConflictError) {
      try {
        const state = await getState();
        if (state.testMode) return res.status(423).json({ error: "Test mode is active. Guest submissions are temporarily paused." });
        if (state.mode === "burn") return res.status(400).json({ error: "Submissions are closed" });
        return res.status(409).json({ error: "This QR code has expired. Please scan the code on the display again." });
      } catch (stateError) { console.error(stateError); }
    }
    console.error(error);
    return res.status(503).json({ error: storageErrorMessage(error) });
  }
}
