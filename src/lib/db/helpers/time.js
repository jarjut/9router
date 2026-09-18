export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getLocalDateKey(timestamp, timeZone = "UTC") {
  const d = timestamp ? new Date(timestamp) : new Date();
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
}

export function getStartOfDayUtc(timeZone = "UTC") {
  const now = new Date();
  let dateStr;
  let tz = timeZone;
  try {
    dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    tz = "UTC";
    dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }

  const guessUtc = new Date(`${dateStr}T00:00:00Z`);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(guessUtc);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const asDate = new Date(
      Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second),
    );
    const offsetMs = asDate.getTime() - guessUtc.getTime();
    return new Date(guessUtc.getTime() - offsetMs);
  } catch {
    return guessUtc;
  }
}

export function formatLogDate(date = new Date(), timeZone = "UTC") {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const m = {};
    for (const p of parts) m[p.type] = p.value;
    return `${m.day}-${m.month}-${m.year} ${m.hour}:${m.minute}:${m.second}`;
  } catch {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}

export function parseFilterDate(str, timeZone = "UTC") {
  if (!str) return null;
  if (/Z|[+-]\d{2}(:\d{2})?$/i.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const clean = str.includes("T") ? str : `${str}T00:00:00`;
  const [datePart, timePart = "00:00:00"] = clean.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);

  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(guessUtc);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const asDate = new Date(
      Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second),
    );
    const offsetMs = asDate.getTime() - guessUtc.getTime();
    return new Date(guessUtc.getTime() - offsetMs).toISOString();
  } catch {
    return guessUtc.toISOString();
  }
}
