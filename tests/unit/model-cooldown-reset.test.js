import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

vi.mock("@/models", () => db);
vi.mock("@/lib/db/repos/connectionsRepo", () => db);

describe("Model cooldown reset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears modelLock_<model> for all connections belonging to provider", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-1",
        provider: "codex",
        testStatus: "unavailable",
        lastError: "Rate limited",
        backoffLevel: 3,
        modelLock_gpt_5_3: "2026-10-28T12:30:00.000Z",
      },
      {
        id: "conn-2",
        provider: "codex",
        testStatus: "active",
        modelLock_gpt_5_3: "2026-10-28T12:15:00.000Z",
      },
      {
        id: "conn-3",
        provider: "codex",
        testStatus: "active",
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("codex", "gpt_5_3");

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(2);
    expect(db.updateProviderConnection).toHaveBeenCalledTimes(2);

    // conn-1 has no other locks, so testStatus should be reset to active
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-1", {
      modelLock_gpt_5_3: null,
      testStatus: "active",
      lastError: null,
      errorCode: null,
      lastErrorAt: null,
      backoffLevel: 0,
    });

    // conn-2 was active, so testStatus is untouched
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-2", {
      modelLock_gpt_5_3: null,
    });
  });

  it("retains unavailable status if another model lock is still active", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-multi",
        provider: "codex",
        testStatus: "unavailable",
        lastError: "Rate limited",
        backoffLevel: 2,
        modelLock_gpt_5_3: "2026-10-28T12:30:00.000Z",
        modelLock_gpt_5_2: "2026-10-28T12:45:00.000Z", // Still active!
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("codex", "gpt_5_3");

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(1);

    // Should NOT reset testStatus because modelLock_gpt_5_2 is still in the future
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-multi", {
      modelLock_gpt_5_3: null,
    });
  });

  it("cleans up past expired model locks during reset", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-expired",
        provider: "codex",
        testStatus: "unavailable",
        lastError: "Rate limited",
        modelLock_gpt_5_3: "2026-10-28T12:30:00.000Z",
        modelLock_old: "2026-10-28T11:00:00.000Z", // In the past
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("codex", "gpt_5_3");

    expect(result.success).toBe(true);
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-expired", {
      modelLock_gpt_5_3: null,
      modelLock_old: null,
      testStatus: "active",
      lastError: null,
      errorCode: null,
      lastErrorAt: null,
      backoffLevel: 0,
    });
  });

  it("normalizes modelId with provider prefix", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-prefix",
        provider: "codex",
        modelLock_gpt_5_3: "2026-10-28T12:30:00.000Z",
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("codex", "cx/gpt_5_3");

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(1);
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-prefix", {
      modelLock_gpt_5_3: null,
    });
  });

  it("resolves provider alias when fetching connections", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    db.getProviderConnections.mockResolvedValue([]);

    await clearModelCooldownForProvider("cx", "gpt_5_3");

    expect(db.getProviderConnections).toHaveBeenCalledWith({ provider: "codex" });
  });

  it("preserves model IDs containing slashes", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-slash",
        provider: "commandcode",
        testStatus: "unavailable",
        "modelLock_moonshotai/Kimi-K2.7-Code": "2026-10-28T12:30:00.000Z",
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("commandcode", "moonshotai/Kimi-K2.7-Code");

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(1);
    expect(db.updateProviderConnection).toHaveBeenCalledWith("conn-slash", {
      "modelLock_moonshotai/Kimi-K2.7-Code": null,
      testStatus: "active",
      lastError: null,
      errorCode: null,
      lastErrorAt: null,
      backoffLevel: 0,
    });
  });

  it("does not reactivate connections when target lock is already null", async () => {
    const { clearModelCooldownForProvider } = await import("../../src/lib/services/cooldownService.js");

    const connections = [
      {
        id: "conn-auth-fail",
        provider: "codex",
        testStatus: "unavailable",
        lastError: "Invalid API key [401]",
        modelLock_gpt_5_3: null, // previously cleared or null
      },
    ];

    db.getProviderConnections.mockResolvedValue(connections);
    db.updateProviderConnection.mockResolvedValue(true);

    const result = await clearModelCooldownForProvider("codex", "gpt_5_3");

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(0);
    expect(db.updateProviderConnection).not.toHaveBeenCalled();
  });
});

describe("POST /api/providers/[id]/cooldown/reset route", () => {
  it("returns 400 when modelId is missing", async () => {
    const { POST } = await import("../../src/app/api/providers/[id]/cooldown/reset/route.js");
    const req = new Request("http://localhost/api/providers/codex/cooldown/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "codex" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("modelId is required");
  });

  it("calls clearModelCooldownForProvider and returns 200 with result", async () => {
    const { POST } = await import("../../src/app/api/providers/[id]/cooldown/reset/route.js");
    db.getProviderConnections.mockResolvedValue([
      { id: "conn-1", provider: "codex", modelLock_gpt_5_3: "2026-10-28T13:00:00.000Z" },
    ]);
    db.updateProviderConnection.mockResolvedValue(true);

    const req = new Request("http://localhost/api/providers/codex/cooldown/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gpt_5_3" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "codex" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.clearedCount).toBe(1);
  });
});
