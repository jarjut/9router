"use client";

import { useSyncExternalStore } from "react";
import { normalizeDashboardTimeZone } from "@/shared/utils/dashboardTimeZone.js";

const STORAGE_KEY = "9router:dashboard-timezone";
const CHANGE_EVENT = "9router:dashboard-timezone-change";
const serverSnapshot = { timeZone: null, override: null };
let snapshot = serverSnapshot;
let lastStored;
let override = null;

function readOverride() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== lastStored) {
      lastStored = stored;
      override = normalizeDashboardTimeZone(stored);
    }
  } catch {
    // When storage is unavailable, keep the override for this session.
  }
  return override;
}

function getSnapshot() {
  if (typeof window === "undefined") return serverSnapshot;
  const stored = readOverride();
  const timeZone = stored || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (snapshot.timeZone !== timeZone || snapshot.override !== stored) snapshot = { timeZone, override: stored };
  return snapshot;
}

export function getEffectiveDashboardTimeZone() {
  return getSnapshot().timeZone;
}

export function setDashboardTimeZoneOverride(value) {
  const zone = normalizeDashboardTimeZone(value);
  if (value !== null && !zone) return;
  override = zone;
  lastStored = zone;
  try {
    if (zone) window.localStorage.setItem(STORAGE_KEY, zone);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory value still applies when browser storage is blocked.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeDashboardTimeZone(notify) {
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener("focus", notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener("focus", notify);
  };
}

export function useDashboardTimeZone() {
  const state = useSyncExternalStore(subscribeDashboardTimeZone, getSnapshot, () => serverSnapshot);
  return { ...state, setOverride: setDashboardTimeZoneOverride };
}
