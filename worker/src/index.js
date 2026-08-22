const MODES = ["regular", "pve", "pvp-season"];
const CACHE_TTL_SECONDS = 120;
const POLL_INTERVAL_MS = 2 * 60 * 1000;
const FALLBACK_CRON_MS = 30 * 60 * 1000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extra,
    },
  });
}

async function headItemsEtag(env, mode) {
  const base = (env.UPSTREAM_BASE || "https://json.tarkov.dev").replace(/\/$/, "");
  const response = await fetch(`${base}/${mode}/items`, {
    method: "HEAD",
    headers: {
      "User-Agent": `TarkovBartersCrafts/1.0 (${env.GITHUB_REPO || "profit-tracker"}; visit etag gate)`,
    },
  });
  if (!response.ok) {
    throw new Error(`HEAD /${mode}/items ${response.status}`);
  }
  return response.headers.get("etag");
}

async function dispatch(env, modes) {
  const token = env.GITHUB_DISPATCH_TOKEN;
  const repo = env.GITHUB_REPO;
  if (!token || !repo || repo.includes("REPLACE_ME")) {
    throw new Error("GITHUB_DISPATCH_TOKEN and GITHUB_REPO must be configured");
  }
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "TarkovBartersCrafts-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "tarkov-poll",
      client_payload: { modes: modes.join(",") },
    }),
  });
  if (!response.ok) {
    throw new Error(`repository_dispatch ${response.status} ${await response.text()}`);
  }
}

async function checkAndDispatch(env) {
  const changed = [];
  for (const mode of MODES) {
    const etag = await headItemsEtag(env, mode);
    const stored = await env.PROFIT_KV.get(`etag:items:${mode}`);
    if (etag && etag !== stored) changed.push(mode);
  }
  if (changed.length === 0) {
    console.log("etag unchanged");
    return { changed: [] };
  }
  await dispatch(env, changed);
  console.log("dispatched", changed.join(","));
  return { changed };
}

async function maybePoll(env, ctx) {
  const now = Date.now();
  const lastRaw = await env.PROFIT_KV.get("poll:lastAt");
  const lastAt = lastRaw ? Number(lastRaw) : 0;
  const elapsed = now - lastAt;
  if (elapsed < POLL_INTERVAL_MS) {
    return { polled: false, nextPollIn: POLL_INTERVAL_MS - elapsed };
  }
  await env.PROFIT_KV.put("poll:lastAt", String(now));
  ctx.waitUntil(checkAndDispatch(env).catch((err) => console.error("poll failed", err)));
  return { polled: true, queued: true };
}

async function serveBlob(request, env, ctx) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "regular";
  if (!MODES.includes(mode)) {
    return json({ error: "unknown mode" }, 400);
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const body = await env.PROFIT_KV.get(`blob:${mode}`);
  if (!body) {
    return json({ error: "blob not built yet", mode }, 404);
  }

  const response = json(body, 200, {
    "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async scheduled(_event, env, ctx) {
    const now = Date.now();
    const lastRaw = await env.PROFIT_KV.get("poll:lastAt");
    const lastAt = lastRaw ? Number(lastRaw) : 0;
    if (now - lastAt < FALLBACK_CRON_MS) {
      console.log("cron skipped, polled recently");
      return;
    }
    await env.PROFIT_KV.put("poll:lastAt", String(now));
    ctx.waitUntil(checkAndDispatch(env).catch((err) => console.error("cron poll failed", err)));
  },

  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (url.pathname === "/api/blob" && request.method === "GET") {
      return serveBlob(request, env, ctx);
    }
    if (url.pathname === "/api/poll" && request.method === "POST") {
      const result = await maybePoll(env, ctx);
      return json(result);
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }
    return json({ error: "not found" }, 404);
  },
};
