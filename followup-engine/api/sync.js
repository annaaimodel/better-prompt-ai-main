// Cadence - cross-device sync.
//
// Stores the whole app state (the `db` object) as ONE private JSON document in a
// Vercel KV / Upstash Redis store, keyed to a hash of the owner's access code so
// the key is never the code itself. Every device pulls the latest on load and
// pushes a debounced copy on save - last write wins by timestamp, which is right
// for a single owner moving between phone and laptop.
//
//   GET  (x-access-code header)        -> { data, updatedAt }  (data null if none yet)
//   POST { data, updatedAt }           -> { ok, updatedAt }
//
// If no KV store is configured the endpoint returns 503 and the app stays
// local-only (exactly how it works today). Nothing else logs or stores.
//
// Env vars: ACCESS_CODE (required to gate). For storage, EITHER pair works:
//   KV_REST_API_URL + KV_REST_API_TOKEN              (Vercel KV / Upstash integration)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash direct)
import crypto from "crypto";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Largest document we will store (keeps us inside the free-tier request limit).
const MAX_BYTES = 900 * 1024;

function keyFor(code) {
  return "cadence:" + crypto.createHash("sha256").update(String(code)).digest("hex").slice(0, 32);
}

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV get failed (${r.status})`);
  const j = await r.json();
  return j.result == null ? null : j.result; // stored value is a JSON string
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
    body: value,
  });
  if (!r.ok) throw new Error(`KV set failed (${r.status})`);
  return r.json();
}

export default async function handler(req, res) {
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const body = req.method === "POST" ? (req.body || {}) : {};
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }

  // Admin check: is this access code allowed to change locked settings (Lite mode)?
  // ADMIN_CODE is a comma-separated list of admin codes. If unset, everyone is admin
  // (no restriction configured). Returns before the KV check so it works without a store.
  if (req.method === "POST" && body.action === "amIAdmin") {
    const admins = String(process.env.ADMIN_CODE || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.status(200).json({ admin: admins.length === 0 || admins.includes(code) });
    return;
  }

  if (!KV_URL || !KV_TOKEN) { res.status(503).json({ error: "Sync store not configured. Add a KV store in Vercel to enable cross-device sync." }); return; }

  const key = keyFor(code);

  try {
    if (req.method === "GET") {
      const raw = await kvGet(key);
      if (!raw) { res.status(200).json({ data: null, updatedAt: 0 }); return; }
      let parsed = {};
      try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
      res.status(200).json({ data: parsed.data ?? null, updatedAt: parsed.updatedAt || 0 });
      return;
    }
    if (req.method === "POST") {
      if (body.data == null) { res.status(400).json({ error: "No data to sync." }); return; }
      const updatedAt = Number(body.updatedAt) || Date.now();
      const payload = JSON.stringify({ data: body.data, updatedAt });
      if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
        res.status(413).json({ error: "Data too large to sync. Trim old content/leads or export instead." });
        return;
      }
      await kvSet(key, payload);
      res.status(200).json({ ok: true, updatedAt });
      return;
    }
    res.status(405).json({ error: "GET or POST only" });
  } catch (e) {
    res.status(502).json({ error: e?.message || "Sync failed." });
  }
}
