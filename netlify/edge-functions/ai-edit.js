// POST /api/ai-edit -> asks OpenAI to change the itinerary or recompute costs.
// Runs as an Edge Function so slow model replies don't hit the 10-second limit of regular functions.
import { cleanDay, cleanCost, PIC_KEYS } from "../../lib/sanitize.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const SYSTEM = `You edit a shared travel itinerary for a group of 4 travellers in Japan, Nov 11–20, 2026.
Fixed facts unless the user says otherwise: land at Kansai Airport 6:20 PM Nov 11; hotels only in Osaka (Nov 11–14) and Tokyo (Nov 14–20); Kyoto and Nara are day trips; Nov 14 ends with the shinkansen to Tokyo; Nov 20 is departure with no activities.

The data has exactly 10 days (index 0 = Nov 11 ... index 9 = Nov 20). Each day:
{ "d": "Wed Nov 11", "short": "Nov 11", "city": "osaka|kyoto|nara|tokyo", "t": "day title", "note": "optional tip or empty",
  "stops": [ { "when": "9:00 AM", "name": "place name", "map": "Google Maps search query",
               "about": "what the place is and what to do there, 1–3 sentences",
               "how": "step-by-step directions from the previous stop or the hotel: line names, transfers, exits, minutes",
               "price": "per-person entry label like ¥500, Free, or empty", "pic": "one of the picture keys or empty" } ],
  "cost": { "entry": [["label", yen]], "train": [["label", yen]], "food": [["label", yen]] } }

Picture keys: ${PIC_KEYS.join(", ")}. Use one only if it genuinely matches the place; otherwise "".

Cost rules: amounts are integers in yen PER PERSON. "entry" = tickets for that day's stops only. "train" = every ride that day, including taxis split 4 ways and shinkansen. "food" = realistic meal and snack estimates for where the group eats that day. Use realistic 2026 prices; round sensibly. Whenever you change a day's stops, update that day's cost to match.

Keep the existing writing style: plain, friendly, concise English. Keep the day's "d", "short" unchanged. Keep travel times realistic and in geographic order.

Reply with JSON only:
{ "summary": "1–2 sentences describing what you changed",
  "days": [ { "index": n, "day": { full day object } } ],
  "costs": [ { "index": n, "cost": { full cost object } } ],
  "todo": null }
Include in "days" only days you changed. Use "costs" only when recomputing costs without changing stops. Set "todo" to the full updated booking checklist (array of [title, detail]) only if the change affects bookings; otherwise null.`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const passcode = Netlify.env.get("EDIT_PASSCODE");
  const key = Netlify.env.get("OPENAI_API_KEY");
  if (!passcode || !key) return json({ error: "OPENAI_API_KEY or EDIT_PASSCODE is not set on the server" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (body.code !== passcode) return json({ error: "Wrong passcode" }, 401);

  const mode = body.mode === "costs" ? "costs" : "edit";
  const instruction = String(body.instruction || "").slice(0, 1500).trim();
  if (mode === "edit" && !instruction) return json({ error: "Type what you want to change" }, 400);
  const data = body.data;
  if (!data || !Array.isArray(data.days) || data.days.length !== 10) return json({ error: "Itinerary must have exactly 10 days" }, 400);
  const dataStr = JSON.stringify({ days: data.days, todo: data.todo || [] });
  if (dataStr.length > 200000) return json({ error: "Itinerary is too large" }, 413);

  const focus = Number.isInteger(body.focusDay) ? body.focusDay : -1;
  const task = mode === "costs"
    ? `Recompute the cost object for EVERY day (all 10) so it matches that day's stops. Return them in "costs"; leave "days" empty.${instruction ? " Extra guidance: " + instruction : ""}`
    : `Change request from the group: ${instruction}${focus >= 0 ? `\n(The person is looking at day index ${focus}; "this day" or "today" means that day.)` : ""}`;

  const payload = {
    model: Netlify.env.get("OPENAI_MODEL") || "gpt-5.4-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Current itinerary JSON:\n${dataStr}\n\n${task}` }
    ]
  };
  const effort = Netlify.env.get("OPENAI_REASONING_EFFORT") ?? "low";
  if (effort && effort !== "none") payload.reasoning_effort = effort;

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    return json({ error: "Could not reach OpenAI" }, 502);
  }
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    return json({ error: `OpenAI returned ${r.status}`, detail }, 502);
  }

  let out;
  try {
    const res = await r.json();
    out = JSON.parse(res.choices?.[0]?.message?.content || "{}");
  } catch {
    return json({ error: "The AI reply wasn't valid JSON. Try again or rephrase." }, 502);
  }

  const okIndex = (i) => Number.isInteger(i) && i >= 0 && i <= 9;
  const days = (Array.isArray(out.days) ? out.days : [])
    .filter(x => okIndex(x?.index))
    .map(x => {
      const orig = data.days[x.index] || {};
      const day = cleanDay(x.day, orig);
      day.d = String(orig.d ?? "").slice(0, 40);        // dates never change
      day.short = String(orig.short ?? "").slice(0, 20);
      return { index: x.index, day };
    });
  const costs = (Array.isArray(out.costs) ? out.costs : [])
    .filter(x => okIndex(x?.index))
    .map(x => ({ index: x.index, cost: cleanCost(x.cost) }));
  const todo = Array.isArray(out.todo)
    ? out.todo.filter(Array.isArray).slice(0, 20).map(x => [String(x[0] ?? "").slice(0, 80), String(x[1] ?? "").slice(0, 300)])
    : null;

  return json({ summary: String(out.summary || "Done.").slice(0, 400), days, costs, todo });
};

export const config = { path: "/api/ai-edit" };
