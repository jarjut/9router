import { getZonedDayBounds, normalizeDashboardTimeZone } from "@/shared/utils/dashboardTimeZone.js";

export function readUsageTimeOptions(searchParams, period) {
  const value = searchParams.get("timeZone");
  const timeZone = value === null ? undefined : normalizeDashboardTimeZone(value);
  if (timeZone === null) return null;
  const date = searchParams.get("date");
  if (date === null) return { timeZone };
  if (period !== "today") return null;
  const dayBounds = getZonedDayBounds(date, timeZone);
  return dayBounds ? { timeZone, dayBounds } : null;
}
