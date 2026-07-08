// Cadence - product knowledge parser.
//
// Paste a doc of products/information and get back structured product cards
// (name, trigger keywords, info to read on a call), so the rep does not type
// each one in by hand.
//
// POST { access_code, text }
// Returns { products: [ { name, keywords:[], info } ], usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const PRODUCT_SYSTEM =
`Extract distinct PRODUCTS (or items/topics) from the user's pasted material so a sales rep can pull each up by keyword during a live call. Return ONLY JSON, no markdown:
{"products":[{"name":"<product name>","keywords":["<word/phrase a rep or prospect might say to trigger this>", ...],"info":"<the concise, factual information to read to the lead about this product>"}]}

Rules:
- One object per distinct product/item.
- "keywords": the trigger words/phrases - include the condition or need it addresses (e.g. "weight loss", "lose weight"), common names, and obvious synonyms. 3-8 short keywords each. Lowercase.
- "info": the key facts to say to a lead - what it is, what it does, who it's for, dosing/usage, price if stated. Keep it tight and readable aloud. Use ONLY facts in the text; never invent.
- Do not invent products or details that are not in the material.
Output JSON only.`;

const OBJECTION_SYSTEM =
`Extract OBJECTION / Q&A pairs from the user's pasted material so a sales rep can pull up the right response the instant a prospect says something on a live call. The material is a list of objections or questions, each followed by the response the rep should give. Return ONLY JSON, no markdown:
{"products":[{"name":"<the objection or question, short>","keywords":["<a phrase the prospect might actually SAY that signals this>", ...],"info":"<the exact response the rep should read>"}]}

Rules:
- One object per distinct objection/question. A single entry may list several phrasings (often separated by "/" or "or") - keep them as ONE object and use each phrasing as a keyword.
- "name": a short label for the objection/question (e.g. "Send me an email / more info", "Too expensive", "Talk to my partner").
- "keywords": the words/phrases a real prospect would SAY that should trigger this response - pull them from the question itself plus obvious variations (e.g. "send me an email", "more information", "send info", "email me"). 3-8 short natural spoken phrases, lowercase. This is how the rep finds the answer mid-call.
- "info": the response text to read back, taken from the material. Keep the wording; do not invent or add claims.
- Treat blank lines, quotes, dashes or numbering as separators between the question and its answer. Never merge two separate objections into one.
Output JSON only.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const text = clip(body.text, 24000);
  if (text.trim().length < 20) { res.status(400).json({ error: "Paste the info first." }); return; }
  // objection + qa parse as question/answer pairs; product + knowledge parse as topics.
  const qaStyle = body.kind === "objection" || body.kind === "qa";
  const system = qaStyle ? OBJECTION_SYSTEM : PRODUCT_SYSTEM;
  const label = body.kind === "objection" ? "OBJECTIONS + RESPONSES"
    : body.kind === "qa" ? "QUESTIONS + ANSWERS (things prospects ask and how to answer)"
    : body.kind === "knowledge" ? "KNOWLEDGE / INFORMATION (topics and facts to have on hand)"
    : "PRODUCT MATERIAL";

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: `${label}:\n${text}` }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    const products = Array.isArray(parsed.products) ? parsed.products.slice(0, 60).map((p) => ({
      name: clip(p.name, 160),
      keywords: Array.isArray(p.keywords) ? p.keywords.slice(0, 12).map((k) => clip(k, 80).toLowerCase()).filter(Boolean) : [],
      info: clip(p.info, 4000),
    })).filter((p) => p.name || p.info) : [];
    res.status(200).json({ products, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Parsing failed - try again." });
  }
}
