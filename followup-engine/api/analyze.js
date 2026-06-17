// Cadence - Mask Read. Analyse a call transcript (Fathom/Zoom/Otter/etc.) and
// pool the PROSPECT into their dominant social mask (per the Six Masks model in
// the methodology), with evidence, a sincere affirmation, and a belief read.
//
// POST { access_code, transcript, contactName }
// Returns { analysis: { mask, runnerUp, confidence, evidence[], affirmation,
//                       beliefs[], mirror[], summary }, usage }
//
// Stores/logs nothing - inputs are used in memory only.
//
// Env vars (set in Vercel): ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You analyse a sales-call transcript and profile the PROSPECT (not the rep/salesperson) using the "Six Masks" model - everyone leads with a dominant social need and acts as if they don't. Identify it from how they talk about themselves, what they seek validation for, what they complain about, and what they fear.

The six masks (need → wants to be seen as → core fear):
- significance → standing out, leaving an impact → being insignificant/unnoticed
- acceptance → belonging to a group → being excluded
- approval → recognised/reassured by specific people (may self-deprecate) → being dismissed/disapproved of
- intelligence → smart, knowledgeable → being seen as stupid
- understanding → having others see how hard they have it (often complains) → being misunderstood
- power → strong, decisive, in control → being weak/not in control

Method rules to honour:
- Affirmations must be SINCERE and specific - affirm what they want to be seen as. Never manipulative, never overdone.
- Treat the prospect's own words as truth ("gospel"); surface the phrases worth mirroring back.
- For beliefs/objections: name the limiting belief and the single best QUESTION to trace or test it (don't argue).
- Base everything ONLY on the transcript. If evidence is thin, say so and lower the confidence. Never invent quotes.
- Never use em dashes (—) or en dashes (–) in any text you write; use commas or a simple hyphen instead.

Return ONLY a JSON object (no markdown, no prose) with these keys:
{
  "mask": "<one of: significance|acceptance|approval|intelligence|understanding|power>",
  "runnerUp": "<another mask or ''>",
  "confidence": "<high|medium|low>",
  "evidence": ["<short direct quote or paraphrase from the prospect that signals the mask>", ...],
  "affirmation": "<a ready-to-use, sincere 1-2 sentence affirmation of their dominant need, in a natural human voice>",
  "beliefs": [ { "belief": "<limiting belief/objection they hold>", "question": "<one question to trace or test it>" }, ... ],
  "mirror": ["<exact phrase of theirs worth mirroring back>", ...],
  "summary": "<2-3 sentence read of this person and how to lead them>"
}`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const transcript = clip(body.transcript, 40000);
  if (transcript.trim().length < 80) { res.status(400).json({ error: "Paste a fuller transcript (at least a few exchanges)." }); return; }
  const who = clip(body.contactName, 120);

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: "user", content: `${who ? `The prospect is: ${who}\n\n` : ""}TRANSCRIPT:\n${transcript}` }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let a = {};
    try { a = JSON.parse(m ? m[0] : raw); } catch (e) { a = {}; }
    const analysis = {
      mask: clip(a.mask, 30).toLowerCase(),
      runnerUp: clip(a.runnerUp, 30).toLowerCase(),
      confidence: clip(a.confidence, 12).toLowerCase() || "medium",
      evidence: Array.isArray(a.evidence) ? a.evidence.slice(0, 8).map((x) => clip(x, 300)) : [],
      affirmation: clip(a.affirmation, 600),
      beliefs: Array.isArray(a.beliefs) ? a.beliefs.slice(0, 8).map((b) => ({ belief: clip(b.belief, 300), question: clip(b.question, 300) })) : [],
      mirror: Array.isArray(a.mirror) ? a.mirror.slice(0, 10).map((x) => clip(x, 200)) : [],
      summary: clip(a.summary, 800),
    };
    res.status(200).json({ analysis, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Analysis failed - try again." });
  }
}
