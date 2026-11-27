import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let db;
let adapter;
let tempDir;
let priorDataDir;
let chart;
let stats;
let logs;
let comboLogs;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-timezone-"));
  priorDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tempDir;
  db = await import("@/lib/db/index.js");
  await db.initDb();
  adapter = await (await import("@/lib/db/driver.js")).getAdapter();
  await record("2026-11-01T05:30:00.000Z");
  await record("2026-11-01T06:30:00.000Z");
  chart = (await import("@/app/api/usage/chart/route.js")).GET;
  stats = (await import("@/app/api/usage/stats/route.js")).GET;
  logs = (await import("@/app/api/usage/request-logs/route.js")).GET;
  comboLogs = (await import("@/app/api/usage/logs/route.js")).GET;
});

afterAll(() => {
  vi.restoreAllMocks();
  if (priorDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = priorDataDir;
  adapter?.close();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

async function record(timestamp, model = "timezone-test") {
  await db.saveRequestUsage({ timestamp, model, provider: "openai", tokens: { prompt_tokens: 2, completion_tokens: 1 } });
}

function usageQuery({ timeZone, date, period = "today" } = {}) {
  const query = new URLSearchParams({ period });
  if (timeZone) query.set("timeZone", timeZone);
  if (date) query.set("date", date);
  return new Request(`http://localhost/api/usage?${query}`);
}

const totalRequests = (buckets) => buckets.reduce((sum, bucket) => sum + bucket.requests, 0);

describe("Usage calendar timezone", () => {
  it("uses the selected local date and the same half-open range in Today's chart and stats", async () => {
    for (const timestamp of [
      "2026-11-26T16:59:59.999Z",
      "2026-11-26T17:00:00.000Z",
      "2026-11-27T16:59:59.999Z",
      "2026-11-27T17:00:00.000Z",
    ]) await record(timestamp);

    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-26T20:30:00Z"));
    try {
      const request = usageQuery({ timeZone: "Asia/Jakarta" });
      const buckets = await (await chart(request)).json();
      const summary = await (await stats(request)).json();
      expect(buckets).toHaveLength(24);
      expect(buckets[0]).toMatchObject({ label: "00:00", requests: 1, tokens: 3 });
      expect(buckets[23]).toMatchObject({ label: "23:00", requests: 1, tokens: 3 });
      expect(totalRequests(buckets)).toBe(2);
      expect(summary).toMatchObject({ totalRequests: 2, totalPromptTokens: 4, totalCompletionTokens: 2 });
    } finally { clock.mockRestore(); }
  });

  it("keeps repeated DST hours distinct and does not invent a missing hour", async () => {
    const zone = "America/New_York";
    const autumn = await (await chart(usageQuery({ timeZone: zone, date: "2026-11-01" }))).json();
    expect(autumn).toHaveLength(25);
    expect(autumn.filter(({ requests }) => requests)).toEqual([
      expect.objectContaining({ label: "01:00 GMT-4", requests: 1 }),
      expect.objectContaining({ label: "01:00 GMT-5", requests: 1 }),
    ]);
    const spring = await (await chart(usageQuery({ timeZone: zone, date: "2026-03-08" }))).json();
    expect(spring).toHaveLength(23);
    expect(spring.slice(0, 3).map(({ label }) => label)).toEqual(["00:00", "01:00", "03:00"]);
  });

  it("bounds a non-hour DST shift and handles a skipped midnight", async () => {
    await record("2026-10-04T12:59:59.999Z");
    await record("2026-10-04T13:00:00.000Z");
    const request = usageQuery({ timeZone: "Australia/Lord_Howe", date: "2026-10-04" });
    const buckets = await (await chart(request)).json();
    expect(buckets.at(-1)).toMatchObject({ label: "23:30", requests: 1 });
    expect(totalRequests(buckets)).toBe(1);
    expect((await (await stats(request)).json()).totalRequests).toBe(1);

    await record("2018-11-04T02:59:59.999Z");
    await record("2018-11-04T03:00:00.000Z");
    const skipped = await (await chart(usageQuery({ timeZone: "America/Sao_Paulo", date: "2018-11-04" }))).json();
    expect(skipped).toHaveLength(23);
    expect(skipped[0]).toMatchObject({ label: "01:00", requests: 1 });
    expect(totalRequests(skipped)).toBe(1);
  });

  it("counts a request on its local date when the clock returns to the previous day", async () => {
    await record("2009-11-01T02:30:30.000Z"); // November 1, before the rollback
    await record("2009-11-01T03:00:00.000Z"); // October 31, after the rollback
    await record("2009-11-01T03:30:30.000Z"); // November 1 again
    for (const [date, requests] of [["2009-10-31", 1], ["2009-11-01", 2]]) {
      const query = usageQuery({ timeZone: "America/St_Johns", date });
      expect(totalRequests(await (await chart(query)).json())).toBe(requests);
      expect((await (await stats(query)).json()).totalRequests).toBe(requests);
    }
  });

  it("keeps 24h rolling and leaves historical daily rollups alone", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-02T04:00:00Z"));
    try {
      const rolling = await (await chart(usageQuery({ period: "24h", timeZone: "America/New_York" }))).json();
      expect(rolling).toHaveLength(24);
      expect(rolling[0].label).toBe("00:00");
      expect(rolling.at(-1).label).toBe("22:00");
      expect(totalRequests(rolling)).toBe(2);
      const plain = await (await chart(usageQuery({ period: "7d" }))).json();
      expect(await (await chart(usageQuery({ period: "7d", timeZone: "Asia/Jakarta" }))).json()).toEqual(plain);
    } finally { clock.mockRestore(); }
  });

  it("rejects invalid zones and invalid calendar dates", async () => {
    for (const endpoint of [chart, stats]) {
      expect((await endpoint(usageQuery({ timeZone: "Invalid/Zone" }))).status).toBe(400);
      expect((await endpoint(usageQuery({ timeZone: "UTC", date: "2026-02-30" }))).status).toBe(400);
    }
  });

  it("keeps text logs by default and serves structured UTC logs on request", async () => {
    await record("2026-11-26T20:30:00.000Z", "combo | test");
    for (const endpoint of [logs, comboLogs]) {
      const url = "http://localhost/api/usage/logs";
      const legacy = await (await endpoint(new Request(url))).json();
      expect(legacy).toContainEqual(expect.stringMatching(/ \| combo \| test \| OPENAI \| - \| 2 \| 1 \| /));
      const rows = await (await endpoint(new Request(`${url}?format=json`))).json();
      expect(rows).toContainEqual(expect.objectContaining({
        timestamp: "2026-11-26T20:30:00.000Z",
        model: "combo | test",
        promptTokens: 2,
        completionTokens: 1,
      }));
    }
  });
});
