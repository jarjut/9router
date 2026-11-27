"use client";

import { useMemo } from "react";
import { useDashboardTimeZone } from "@/store/dashboardTimeZoneStore.js";
import Card from "./Card";

export default function DashboardTimeZoneSetting() {
  const { timeZone, override, setOverride } = useDashboardTimeZone();
  const zones = useMemo(() => {
    if (!timeZone) return [];
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [...new Set(["UTC", browserZone, timeZone, ...(Intl.supportedValuesOf?.("timeZone") || [])])]
      .filter(Boolean)
      .sort();
  }, [timeZone]);

  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold sm:text-lg" id="dashboard-timezone-label">Time zone</h3>
      <select
        aria-labelledby="dashboard-timezone-label"
        aria-describedby="dashboard-timezone-description"
        className="w-full rounded-lg border border-border bg-bg p-3 text-sm"
        disabled={!timeZone}
        value={override || ""}
        onChange={(event) => setOverride(event.target.value || null)}
      >
        <option value="">Automatic (browser){!override && timeZone ? ` — ${timeZone}` : ""}</option>
        {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
      </select>
      <p className="mt-2 text-sm text-text-muted" id="dashboard-timezone-description">
        Applies to request timestamps and the Usage Today period. Saved only in this browser.
      </p>
    </Card>
  );
}
