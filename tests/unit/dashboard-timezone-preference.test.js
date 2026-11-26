import { afterEach, expect, it, vi } from "vitest";
import { createRequestTimeFormatter, formatRequestTime, zonedFilterInstant } from "@/shared/utils/dashboardTimeZone.js";

const key = "9router:dashboard-timezone";

function browser() {
  const values = new Map();
  const window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
      removeItem: (name) => values.delete(name),
    },
  });
  vi.stubGlobal("window", window);
  return window;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("follows the browser until explicitly overridden and removes the override on reset", async () => {
  const window = browser();
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  window.localStorage.setItem(key, "Invalid/Zone");
  const { getEffectiveDashboardTimeZone, setDashboardTimeZoneOverride } = await import("@/store/dashboardTimeZoneStore.js");
  expect(getEffectiveDashboardTimeZone()).toBe(browserZone);
  const override = browserZone === "UTC" ? "Asia/Jakarta" : "UTC";
  setDashboardTimeZoneOverride(override);
  vi.resetModules();
  const reloaded = await import("@/store/dashboardTimeZoneStore.js");
  expect(reloaded.getEffectiveDashboardTimeZone()).toBe(override);
  reloaded.setDashboardTimeZoneOverride(null);
  expect(window.localStorage.getItem(key)).toBeNull();
  expect(reloaded.getEffectiveDashboardTimeZone()).toBe(browserZone);
});

it("notifies another open dashboard when the override changes in another tab", async () => {
  const window = browser();
  const { subscribeDashboardTimeZone, getEffectiveDashboardTimeZone } = await import("@/store/dashboardTimeZoneStore.js");
  const updates = [];
  const unsubscribe = subscribeDashboardTimeZone(() => updates.push(getEffectiveDashboardTimeZone()));
  try {
    window.localStorage.setItem(key, "Pacific/Auckland");
    window.dispatchEvent(Object.assign(new Event("storage"), { key }));
    expect(updates).toEqual(["Pacific/Auckland"]);
  } finally { unsubscribe(); }
});

it("formats the same request on the correct local date without changing its instant", () => {
  const instant = new Date("2026-11-26T20:30:00.000Z");
  function parts(timeZone) {
    const values = createRequestTimeFormatter(timeZone).formatToParts(instant);
    return Object.fromEntries(values.map(({ type, value }) => [type, value]));
  }
  expect(parts("UTC")).toMatchObject({ day: "26", minute: "30" });
  expect(parts("Asia/Jakarta")).toMatchObject({ day: "27", minute: "30" });
});

it("interprets log filter inputs in the display zone, including a repeated hour", () => {
  expect(zonedFilterInstant("2026-11-27T03:00", "Asia/Jakarta")).toBe("2026-11-26T20:00:00.000Z");
  expect(zonedFilterInstant("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  expect(zonedFilterInstant("2026-11-01T01:30", "America/New_York", true)).toBe("2026-11-01T06:30:00.000Z");
  expect(zonedFilterInstant("2026-03-08T02:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
  expect(zonedFilterInstant("2026-03-08T01:30", "America/New_York", true)).toBe("2026-03-08T06:30:00.000Z");
  expect(zonedFilterInstant("2026-03-08T03:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
});

it("renders a missing or invalid legacy timestamp without breaking the log", () => {
  const formatter = createRequestTimeFormatter("Asia/Jakarta");
  expect(formatRequestTime(formatter, undefined)).toBe("—");
  expect(formatRequestTime(formatter, "invalid")).toBe("—");
});
