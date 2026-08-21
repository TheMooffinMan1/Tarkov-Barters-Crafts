function accountBase() {
  const account = process.env.CF_ACCOUNT_ID;
  const namespace = process.env.CF_KV_NAMESPACE_ID;
  if (!account || !namespace) {
    throw new Error("CF_ACCOUNT_ID and CF_KV_NAMESPACE_ID are required to write KV");
  }
  return `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}`;
}

function kvHeaders() {
  const token = process.env.CF_API_TOKEN;
  if (!token) throw new Error("CF_API_TOKEN is required to write KV");
  return { Authorization: `Bearer ${token}` };
}

export async function kvGet(key) {
  const response = await fetch(`${accountBase()}/values/${encodeURIComponent(key)}`, {
    headers: kvHeaders(),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`KV GET ${key} failed: ${response.status} ${await response.text()}`);
  }
  return response.text();
}

export async function kvPut(key, value) {
  const response = await fetch(`${accountBase()}/values/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { ...kvHeaders(), "Content-Type": "text/plain" },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
  if (!response.ok) {
    throw new Error(`KV PUT ${key} failed: ${response.status} ${await response.text()}`);
  }
}

export function etagKey(mode) {
  return `etag:items:${mode}`;
}

export function blobKey(mode) {
  return `blob:${mode}`;
}
