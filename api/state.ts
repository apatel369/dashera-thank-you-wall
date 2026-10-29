import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getState, storageErrorMessage } from "./_store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(await getState());
  } catch (error) {
    console.error(error);
    return res.status(503).json({ error: storageErrorMessage(error) });
  }
}
