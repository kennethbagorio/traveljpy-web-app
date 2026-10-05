// Shared validation for itinerary data (used by both server functions).
export const PIC_KEYS = ["plane","train","dotonbori","castle","shinsekai","umeda","torii","kiyomizu","bamboo","buddha","deer","lanterns","shinkansen","garden","tmg","alley","sensoji","river","teamlab","mountain","soba","meiji","crossing","rooftop","market","dinner"];
export const CITIES = ["osaka","kyoto","nara","tokyo"];
const str = (v, max) => String(v ?? "").slice(0, max);
const items = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 15)
  .filter(x => Array.isArray(x) && x.length >= 2)
  .map(x => [str(x[0], 120), Math.max(0, Math.min(1000000, Math.round(Number(x[1]) || 0)))]);

export function cleanCost(c) {
  c = c && typeof c === "object" ? c : {};
  return { entry: items(c.entry), train: items(c.train), food: items(c.food) };
}

export function cleanDay(d, fallback = {}) {
  d = d && typeof d === "object" ? d : {};
  return {
    d: str(d.d ?? fallback.d, 40),
    short: str(d.short ?? fallback.short, 20),
    city: CITIES.includes(d.city) ? d.city : (fallback.city || "tokyo"),
    t: str(d.t, 120),
    note: str(d.note, 400),
    stops: (Array.isArray(d.stops) ? d.stops : []).slice(0, 12).map(s => ({
      when: str(s?.when, 40),
      name: str(s?.name, 100),
      map: str(s?.map, 120),
      about: str(s?.about, 700),
      how: str(s?.how, 700),
      price: str(s?.price, 40),
      pic: PIC_KEYS.includes(s?.pic) ? s.pic : ""
    })),
    cost: cleanCost(d.cost)
  };
}

export function cleanData(data) {
  if (!data || !Array.isArray(data.days) || data.days.length !== 10) return null;
  return {
    days: data.days.map(d => cleanDay(d)),
    todo: (Array.isArray(data.todo) ? data.todo : []).slice(0, 20)
      .filter(x => Array.isArray(x)).map(x => [str(x[0], 80), str(x[1], 300)])
  };
}
