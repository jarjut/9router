import { describe, it, expect } from "vitest";
import {
  isValidTimeZone,
  getLocalDateKey,
  getStartOfDayUtc,
  formatLogDate,
  parseFilterDate,
} from "@/lib/db/helpers/time.js";
import { getSettings, updateSettings, getTimezone } from "@/lib/db/repos/settingsRepo.js";
import { getChartData, getRecentLogs } from "@/lib/db/repos/usageRepo.js";

describe("timezone support", () => {
  it("validates timezones correctly", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Invalid/Timezone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("computes local date key in specified timezone", () => {
    // 2026-09-17 21:00 UTC is 2026-09-18 04:00 in Jakarta (WIB, UTC+7)
    const utcMidnightMinus3h = "2026-09-17T21:00:00.000Z";
    expect(getLocalDateKey(utcMidnightMinus3h, "UTC")).toBe("2026-09-17");
    expect(getLocalDateKey(utcMidnightMinus3h, "Asia/Jakarta")).toBe("2026-09-18");
  });

  it("computes start of day UTC for any timezone", () => {
    const sodJakarta = getStartOfDayUtc("Asia/Jakarta");
    const sodUtc = getStartOfDayUtc("UTC");
    expect(sodJakarta.getTime()).toBeLessThanOrEqual(sodUtc.getTime());
  });

  it("formats log dates in specified timezone", () => {
    const testIso = new Date("2026-09-18T01:30:15.000Z");
    expect(formatLogDate(testIso, "UTC")).toBe("18-09-2026 01:30:15");
    expect(formatLogDate(testIso, "Asia/Jakarta")).toBe("18-09-2026 08:30:15");
  });

  it("parses filter dates with timezone awareness", () => {
    expect(parseFilterDate("2026-09-18T08:30", "Asia/Jakarta")).toBe(
      "2026-09-18T01:30:00.000Z",
    );
    expect(parseFilterDate("2026-09-18T08:30", "UTC")).toBe("2026-09-18T08:30:00.000Z");
    expect(parseFilterDate("2026-09-18T01:30:00.000Z", "Asia/Jakarta")).toBe(
      "2026-09-18T01:30:00.000Z",
    );
  });

  it("updates and retrieves timezone in settingsRepo", async () => {
    const origSettings = await getSettings();
    await updateSettings({ timezone: "Asia/Jakarta" });
    const tz = await getTimezone();
    expect(tz).toBe("Asia/Jakarta");

    const chart = await getChartData("today");
    expect(chart.length).toBe(24);
    expect(chart[0].label).toBe("00:00");
    expect(chart[23].label).toBe("23:00");

    const logs = await getRecentLogs(5);
    expect(Array.isArray(logs)).toBe(true);

    // Restore
    await updateSettings({ timezone: origSettings.timezone || "auto" });
  });

  it("resolves auto timezone to clientTimezone when available", async () => {
    const origSettings = await getSettings();
    await updateSettings({ timezone: "auto", clientTimezone: "Asia/Jakarta" });
    const tz = await getTimezone();
    expect(tz).toBe("Asia/Jakarta");
    await updateSettings({ timezone: origSettings.timezone || "auto", clientTimezone: origSettings.clientTimezone || "" });
  });
});
