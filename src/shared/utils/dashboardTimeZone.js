const DAY_MS = 86_400_000;

export function normalizeDashboardTimeZone(value) {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_+/-]{0,127}$/.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

function calendarFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, calendar: "iso8601", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function dayKey(formatter, ms) {
  const parts = formatter.formatToParts(ms);
  const year = parts.find(({ type }) => type === "year").value.padStart(4, "0");
  const month = parts.find(({ type }) => type === "month").value;
  const day = parts.find(({ type }) => type === "day").value;
  return `${year}-${month}-${day}`;
}

export function getZonedDateKey(nowMs, timeZone) {
  return dayKey(calendarFormatter(timeZone), nowMs);
}

function parseDateKey(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return NaN;
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms : NaN;
}

function makeOffsetReader(timeZone) {
  const formatter = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" });
  return (ms) => {
    const offset = formatter.formatToParts(ms).find(({ type }) => type === "timeZoneName").value;
    if (offset === "GMT") return 0;
    const [, sign, hours, minutes, seconds = 0] = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(offset);
    return (sign === "-" ? -1 : 1) * (+hours * 3600 + +minutes * 60 + +seconds) * 1000;
  };
}

function wallTimeCandidates(wallMs, offsetAt) {
  const earlier = wallMs - offsetAt(wallMs - DAY_MS);
  const later = wallMs - offsetAt(wallMs + DAY_MS);
  return earlier <= later ? [earlier, later] : [later, earlier];
}

export function zonedFilterInstant(value, timeZone, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) return null;
  if (!Number.isFinite(parseDateKey(value.slice(0, 10)))) return null;
  const wallMs = Date.parse(`${value}Z`);
  if (!Number.isFinite(wallMs) || value.slice(11, 13) === "24") return null;
  const offsetAt = makeOffsetReader(timeZone);
  const [first, last] = wallTimeCandidates(wallMs, offsetAt);
  // Include both folds for filter bounds; a nonexistent wall time moves forward by the gap.
  const firstMatches = offsetAt(first) === wallMs - first;
  const instant = firstMatches && (!end || offsetAt(last) !== wallMs - last) ? first : last;
  return new Date(instant).toISOString();
}

function startOfZonedDate(formatter, date, utcMidnight, offsetAt) {
  // Try offsets on both sides of the date. If midnight repeats, take its first occurrence.
  const candidates = wallTimeCandidates(utcMidnight, offsetAt);
  for (const ms of candidates) {
    if (offsetAt(ms) === utcMidnight - ms) return ms;
  }

  // Midnight was skipped. Find the first instant with the requested date or later.
  let low = utcMidnight - DAY_MS;
  let high = utcMidnight + DAY_MS;
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (dayKey(formatter, mid) < date) low = mid;
    else high = mid;
  }
  return high;
}

export function getZonedDayBounds(date, timeZone) {
  const utcMidnight = parseDateKey(date);
  if (!Number.isFinite(utcMidnight) || date === "9999-12-31") return null;
  const formatter = calendarFormatter(timeZone);
  const offsetAt = makeOffsetReader(timeZone);
  const nextMidnight = utcMidnight + DAY_MS;
  const nextDate = new Date(nextMidnight).toISOString().slice(0, 10);
  const startMs = startOfZonedDate(formatter, date, utcMidnight, offsetAt);
  const endMs = startOfZonedDate(formatter, nextDate, nextMidnight, offsetAt);
  return startMs < endMs ? { startMs, endMs } : null;
}

export function createRequestTimeFormatter(timeZone) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone });
}

export function formatRequestTime(formatter, timestamp) {
  if (!formatter || !timestamp) return "—";
  const instant = Date.parse(timestamp);
  return Number.isFinite(instant) ? formatter.format(instant) : "—";
}
