// Cadence - Playbook auto-fill parser.
//
// Paste a load of unstructured material (offer doc, sales training, FAQs,
// about-you, etc.) and get back structured Playbook fields, so the user does not
// have to type each box one by one.
//
// POST { access_code, text, section }   section: "all" | "offer" | "methodology" | "tone"
// Returns { playbook: { offer{}, methodology{}, tone{} }, usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`Extract structured PLAYBOOK fields from the user's pasted material (an offer doc, sales-training notes, FAQs, about-me, anything). Return ONLY a JSON object with exactly this shape, using "" for anything not present. Never invent facts - no made-up prices, guarantees, client results, or claims.

{
  "offer": {
    "name": "", "summary": "", "whoFor": "", "transformation": "",
    "deliverables": "", "price": "", "guarantee": "", "differentiators": "",
    "objections": "", "faqs": "", "booking": "", "extra": ""
  },
  "methodology": {
    "name": "", "principles": "", "emailStructure": "", "callStructure": "",
    "messageStructure": "", "never": ""
  },
  "tone": {
    "formality": "", "sentenceLength": "", "energy": "", "emoji": "",
    "slang": "", "signature": "", "avoid": "", "samples": []
  }
}

Field guidance:
- offer.summary: what it is in 1-3 sentences. offer.whoFor: the ideal client. offer.transformation: the result/promise.
- offer.deliverables: what's included. offer.price: any pricing/payment terms stated. offer.guarantee: any guarantee/risk-reversal.
- offer.differentiators: why this vs alternatives. offer.objections: common objections + the best responses, if present.
- offer.faqs: FAQ-style Q&As. offer.booking: any 'how to book the next call' / next-step instruction. offer.extra: anything useful that fits nowhere else.
- methodology.principles: the core sales method/philosophy. emailStructure/callStructure/messageStructure: how to build each. never: hard don'ts.
- tone.formality (e.g. casual/balanced/professional), sentenceLength, energy, emoji use, slang/phrases they use, signature sign-offs, avoid (words/phrases never to use).
- tone.samples: an array of any REAL example messages/posts/snippets in the text that show the person's voice.
Output JSON only, no markdown, no prose.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }
function sclip(o, key, n) { return clip(o && o[key], n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const text = clip(body.text, 24000);
  if (text.trim().length < 20) { res.status(400).json({ error: "Paste a bit more detail first." }); return; }
  const section = ["offer", "methodology", "tone"].includes(body.section) ? body.section : "all";
  const focus = section === "all" ? "" : `\n\nFocus ONLY on the "${section}" section; leave the other sections' fields as "".`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM + focus,
      messages: [{ role: "user", content: `MATERIAL TO EXTRACT FROM:\n${text}` }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let p = {};
    try { p = JSON.parse(mt ? mt[0] : raw); } catch (e) { p = {}; }
    const o = p.offer || {}, m = p.methodology || {}, t = p.tone || {};
    const playbook = {
      offer: {
        name: sclip(o, "name", 160), summary: sclip(o, "summary", 1500), whoFor: sclip(o, "whoFor", 800),
        transformation: sclip(o, "transformation", 1000), deliverables: sclip(o, "deliverables", 2000),
        price: sclip(o, "price", 800), guarantee: sclip(o, "guarantee", 800), differentiators: sclip(o, "differentiators", 1200),
        objections: sclip(o, "objections", 2500), faqs: sclip(o, "faqs", 3000), booking: sclip(o, "booking", 800), extra: sclip(o, "extra", 3000),
      },
      methodology: {
        name: sclip(m, "name", 160), principles: sclip(m, "principles", 4000),
        emailStructure: sclip(m, "emailStructure", 1500), callStructure: sclip(m, "callStructure", 1500),
        messageStructure: sclip(m, "messageStructure", 1500), never: sclip(m, "never", 800),
      },
      tone: {
        formality: sclip(t, "formality", 80), sentenceLength: sclip(t, "sentenceLength", 200), energy: sclip(t, "energy", 120),
        emoji: sclip(t, "emoji", 80), slang: sclip(t, "slang", 800), signature: sclip(t, "signature", 400), avoid: sclip(t, "avoid", 800),
        samples: Array.isArray(t.samples) ? t.samples.slice(0, 10).map((s) => clip(s, 1200)).filter(Boolean) : [],
      },
    };
    res.status(200).json({ playbook, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Parsing failed - try again." });
  }
}
