import type { ProfitBlob } from "@compute/index.mjs";

export function workerBase(): string {
  return (import.meta.env.VITE_BLOB_BASE || "").replace(/\/$/, "");
}

/** Ask the worker to check tarkov.dev (no-op without VITE_BLOB_BASE). Rate-limited server-side. */
export async function requestPoll(): Promise<void> {
  const base = workerBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/poll`, { method: "POST" });
  } catch {
    /* background refresh */
  }
}

export function blobUrls(mode: string): string[] {
  const base = workerBase();
  const urls: string[] = [];
  if (base) urls.push(`${base}/api/blob?mode=${mode}`);
  else if (import.meta.env.PROD) urls.push(`/api/blob?mode=${mode}`);
  urls.push(`/blob-${mode}.json`);
  return [...new Set(urls)];
}

export async function loadBlob(mode: string): Promise<ProfitBlob> {
  const errors: string[] = [];
  for (const url of blobUrls(mode)) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const text = await response.text();
      if (!response.ok || text.trimStart().startsWith("<")) {
        errors.push(`${url} ${response.status}${text.trimStart().startsWith("<") ? " (not JSON)" : ""}`);
        continue;
      }
      return JSON.parse(text) as ProfitBlob;
    } catch (error) {
      errors.push(`${url} ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  throw new Error(
    `Could not load ${mode} data. Run npm run blob -- --all for local files, or point VITE_BLOB_BASE at the worker. ${errors.join("; ")}`,
  );
}
