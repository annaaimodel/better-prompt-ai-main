// Cadence - content studio.
//
// Turns the user's sales METHODOLOGY (and optionally their offer) into short-form
// social content - hooks, scripts, captions, CTAs, or a batch of ideas - to grow
// their personal brand and authority.
//
// POST { access_code, mode, platform, topic, includeOffer, playbook }
//   mode: "script" | "ideas"
// Returns { text, usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const BASE =
`You create SHORT-FORM social content for a high-ticket sales professional growing their PERSONAL brand. Build every piece on their loaded sales METHODOLOGY (and offer, if provided): teach, reframe, or provoke using the method's real ideas, in the creator's own voice. Goal: stop the scroll, land ONE sharp idea, and grow an audience while building the creator's authority. Sell the philosophy and their credibility, never hype or fake numbers.

Hard rules:
- A strong hook in the FIRST line (pattern-interrupt, bold claim, or sharp question). One idea per piece. Native to the platform. End with a clear, low-pressure call-to-action.
- Never invent client results, names, statistics, or testimonials. Only use proof actually provided.
- Never use em dashes or en dashes; use a simple hyphen.
- Default to UK English unless the tone says otherwise. Output only the content, no meta-commentary.`;

const SCRIPT_FMT =
`Write ONE piece for the given platform and topic. Output these labelled sections:
HOOKS: 3 distinct first-line hook options.
SCRIPT: a natural spoken script (~30-60s, written to be read to camera) OR, for text platforms, the post/thread itself.
ON-SCREEN TEXT: 3-5 short caption overlays (skip for text platforms).
CAPTION: the post caption.
HASHTAGS: 5-8 relevant tags.
CTA: one clear call-to-action.`;

const IDEAS_FMT =
`Output a numbered list of 10 short-form content ideas. Each is a scroll-stopping hook plus one short line on the angle, drawn from the methodology (and offer if provided). Make them varied: myths to bust, reframes, contrarian takes, behind-the-method, mistakes, and quick wins.`;

const CALENDAR_FMT =
`Plan a content calendar. Return ONLY JSON, no markdown: {"plan":[{"day":"Day 1","platform":"<one of the creator's platforms>","pillar":"<one of their pillars>","hook":"<scroll-stopping first line>"}]}. One item per requested day, spread varied across their pillars and platforms, every hook grounded in the methodology.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

function buildContext(body) {
  const p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, t = p.tone || {}, cr = body.creator || {};
  const out = [];
  if (cr.niche || cr.audience || cr.pillars) {
    out.push("CREATOR PROFILE: known for " + (clip(cr.niche, 200) || "(unset)") +
      (cr.audience ? "; growing an audience of " + clip(cr.audience, 200) : "") +
      (cr.pillars ? "; content pillars: " + clip(cr.pillars, 300) : "") +
      (cr.platforms ? "; platforms: " + clip(cr.platforms, 150) : "") +
      (cr.goal ? "; goal: " + clip(cr.goal, 200) : "") + ".");
  }
  // Methodology is ALWAYS the backbone of the content.
  if (m.principles) out.push("METHODOLOGY (the source material - every piece must teach or reframe from this): " + clip(m.principles, 2200));
  else out.push("METHODOLOGY: (none loaded - lean on general high-ticket sales-psychology principles, but stay specific and useful).");
  if (m.never) out.push("METHOD DON'TS: " + clip(m.never, 400));
  // Offer is only included when the user opts in.
  if (body.includeOffer && (o.name || o.summary)) out.push("OFFER (weave in where natural): " + clip(o.name, 120) + ". " + clip(o.summary, 500));
  if (body.includeOffer && o.whoFor) out.push("AUDIENCE / IDEAL VIEWER: " + clip(o.whoFor, 300));
  const voice = [t.formality, t.energy, t.sentenceLength, t.slang, t.signature].filter(Boolean).join("; ");
  if (voice) out.push("CREATOR VOICE (match this): " + clip(voice, 500));
  if (Array.isArray(t.avoid) ? false : t.avoid) out.push("NEVER SAY: " + clip(t.avoid, 300));
  const samples = Array.isArray(t.samples) ? t.samples.filter(Boolean).slice(0, 4) : [];
  if (samples.length) out.push("VOICE SAMPLES (mirror this style):\n" + samples.map((s) => "- " + clip(s, 500)).join("\n"));
  return out.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const mode = ["ideas", "calendar"].includes(body.mode) ? body.mode : "script";
  const platform = clip(body.platform, 60) || "Reel / TikTok / Short";
  const topic = clip(body.topic, 600);
  const fmt = mode === "ideas" ? IDEAS_FMT : mode === "calendar" ? CALENDAR_FMT : SCRIPT_FMT;
  const system = `${BASE}\n\n${fmt}`;

  let userText;
  if (mode === "calendar") {
    const days = Math.min(Math.max(parseInt(body.days, 10) || 7, 1), 30);
    userText = `${buildContext(body)}\n\nPlan ${days} pieces of content, one per day. Use the creator's own platforms and pillars.`;
  } else {
    userText = `${buildContext(body)}\n\nPLATFORM: ${platform}\n` +
      (mode === "script" ? `TOPIC / ANGLE: ${topic || "(you choose a strong one from the methodology)"}\n\nWrite the piece.` : `\nGive me 10 ideas.`);
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: mode === "calendar" ? 1800 : 1500,
      system,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "";
    if (mode === "calendar") {
      const mt = raw.match(/\{[\s\S]*\}/);
      let plan = [];
      try { plan = (JSON.parse(mt ? mt[0] : raw).plan || []); } catch (e) { plan = []; }
      plan = plan.slice(0, 30).map((x) => ({ day: clip(x.day, 30), platform: clip(x.platform, 60), pillar: clip(x.pillar, 80), hook: clip(x.hook, 300) })).filter((x) => x.hook);
      res.status(200).json({ plan, usage: msg.usage });
      return;
    }
    res.status(200).json({ text: raw, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Content generation failed - try again." });
  }
}
