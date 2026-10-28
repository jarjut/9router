import { getProviderConnections, updateProviderConnection } from "@/models";
import { resolveProviderId, getProviderAlias } from "@/shared/constants/providers";

/**
 * Clear cooldown for a specific model across all connections belonging to a provider.
 * Also cleans up any already-expired model locks on those connections.
 * If no active locks remain on a connection, resets its error status back to "active".
 *
 * @param {string} providerId - Canonical provider ID or alias (e.g. "codex" or "cx")
 * @param {string} modelId - Model ID (e.g. "gpt-5.3" or "cx/gpt-5.3")
 * @returns {Promise<{ success: boolean, clearedCount: number, affectedConnections: string[] }>}
 */
export async function clearModelCooldownForProvider(providerId, modelId) {
  if (!providerId || !modelId) {
    return { success: false, clearedCount: 0, affectedConnections: [] };
  }

  const resolvedProvider = resolveProviderId(providerId);
  const providerAlias = getProviderAlias(resolvedProvider);
  const prefixes = [resolvedProvider, providerId, providerAlias].filter(Boolean);
  const prefixRegex = new RegExp(`^(?:${prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})/`, "i");
  const cleanModel = modelId.replace(prefixRegex, "").trim();
  const targetKey = `modelLock_${cleanModel}`;

  const connections = await getProviderConnections({ provider: resolvedProvider });
  const now = Date.now();
  let clearedCount = 0;
  const affectedConnections = [];

  for (const conn of connections) {
    const allLockKeys = Object.keys(conn).filter((k) => k.startsWith("modelLock_") && conn[k] != null);
    const hasTargetLock = Object.prototype.hasOwnProperty.call(conn, targetKey) && conn[targetKey] != null;

    if (!hasTargetLock && allLockKeys.length === 0) continue;

    // Keys to clear: targetKey (if non-null) + any other non-null lock that has expired
    const keysToClear = allLockKeys.filter((k) => {
      if (k === targetKey) return true;
      const expiry = conn[k];
      return expiry && new Date(expiry).getTime() <= now;
    });

    if (keysToClear.length === 0) continue;

    const remainingActiveLocks = allLockKeys.filter((k) => {
      if (keysToClear.includes(k)) return false;
      const expiry = conn[k];
      return expiry && new Date(expiry).getTime() > now;
    });

    const updateObj = Object.fromEntries(keysToClear.map((k) => [k, null]));

    if (remainingActiveLocks.length === 0 && conn.testStatus === "unavailable") {
      Object.assign(updateObj, {
        testStatus: "active",
        lastError: null,
        errorCode: null,
        lastErrorAt: null,
        backoffLevel: 0,
      });
    }

    await updateProviderConnection(conn.id, updateObj);
    if (hasTargetLock) clearedCount++;
    affectedConnections.push(conn.id);
  }

  return {
    success: true,
    clearedCount,
    affectedConnections,
  };
}
