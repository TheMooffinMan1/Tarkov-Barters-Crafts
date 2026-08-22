const roubles = new Intl.NumberFormat("en-US");

export function formatRoubles(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}${roubles.format(Math.abs(rounded))} ₽`;
}

/** Quantity for craft/barter lines (supports fractions like 0.66). */
export function formatQty(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

function relativeAgeLabel(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

export function formatRelativeAge(when: string | number, now = Date.now()): string {
  const then = typeof when === "number" ? when : new Date(when).getTime();
  if (Number.isNaN(then)) return "unknown";
  return relativeAgeLabel(Math.max(0, now - then));
}

export function formatAbsoluteTime(when: string | number): string {
  const then = typeof when === "number" ? when : new Date(when).getTime();
  if (Number.isNaN(then)) return "Unknown";
  return new Date(then).toLocaleString();
}

export function formatUpdated(iso: string, now = Date.now()): { label: string; stale: boolean } {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: "unknown", stale: true };
  const ageMs = blobAgeMs(iso, now);
  const stale = ageMs > 2 * 60 * 60 * 1000;
  const absolute = new Date(iso).toLocaleString();
  return { label: `${relativeAgeLabel(ageMs)} (${absolute})`, stale };
}

/** Show "Refreshing data" and poll faster once prices are older than this. */
export const REFRESH_AFTER_MS = 15 * 60 * 1000;

export function blobAgeMs(iso: string, now = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.max(0, now - then);
}

export function blobNeedsRefresh(iso: string, now = Date.now(), thresholdMs = REFRESH_AFTER_MS): boolean {
  return blobAgeMs(iso, now) > thresholdMs;
}

export function profitClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "zero";
}
