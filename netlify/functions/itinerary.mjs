// GET  /api/itinerary  -> current shared itinerary (or {empty:true} before the first save)
// PUT  /api/itinerary  -> save a new version (needs the group passcode)
import { getStore } from "@netlify/blobs";
import { cleanData } from "../../lib/sanitize.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "japan-trip", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("itinerary", { type: "json" });
    return json(data || { empty: true, version: 0 });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const passcode = Netlify.env.get("EDIT_PASSCODE");
    if (!passcode) return json({ error: "EDIT_PASSCODE is not set on the server" }, 500);
    if (body.code !== passcode) return json({ error: "Wrong passcode" }, 401);

    const clean = cleanData(body.data);
    if (!clean) return json({ error: "Itinerary must have exactly 10 days" }, 400);

    const current = await store.get("itinerary", { type: "json" });
    const currentVersion = current?.version || 0;
    if (body.baseVersion !== currentVersion) {
      return json({ error: "Someone else saved changes first", version: currentVersion }, 409);
    }
    const saved = {
      ...clean,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: String(body.name || "").slice(0, 40)
    };
    await store.setJSON("itinerary", saved);
    return json({ version: saved.version, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/itinerary" };
