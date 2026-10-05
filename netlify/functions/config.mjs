// GET /api/config -> public settings for the page.
// The Street View key is used in the browser for street-level photos; restrict it to your site's address in Google Cloud.
export default async () => new Response(JSON.stringify({
  streetViewKey: Netlify.env.get("GOOGLE_STREETVIEW_KEY") || ""
}), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const config = { path: "/api/config" };
