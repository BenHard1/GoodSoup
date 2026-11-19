/** « PT1H30M », « P0DT0H20M », « PT45M » → minutes. Null si illisible ou nul. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value
    .trim()
    .match(/^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i);
  if (!m) return parseHumanDuration(value);
  const n = (s?: string) => (s ? Number(s.replace(",", ".")) : 0);
  const total = Math.round(n(m[1]) * 1440 + n(m[2]) * 60 + n(m[3]) + n(m[4]) / 60);
  return total > 0 && total <= 100000 ? total : null;
}

/** « 1 h 30 », « 1h30 », « 20 min », « 1 heure », « 45 minutes », « 2 h » → minutes. */
export function parseHumanDuration(value: string): number | null {
  const s = value.toLowerCase().replace(/\s+/g, " ").trim();
  let total = 0;
  let found = false;
  const days = s.match(/(\d+(?:[.,]\d+)?)\s*(?:jours?|days?|j)\b/);
  if (days) {
    total += Number(days[1].replace(",", ".")) * 1440;
    found = true;
  }
  const hm = s.match(/(\d+(?:[.,]\d+)?)\s*(?:heures?|hours?|hrs?|h)\.?\s*(\d{1,2})?(?!\d)/);
  if (hm) {
    total += Number(hm[1].replace(",", ".")) * 60 + (hm[2] ? Number(hm[2]) : 0);
    found = true;
  }
  const min = s.match(/(\d+)\s*(?:min(?:ute)?s?|mn|')(?![a-z])/);
  if (min && !(hm && hm[2] && min.index! <= (hm.index ?? 0) + hm[0].length)) {
    total += Number(min[1]);
    found = true;
  }
  if (!found) return null;
  total = Math.round(total);
  return total > 0 && total <= 100000 ? total : null;
}
