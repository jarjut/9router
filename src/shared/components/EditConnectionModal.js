"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS } from "@/shared/constants/providers";
import Select from "@/shared/components/Select";
import { cn } from "@/shared/utils/cn";
import { getModelsByProviderId } from "@/shared/constants/models";

export default function EditConnectionModal({ isOpen, connection, proxyPools, providerModels = [], onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    priority: 1,
    apiKey: "",
  });
  const [azureData, setAzureData] = useState({
    azureEndpoint: "",
    apiVersion: "2024-10-01-preview",
    deployment: "",
    organization: "",
  });
  const [cloudflareData, setCloudflareData] = useState({ accountId: "" });
  const [awsData, setAwsData] = useState({ profile: "", region: "", accessKeyId: "", sessionToken: "" });
  const [clearAwsSessionToken, setClearAwsSessionToken] = useState(false);
  const [region, setRegion] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modelFilterMode, setModelFilterMode] = useState("none");
  const [selectedFilterModels, setSelectedFilterModels] = useState([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || "",
        priority: connection.priority || 1,
        apiKey: "",
      });
      // Load model filter mode & selected models
      const psd = connection.providerSpecificData || {};
      if (Array.isArray(psd.disabledModels) && psd.disabledModels.length > 0) {
        setModelFilterMode("blacklist");
        setSelectedFilterModels(psd.disabledModels);
      } else if (Array.isArray(psd.enabledModels) && psd.enabledModels.length > 0) {
        setModelFilterMode("whitelist");
        setSelectedFilterModels(psd.enabledModels);
      } else {
        setModelFilterMode("none");
        setSelectedFilterModels([]);
      }
      setModelSearchQuery("");
      // Load Azure-specific data if present
      if (connection.provider === "azure" && connection.providerSpecificData) {
        setAzureData({
          azureEndpoint: connection.providerSpecificData.azureEndpoint || "",
          apiVersion: connection.providerSpecificData.apiVersion || "2024-10-01-preview",
          deployment: connection.providerSpecificData.deployment || "",
          organization: connection.providerSpecificData.organization || "",
        });
      }
      if (connection.provider === "cloudflare-ai" && connection.providerSpecificData) {
        setCloudflareData({ accountId: connection.providerSpecificData.accountId || "" });
      }
      if (AI_PROVIDERS?.[connection.provider]?.credentialForm === "aws") {
        const psd = connection.providerSpecificData || {};
        setAwsData({
          profile: psd.profile || "",
          region: psd.region || "",
          accessKeyId: psd.accessKeyId || "",
          sessionToken: "",
        });
        setClearAwsSessionToken(false);
      }
      // Load region for providers that support it (e.g. xiaomi-tokenplan)
      const providerCfg = AI_PROVIDERS?.[connection.provider];
      if (providerCfg?.regions) {
        const savedRegion = connection.providerSpecificData?.region || providerCfg.defaultRegion || providerCfg.regions[0]?.id || "";
        setRegion(savedRegion);
      }
      setTestResult(null);
      setValidationResult(null);
    }
  }, [connection, isOpen]);

  // Combine provider models with any custom models stored in selectedFilterModels
  const allKnownModels = useMemo(() => {
    const baseList = (Array.isArray(providerModels) && providerModels.length > 0)
      ? providerModels
      : (connection?.provider ? getModelsByProviderId(connection.provider) : []);
    const list = [...baseList];
    const knownIds = new Set(list.map((m) => String(typeof m === "string" ? m : m.id || "").toLowerCase()));
    for (const sel of selectedFilterModels) {
      if (sel && !knownIds.has(String(sel).toLowerCase())) {
        list.push({ id: sel, name: sel });
        knownIds.add(String(sel).toLowerCase());
      }
    }
    return list;
  }, [providerModels, selectedFilterModels, connection?.provider]);

  const displayedModelList = useMemo(() => {
    const q = modelSearchQuery.trim().toLowerCase();
    if (!q) return allKnownModels;
    return allKnownModels.filter((m) => {
      const id = (typeof m === "string" ? m : m.id || "").toLowerCase();
      const name = (typeof m === "string" ? m : m.name || "").toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [allKnownModels, modelSearchQuery]);

  const isOAuth = connection?.authType === "oauth";
  const isAzure = connection?.provider === "azure";
  const isCloudflareAi = connection?.provider === "cloudflare-ai";
  const usesAwsCredentialForm = AI_PROVIDERS?.[connection?.provider]?.credentialForm === "aws";
  const isCompatible = connection
    ? (isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider))
    : false;
  const providerRegions = connection ? (AI_PROVIDERS?.[connection.provider]?.regions || null) : null;

  // Build providerSpecificData for region-aware providers
  const buildRegionSpecificData = () => {
    if (providerRegions && region) return { ...((connection?.providerSpecificData) || {}), region };
    return undefined;
  };

  // The server keeps a saved session token when this password field is blank. Other empty
  // fields still clear their saved values so a profile can be switched to static keys.
  const buildAwsSpecificData = () => ({
    profile: awsData.profile.trim(),
    region: awsData.region.trim(),
    accessKeyId: awsData.accessKeyId.trim(),
    sessionToken: clearAwsSessionToken ? null : awsData.sessionToken.trim(),
  });

  const handleTest = async () => {
    if (!connection?.provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.valid ? "success" : "failed");
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  };

  const handleValidate = async () => {
    if (!connection?.provider || !formData.apiKey) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connection.provider,
          apiKey: formData.apiKey,
          ...(isAzure ? { providerSpecificData: azureData } : {}),
          ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
          ...(usesAwsCredentialForm ? { providerSpecificData: buildAwsSpecificData() } : {}),
          ...(providerRegions ? { providerSpecificData: buildRegionSpecificData() } : {}),
        }),
      });
      const data = await res.json();
      setValidationResult(data.valid ? "success" : "failed");
    } catch {
      setValidationResult("failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!connection) return;
    setSaving(true);
    try {
      const updates = {
        name: formData.name,
        priority: formData.priority,
      };
      if (!isOAuth && formData.apiKey) {
        updates.apiKey = formData.apiKey;
        let isValid = validationResult === "success";
        if (!isValid) {
          try {
            setValidating(true);
            setValidationResult(null);
            const res = await fetch("/api/providers/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: connection.provider,
                apiKey: formData.apiKey,
                ...(isAzure ? { providerSpecificData: azureData } : {}),
                ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
                ...(usesAwsCredentialForm ? { providerSpecificData: buildAwsSpecificData() } : {}),
                ...(providerRegions ? { providerSpecificData: buildRegionSpecificData() } : {}),
              }),
            });
            const data = await res.json();
            isValid = !!data.valid;
            setValidationResult(isValid ? "success" : "failed");
          } catch {
            setValidationResult("failed");
          } finally {
            setValidating(false);
          }
        }
        if (isValid) {
          updates.testStatus = "active";
          updates.lastError = null;
          updates.lastErrorAt = null;
        }
      }
      
      // Add Azure-specific data if this is an Azure connection
      if (isAzure) {
        updates.providerSpecificData = {
          azureEndpoint: azureData.azureEndpoint,
          apiVersion: azureData.apiVersion,
          deployment: azureData.deployment,
          organization: azureData.organization,
        };
      }
      if (isCloudflareAi) {
        updates.providerSpecificData = { accountId: cloudflareData.accountId };
      }
      if (usesAwsCredentialForm) {
        updates.providerSpecificData = buildAwsSpecificData();
      }
      // Persist updated region for region-aware providers
      if (providerRegions && region) {
        updates.providerSpecificData = buildRegionSpecificData();
      }

      // Apply model filter updates
      const modelFilterUpdates = {};
      if (modelFilterMode === "blacklist") {
        modelFilterUpdates.disabledModels = selectedFilterModels;
        modelFilterUpdates.enabledModels = null;
      } else if (modelFilterMode === "whitelist") {
        modelFilterUpdates.enabledModels = selectedFilterModels;
        modelFilterUpdates.disabledModels = null;
      } else {
        modelFilterUpdates.disabledModels = null;
        modelFilterUpdates.enabledModels = null;
      }

      updates.providerSpecificData = {
        ...(connection?.providerSpecificData || {}),
        ...(updates.providerSpecificData || {}),
        ...modelFilterUpdates,
      };
      
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  if (!connection) return null;

  return (
    <Modal isOpen={isOpen} title="Edit Connection" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={isOAuth ? "Account name" : "Production Key"}
        />
        {isOAuth && connection.email && (
          <div className="bg-sidebar/50 p-3 rounded-lg">
            <p className="text-sm text-text-muted mb-1">Email</p>
            <p className="font-medium">{connection.email}</p>
          </div>
        )}
        <Input
          label="Priority"
          type="number"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: Number.parseInt(e.target.value, 10) || 1 })}
        />

        {/* Model Access Filter */}
        <div className="bg-sidebar/50 p-3.5 rounded-lg border border-accent/20 flex flex-col gap-2.5">
          <Select
            label="Model Filter"
            value={modelFilterMode}
            onChange={(e) => setModelFilterMode(e.target.value)}
            options={[
              { value: "none", label: "None (All models allowed)" },
              { value: "blacklist", label: "Blacklist (Exclude selected models)" },
              { value: "whitelist", label: "Whitelist (Only allow selected models)" },
            ]}
          />

          {modelFilterMode !== "none" && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-xs text-text-muted">
                {modelFilterMode === "blacklist"
                  ? "Selected models will be skipped and routed to other accounts."
                  : "Only selected models will be routed to this account."}
              </p>

              <div className="flex gap-2">
                <Input
                  placeholder="Filter models or type model ID..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = modelSearchQuery.trim();
                      if (!trimmed) return;
                      const matched = displayedModelList.find((m) => {
                        const id = String(typeof m === "string" ? m : m.id || "").toLowerCase();
                        const name = String(typeof m === "string" ? m : m.name || "").toLowerCase();
                        return id === trimmed.toLowerCase() || name === trimmed.toLowerCase();
                      });
                      const targetId = matched ? (typeof matched === "string" ? matched : matched.id) : trimmed;
                      if (!selectedFilterModels.includes(targetId)) {
                        setSelectedFilterModels([...selectedFilterModels, targetId]);
                        setModelSearchQuery("");
                      }
                    }
                  }}
                />
                {modelSearchQuery.trim() && !displayedModelList.some(m => (m.id || m) === modelSearchQuery.trim()) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const trimmed = modelSearchQuery.trim();
                      if (trimmed && !selectedFilterModels.includes(trimmed)) {
                        setSelectedFilterModels([...selectedFilterModels, trimmed]);
                        setModelSearchQuery("");
                      }
                    }}
                  >
                    Add
                  </Button>
                )}
              </div>

              {/* Action summary */}
              <div className="flex items-center justify-between text-xs text-text-muted mt-0.5">
                <span>
                  {selectedFilterModels.length} model{selectedFilterModels.length === 1 ? "" : "s"} {modelFilterMode === "blacklist" ? "disabled" : "allowed"}
                </span>
                {selectedFilterModels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFilterModels([])}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Model pills */}
              <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 bg-surface-2/60 rounded-lg border border-accent/10">
                {displayedModelList.length === 0 ? (
                  <span className="text-xs text-text-muted p-1">No matching models found.</span>
                ) : (
                  displayedModelList.map((m) => {
                    const id = typeof m === "string" ? m : m.id;
                    const name = typeof m === "string" ? m : (m.name || m.id);
                    const isSelected = selectedFilterModels.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setSelectedFilterModels((prev) =>
                            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                          );
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5 border cursor-pointer",
                          isSelected
                            ? modelFilterMode === "blacklist"
                              ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                              : "bg-brand-500/20 text-brand-300 border-brand-500/40 hover:bg-brand-500/30"
                            : "bg-surface-3/60 text-text-muted border-transparent hover:text-text-main hover:bg-surface-3"
                        )}
                      >
                        <span>{name}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold">
                            {modelFilterMode === "blacklist" ? "✕" : "✓"}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {!isOAuth && (
          <>
            <div className="flex gap-2">
              <Input
                label="API Key"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Enter new API key"
                hint="Leave blank to keep the current API key."
                className="flex-1"
              />
              <div className="pt-6">
                <Button onClick={handleValidate} disabled={!formData.apiKey || validating || saving} variant="secondary">
                  {validating ? "Checking..." : "Check"}
                </Button>
              </div>
            </div>
            {validationResult && (
              <Badge variant={validationResult === "success" ? "success" : "error"}>
                {validationResult === "success" ? "Valid" : "Invalid"}
              </Badge>
            )}
          </>
        )}

        {isAzure && (
          <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
            <h3 className="font-semibold mb-3 text-sm">Azure OpenAI Configuration</h3>
            <div className="flex flex-col gap-3">
              <Input
                label="Azure Endpoint"
                value={azureData.azureEndpoint}
                onChange={(e) => setAzureData({ ...azureData, azureEndpoint: e.target.value })}
                placeholder="https://your-resource.openai.azure.com"
                hint="Your Azure OpenAI resource endpoint URL"
              />
              <Input
                label="Deployment Name"
                value={azureData.deployment}
                onChange={(e) => setAzureData({ ...azureData, deployment: e.target.value })}
                placeholder="gpt-4"
                hint="The deployment name in your Azure resource"
              />
              <Input
                label="API Version"
                value={azureData.apiVersion}
                onChange={(e) => setAzureData({ ...azureData, apiVersion: e.target.value })}
                placeholder="2024-10-01-preview"
                hint="Azure OpenAI API version to use"
              />
              <Input
                label="Organization"
                value={azureData.organization}
                onChange={(e) => setAzureData({ ...azureData, organization: e.target.value })}
                placeholder="Organization ID"
                hint="Required for billing"
              />
            </div>
          </div>
        )}

        {usesAwsCredentialForm && (
          <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
            <h3 className="font-semibold mb-3 text-sm">AWS Bedrock Credentials</h3>
            <div className="flex flex-col gap-3">
              <Input
                label="AWS Profile (SSO — recommended)"
                value={awsData.profile}
                onChange={(e) => setAwsData({ ...awsData, profile: e.target.value })}
                placeholder="my-sso-profile"
                hint="Clear this to use static keys instead; a profile takes precedence."
              />
              <Input
                label="Region"
                value={awsData.region}
                onChange={(e) => setAwsData({ ...awsData, region: e.target.value })}
                placeholder="us-east-1"
              />
              <Input
                label="Access Key ID (only for static keys)"
                value={awsData.accessKeyId}
                onChange={(e) => setAwsData({ ...awsData, accessKeyId: e.target.value })}
                placeholder="AKIA..."
              />
              <Input
                label="Session Token (only for temporary ASIA… keys)"
                type="password"
                value={awsData.sessionToken}
                onChange={(e) => setAwsData({ ...awsData, sessionToken: e.target.value })}
                placeholder="FwoGZXIvYXdz..."
                hint="Leave blank to keep the saved token. Enter a new token to replace it."
                disabled={clearAwsSessionToken}
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={clearAwsSessionToken}
                  onChange={(e) => {
                    setClearAwsSessionToken(e.target.checked);
                    if (e.target.checked) setAwsData({ ...awsData, sessionToken: "" });
                  }}
                />
                Remove saved session token
              </label>
            </div>
          </div>
        )}

        {providerRegions && (
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={providerRegions.map((r) => ({ value: r.id, label: r.label }))}
          />
        )}

        {!isCompatible && !isAzure && !isCloudflareAi && (
          <div className="flex items-center gap-3">
            <Button onClick={handleTest} variant="secondary" disabled={testing}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            {testResult && (
              <Badge variant={testResult === "success" ? "success" : "error"}>
                {testResult === "success" ? "Valid" : "Failed"}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

EditConnectionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  connection: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    priority: PropTypes.number,
    authType: PropTypes.string,
    provider: PropTypes.string,
    providerSpecificData: PropTypes.object,
  }),
  proxyPools: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  providerModels: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
