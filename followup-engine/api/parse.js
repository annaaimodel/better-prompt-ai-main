// Aurum OS - unified paste-to-structured parser.
//
// One serverless function for all three "paste a doc, get structured data"
// flows, dispatched by body.target (keeps us under the Vercel function limit):
//   target "products"  -> { products:[{name,keywords[],info}] }   (Knowledge cards)
//   target "playbook"  -> { playbook:{offer,methodology,tone} }   (Playbook auto-fill)
//   target "intake"    -> { contact:{...} }                        (Add-lead parser)
//
// POST { access_code, target, text, kind?, section? }
//
// Stores/logs nothing. Env: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
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

const PLAYBOOK_SYSTEM =
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

const INTAKE_SYSTEM =
`Extract a single sales lead from the user's pasted text, which may be a messy ad lead-form notification, funnel/booking email, DM, or note. Return ONLY a JSON object with these string keys:
"name", "email", "phone", "company", "offerInterest", "source", "notes".
Rules:
- "name": the prospect's name if present, else "".
- "email": first valid email address, else "".
- "phone": first phone number, digits/spaces/+ preserved, else "".
- "company": their business/company if stated, else "".
- "offerInterest": one short phrase for what they want help with or opted in for (e.g. "scaling agency to 50k/mo"), else "".
- "source": where the lead came from if identifiable (e.g. "Facebook lead form", "Calendly booking", "webinar"), else "".
- "notes": anything else useful the prospect said about their situation, goals, pain or timeline - a short paragraph, else "".
Do not invent details that are not in the text. Output JSON only - no prose, no markdown fences.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }
function sclip(o, key, n) { return clip(o && o[key], n); }
function extractJSON(msg) {
  const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
  const mt = raw.match(/\{[\s\S]*\}/);
  try { return JSON.parse(mt ? mt[0] : raw); } catch (e) { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const target = ["playbook", "intake", "products"].includes(body.target) ? body.target : "products";

  try {
    // -------- Playbook auto-fill --------
    if (target === "playbook") {
      const text = clip(body.text, 24000);
      if (text.trim().length < 20) { res.status(400).json({ error: "Paste a bit more detail first." }); return; }
      const section = ["offer", "methodology", "tone"].includes(body.section) ? body.section : "all";
      const focus = section === "all" ? "" : `\n\nFocus ONLY on the "${section}" section; leave the other sections' fields as "".`;
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 2000, system: PLAYBOOK_SYSTEM + focus,
        messages: [{ role: "user", content: `MATERIAL TO EXTRACT FROM:\n${text}` }],
      });
      const p = extractJSON(msg), o = p.offer || {}, m = p.methodology || {}, t = p.tone || {};
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
      return;
    }

    // -------- Lead intake --------
    if (target === "intake") {
      const text = clip(body.text, 12000);
      if (text.trim().length < 8) { res.status(400).json({ error: "Paste the lead details first." }); return; }
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 500, system: INTAKE_SYSTEM,
        messages: [{ role: "user", content: text }],
      });
      const c = extractJSON(msg);
      res.status(200).json({
        contact: {
          name: clip(c.name, 120), email: clip(c.email, 254), phone: clip(c.phone, 40),
          company: clip(c.company, 160), offerInterest: clip(c.offerInterest, 300),
          source: clip(c.source, 120), notes: clip(c.notes, 2000),
        },
        usage: msg.usage,
      });
      return;
    }

    // -------- Knowledge cards (default) --------
    const text = clip(body.text, 24000);
    if (text.trim().length < 20) { res.status(400).json({ error: "Paste the info first." }); return; }
    const qaStyle = body.kind === "objection" || body.kind === "qa";
    const system = qaStyle ? OBJECTION_SYSTEM : PRODUCT_SYSTEM;
    const label = body.kind === "objection" ? "OBJECTIONS + RESPONSES"
      : body.kind === "qa" ? "QUESTIONS + ANSWERS (things prospects ask and how to answer)"
      : body.kind === "knowledge" ? "KNOWLEDGE / INFORMATION (topics and facts to have on hand)"
      : "PRODUCT MATERIAL";
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 3000, system,
      messages: [{ role: "user", content: `${label}:\n${text}` }],
    });
    const parsed = extractJSON(msg);
    const products = Array.isArray(parsed.products) ? parsed.products.slice(0, 60).map((pp) => ({
      name: clip(pp.name, 160),
      keywords: Array.isArray(pp.keywords) ? pp.keywords.slice(0, 12).map((k) => clip(k, 80).toLowerCase()).filter(Boolean) : [],
      info: clip(pp.info, 4000),
    })).filter((pp) => pp.name || pp.info) : [];
    res.status(200).json({ products, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Parsing failed - try again." });
  }
}
