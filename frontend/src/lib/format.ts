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

export function formatUpdated(iso: string, now = Date.now()): { label: string; stale: boolean } {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: "unknown", stale: true };
  const ageMs = now - then;
  const stale = ageMs > 2 * 60 * 60 * 1000;
  const minutes = Math.floor(ageMs / 60000);
  let relative = "just now";
  if (minutes >= 60) relative = `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  else if (minutes >= 1) relative = `${minutes}m ago`;
  const absolute = new Date(iso).toLocaleString();
  return { label: `${relative} (${absolute})`, stale };
}

export function profitClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "zero";
}
