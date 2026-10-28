import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getSettings: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getSettings: mocks.getSettings,
  getProxyPools: vi.fn(),
  validateApiKey: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
  pickProxyPoolId: vi.fn(),
}));

vi.mock("@/shared/constants/providers.js", () => ({
  FREE_PROVIDERS: {},
  resolveProviderId: (provider) => provider,
}));

vi.mock("@/sse/utils/logger.js", () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn() }));

const { getProviderCredentials } = await import("@/sse/services/auth.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveConnectionProxyConfig.mockResolvedValue({});
  mocks.getSettings.mockResolvedValue({});
});

describe("Per-connection model filtering (whitelist & blacklist)", () => {
  it("skips connection with disabledModels matching base or tier prefix", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          disabledModels: ["gemini-4-argon"],
        },
      },
      {
        id: "ag-2",
        email: "ag2@example.com",
        isActive: true,
        providerSpecificData: {},
      },
    ]);

    // Requesting gemini-4-argon-high should skip ag-1 and pick ag-2
    const res = await getProviderCredentials("antigravity", null, "gemini-4-argon-high");
    expect(res).toMatchObject({
      connectionId: "ag-2",
      connectionName: "ag2@example.com",
    });
  });

  it("handles provider prefix in requested model for disabledModels", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          disabledModels: ["gemini-4-argon"],
        },
      },
      {
        id: "ag-2",
        email: "ag2@example.com",
        isActive: true,
      },
    ]);

    const res = await getProviderCredentials("antigravity", null, "antigravity/gemini-4-argon-medium");
    expect(res).toMatchObject({
      connectionId: "ag-2",
      connectionName: "ag2@example.com",
    });
  });

  it("allows connection when requested model is not in disabledModels", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          disabledModels: ["gemini-4-argon"],
        },
      },
      {
        id: "ag-2",
        email: "ag2@example.com",
        isActive: true,
      },
    ]);

    const res = await getProviderCredentials("antigravity", null, "claude-sonnet-5-5-high");
    expect(res).toMatchObject({
      connectionId: "ag-1",
      connectionName: "ag1@example.com",
    });
  });

  it("only routes to connection when model matches enabledModels whitelist", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          enabledModels: ["gemini-4-argon"],
        },
      },
      {
        id: "ag-2",
        email: "ag2@example.com",
        isActive: true,
        providerSpecificData: {
          enabledModels: ["claude-sonnet-5-5-high"],
        },
      },
    ]);

    const resArgon = await getProviderCredentials("antigravity", null, "gemini-4-argon-high");
    expect(resArgon).toMatchObject({
      connectionId: "ag-1",
      connectionName: "ag1@example.com",
    });

    const resClaude = await getProviderCredentials("antigravity", null, "claude-sonnet-5-5-high");
    expect(resClaude).toMatchObject({
      connectionId: "ag-2",
      connectionName: "ag2@example.com",
    });
  });

  it("returns null when all connections disallow the model", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          disabledModels: ["gemini-4-argon"],
        },
      },
    ]);

    const res = await getProviderCredentials("antigravity", null, "gemini-4-argon-low");
    expect(res).toBeNull();
  });

  it("does not false-positive collide when specific tier is disabled on another tier", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          disabledModels: ["gemini-4-argon-high"],
        },
      },
    ]);

    // Disabling gemini-4-argon-high should NOT disable gemini-4-argon-medium
    const res = await getProviderCredentials("antigravity", null, "gemini-4-argon-medium");
    expect(res).toMatchObject({
      connectionId: "ag-1",
      connectionName: "ag1@example.com",
    });
  });

  it("blocks all models when enabledModels is an empty whitelist array", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "ag-1",
        email: "ag1@example.com",
        isActive: true,
        providerSpecificData: {
          enabledModels: [],
        },
      },
    ]);

    const res = await getProviderCredentials("antigravity", null, "claude-sonnet-5-5-high");
    expect(res).toBeNull();
  });
});
