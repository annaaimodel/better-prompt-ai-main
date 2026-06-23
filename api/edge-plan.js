// Public endpoint for AURUM · The Slight Edge (/edge).
//
// Takes a user's goal answers and returns a structured, Slight-Edge-grounded
// daily action plan as JSON. Public (no access code) so anyone can use the app
// on their own device — protected by a honeypot, strict length caps and tight
// output limits. Stores/logs nothing: inputs are used in memory only.
//
// Env var (optional):
//   ANTHROPIC_API_KEY  if set, plans are AI-personalised. If absent or the call
//                      fails, the endpoint returns ok:false and the front-end
//                      falls back to its built-in expert template — so the app
//                      keeps working either way.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM = `You are a goal-planning coach who designs plans on the philosophy of Jeff Olson's book "The Slight Edge": success is the product of simple, productive disciplines repeated daily that compound over time. The actions you choose must be "easy to do, and easy not to do" — small, low-friction, repeatable EVERY day, and measurable. Favour tiny daily inputs (process goals) over outcome goals. Build in measurable mini-targets that visibly compound week over week.

You will receive the user's goal details. Return ONLY a single JSON object (no prose, no markdown fences) with EXACTLY this shape:
{
  "summary": "1-2 sentence plain-English description of the plan and the compounding idea behind it",
  "principle": "one short Slight Edge principle that applies to this goal (e.g. 'Show up every day', 'Be consistent', 'Be patient — plant, cultivate, harvest')",
  "realism": "If the user's timeframe is realistic, say so briefly. If it's too aggressive or too slow, say so kindly and suggest a more realistic timeframe. <=2 sentences.",
  "dailyActions": [
    { "id": "short_slug", "label": "the daily action, phrased as a doable verb", "type": "check" | "number", "unit": "e.g. minutes, pages, £, steps (empty for check)", "target": <number or null>, "why": "one line on why this small action compounds" }
  ],
  "milestones": [
    { "label": "a measurable mini-target", "byWeek": <integer week number>, "metric": "what to measure", "targetValue": "the number/threshold to hit" }
  ],
  "weeklyReview": "one reflective question to ask at each weekly review",
  "motivation": "one punchy, specific line of encouragement tied to THIS goal"
}

Rules: 3-5 dailyActions, each genuinely doable in the user's stated daily time budget. 3-6 milestones spread across their timeframe, the last roughly at their target date. Use the user's own units and numbers. Keep every string concise. Be specific to their goal, baseline and timeframe — never generic. Output JSON only.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};

  // Honeypot: real users never fill this.
  if (body.hp) { res.status(200).json({ ok: false }); return; }

  // If the key isn't configured, tell the client to use its built-in template.
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ ok: false, reason: "no_ai" });
    return;
  }

  const goal = {
    category: clip(body.category, 60),
    title: clip(body.title, 300),
    why: clip(body.why, 600),
    baseline: clip(body.baseline, 200),
    target: clip(body.target, 200),
    unit: clip(body.unit, 40),
    timeframeWeeks: num(body.timeframeWeeks),
    dailyMinutes: num(body.dailyMinutes),
  };

  if (goal.title.trim().length < 3) { res.status(400).json({ error: "Tell me your goal first." }); return; }

  const userText =
`GOAL CATEGORY: ${goal.category || "general"}
GOAL: ${goal.title}
WHY IT MATTERS TO ME: ${goal.why || "(not given)"}
WHERE I AM NOW (baseline): ${goal.baseline || "(not given)"}
WHERE I WANT TO BE (target): ${goal.target || "(not given)"} ${goal.unit || ""}
TIMEFRAME: ${goal.timeframeWeeks ? goal.timeframeWeeks + " weeks" : "(not given)"}
TIME I CAN COMMIT DAILY: ${goal.dailyMinutes ? goal.dailyMinutes + " minutes" : "(not given)"}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let plan;
    try { plan = JSON.parse(m ? m[0] : raw); } catch (e) { plan = null; }
    if (!plan || !Array.isArray(plan.dailyActions) || !plan.dailyActions.length) {
      res.status(200).json({ ok: false, reason: "bad_output" });
      return;
    }
    res.status(200).json({ ok: true, plan, usage: msg.usage });
  } catch (e) {
    // Any API failure → client falls back to its template. Never hard-fail.
    res.status(200).json({ ok: false, reason: "api_error" });
  }
}
