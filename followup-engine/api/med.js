// Aurum OS - medication quick-reference.
//
// Given a medication name the prospect mentioned on a call, returns its most
// commonly documented side effects and health risks, for the rep's AWARENESS
// only (drug-interaction context, knowing what the customer takes). Not medical
// advice; the prospect's doctor is always the authority.
//
// POST { access_code, name }
// Returns { name, recognized, generic, class, sideEffects:[..3], risks:[..3], usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are a concise clinical drug-reference tool. Given the name of a medication (brand or generic), return its most commonly documented facts, for a non-clinician's AWARENESS only (a sales rep noting what a customer already takes, so they understand it and possible interactions).

Rules:
- Only well-documented, widely-known facts. If you are not confident the input is a real medication, set "recognized" to false and leave the fields empty.
- "uses": what the medication is commonly used for / what it treats, a short plain phrase (e.g. "type 2 diabetes and blood sugar", "high blood pressure", "high cholesterol", "blood thinner to prevent clots"). This helps a non-clinician quickly understand the drug.
- "sideEffects": the 3 most common or most notable side effects. Each 1 to 4 words.
- "risks": up to 3 serious risks, warnings, or important interactions. Each a short phrase.
- Plain language. NO dosing, NO advice, NO recommendations, NO comparisons to supplements. This is reference only; the person's doctor is the authority.
- Never use em dashes or en dashes; use a simple hyphen.

Return ONLY JSON, no markdown:
{"recognized":true|false,"generic":"<generic name or ''>","class":"<short drug class or ''>","uses":"<what it treats, short>","sideEffects":["...","...","..."],"risks":["...","..."]}`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const name = clip(body.name, 80).trim();
  if (name.length < 2) { res.status(400).json({ error: "No medication name given." }); return; }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: `MEDICATION: ${name}` }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    res.status(200).json({
      name,
      recognized: parsed.recognized !== false,
      generic: clip(parsed.generic, 80),
      class: clip(parsed.class, 80),
      uses: clip(parsed.uses, 120),
      sideEffects: Array.isArray(parsed.sideEffects) ? parsed.sideEffects.slice(0, 3).map((x) => clip(x, 60)).filter(Boolean) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3).map((x) => clip(x, 90)).filter(Boolean) : [],
      usage: msg.usage,
    });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Lookup failed." });
  }
}
