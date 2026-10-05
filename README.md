# Japan Trip 2026, editable guide

A one-page trip guide for the group. Anyone can view it, no sign-in.
People with the group passcode can edit stops or ask OpenAI to change the plan and recompute costs, then save for everyone.

## What's in here
- `public/index.html` - the page
- `netlify/functions/itinerary.mjs` - loads and saves the shared plan (Netlify Blobs)
- `netlify/edge-functions/ai-edit.js` - sends change requests to OpenAI (your key stays on the server)
- `netlify/functions/config.mjs` - hands the Street View key to the page
- `lib/sanitize.js` - checks every save and AI reply before it's stored

## Deploy (about 10 minutes)
Netlify Drop (drag and drop) won't work here, because it doesn't run the server functions. Use one of these:

**Option A: GitHub (no command line)**
1. Create a GitHub repo and upload this whole folder.
2. In Netlify: Add new site > Import an existing project > pick the repo. Leave the build settings as they are.
3. Site configuration > Environment variables, add:
   - `OPENAI_API_KEY` - your OpenAI API key
   - `EDIT_PASSCODE` - a passcode for the group, e.g. `sakura-2026`
   - `OPENAI_MODEL` (optional) - defaults to `gpt-5.4-mini`
   - `GOOGLE_STREETVIEW_KEY` (optional) - your Street View key, for street-level photos
4. Deploys > Trigger deploy. Done.

**Option B: Netlify CLI**
```
npm install -g netlify-cli
netlify login
netlify init
netlify env:set OPENAI_API_KEY sk-...
netlify env:set EDIT_PASSCODE sakura-2026
netlify env:set GOOGLE_STREETVIEW_KEY AIza...
netlify deploy --prod
```

## Maps and directions
Maps and routes use free OpenStreetMap services, so no map key is needed:
- Each stop has a **Map and directions** button that opens a map inside the page.
- The start point is your phone's GPS (allow location when asked), or the previous stop. If you're more than 60 km away (e.g. planning from home), it uses the previous stop.
- Walk and Taxi routes show time, distance, turn-by-turn steps and a rough taxi fare split four ways.
- Train routes aren't available from any free map service in Japan, so the page shows the written train steps and a link to live train times in the Google Maps app.
- These are free community servers, fine for a small group; at busy times a route can take a few seconds.

Street View photos (optional): set `GOOGLE_STREETVIEW_KEY` to your Street View Static API key. In Google Cloud, restrict that key to **Websites** with `https://YOUR-SITE.netlify.app/*`, because it's visible in the browser. Without the key, everything else still works.

## Using it
- Share the site link in Messenger. Send the passcode only to the people who should edit.
- Tap **Edit plan**, enter your name and the passcode.
- Type a change ("Move teamLab to Nov 18 and add Disneyland on Nov 19") and tap **Ask AI to change it**, or use the Edit / Delete / arrow buttons on each stop.
- Check the result, then tap **Save for everyone**. Nothing is shared until you save.
- After manual edits, tap **Recompute all costs with AI** to refresh prices.
- If two people edit at once, the second save is blocked so nobody overwrites the other. Reload and redo the change.

## Costs and safety
- Each AI request sends the whole itinerary to OpenAI: a few US cents per request with gpt-5.4-mini.
- Set a monthly budget limit on your OpenAI account.
- Change `EDIT_PASSCODE` anytime in Netlify if it leaks, then redeploy.
- If a large request times out, split it into smaller changes.
