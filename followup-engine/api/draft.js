// Cadence — value-first follow-up drafting.
//
// POST { access_code, channel, valueAngle, intent, contact, history, profile, variants }
//   channel    "text" | "email" | "call"
//   valueAngle "insight" | "proof" | "resource" | "intro"
//   intent     short label for this touch (e.g. "Speed-to-lead first contact")
//   contact    { name, offerInterest, stage, temperature, notes }
//   history    [ "2026-06-10 text (out): shared X", ... ]  recent touches, newest last
//   profile    { coachName, offer, idealClient, results[], resources[{title,url}], tone }
//   variants   1 or 2  (how many options to return)
//
// Returns { text, usage }. Stores/logs nothing — inputs are used in memory only.
//
// Env vars (set in Vercel):
//   ACCESS_CODE        (required)  unlocks the app
//   ANTHROPIC_API_KEY  (required)  your Anthropic API key
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const ANGLES = {
  insight:
    "Lead with a specific, relevant INSIGHT for THIS person's situation — a useful observation, reframe, or idea they can act on. Not generic motivation.",
  proof:
    "Lead with PROOF — a concrete client result, case study or testimonial that builds belief and lowers risk. Use ONLY results supplied in the profile; never invent a client, number, or outcome. If no relevant result is supplied, pivot to a tailored insight instead and keep it honest.",
  resource:
    "Lead by GIVING a genuinely useful resource (guide, video, tool, checklist, link) that helps them whether or not they ever buy. Prefer a resource named in the profile; if none fits, offer to send one rather than inventing a URL.",
  intro:
    "Lead with a RELEVANT INTRO or a timely OPPORTUNITY — connecting them to someone useful, or flagging something time-sensitive that benefits them. Only offer an intro that is plausible and honest; never promise a specific named person unless the profile supplies one.",
};

// Objection-specific guidance for the closing track. Principle-based and
// honest — dissolve the real concern by giving value and lowering risk, never
// by pressure, false scarcity, or manipulation.
const OBJECTION_GUIDE = {
  price:
    "Objection: it's too expensive / price. Reframe from cost to RETURN and the cost of NOT solving the problem. Anchor against what the result is worth to them, not against cheaper alternatives. If the profile mentions payment options, you may surface them. Never discount on the spot or beg. Make the value concrete to THEIR numbers.",
  think:
    "Objection: 'I need to think about it.' This usually hides a more specific concern. Your job is to gently surface what they'd really need to be sure of, bring clarity, and make the decision feel simple — not to chase. Ask one sharp, kind question that flushes out the real hesitation.",
  money:
    "Objection: no money / can't afford it right now. Lead with empathy, then reframe around priority and ROI, and (if the profile supports it) payment options or a sequencing path. Be honest and human — never shame them or pretend money is no object. Help them see how the result pays for itself.",
  partner:
    "Objection: needs to talk to a partner/spouse/business partner. EQUIP them to have that conversation well — anticipate the questions their partner will ask and arm them with clear answers. Offer to hop on a short joint call so the partner can ask directly. Treat the partner as a real stakeholder, not a brush-off.",
  research:
    "Objection: needs to do more research / due diligence. Make it easy: give proof, references/case studies, and directly answer the specific things they'd want to verify. Position yourself as the helpful source of truth, not a salesperson rushing them.",
  timing:
    "Objection: timing isn't right / too busy now. Address the cost of delay honestly and what actually changes if they wait. Show — with proof if available — how others started at an imperfect time and were glad they did. Offer a sensible start that fits their reality; don't fake urgency.",
  fear_self:
    "Objection: fear in THEMSELVES — self-doubt. 'What if I can't do it / I've tried before and failed / I'm not the type / I won't have the time or discipline.' Validate the fear first, never dismiss it. Then build their belief with proof of people who started with the same doubt and succeeded, and by making the path feel safe and achievable — emphasise the support, structure and hand-holding in the offer so they're not doing it alone. Lower the perceived difficulty; make the first step small and certain.",
  fear_us:
    "Objection: fear in YOU / the program — 'will this actually work, can I trust them to deliver for ME specifically.' Lower risk with proof, references and any guarantee/risk-reversal in the profile, and be transparent about exactly how it works, what support they get, and what happens if they get stuck. Address their specific doubt about you head-on and honestly. Specifics and credibility beat hype — never over-claim.",
  other:
    "Objection: unspecified. Lead with value, gently surface the real concern, and move toward a clear, low-pressure next step.",
};

const CHANNEL_RULES = {
  text:
    "Channel: SMS / text. Write ONE short message, warm and human, like a real person typing — max ~320 characters, no subject line, no signature block, at most one emoji and only if it fits the tone. One idea, one soft call-to-action (a question they can reply to in seconds). Output only the message text.",
  email:
    "Channel: email. Start with `Subject: ` on the first line (6–9 words, specific, no clickbait, no ALL CAPS), then a blank line, then a short scannable body (≈70–130 words). Open with the value, not 'just following up'. One clear call-to-action. Sign off with the coach's first name only. Output the subject line and body, nothing else.",
  call:
    "Channel: phone call PREP (not a word-for-word script). Output four short labelled sections: `Opener` (1–2 natural lines to start warmly and earn 20 seconds), `Value to deliver` (the specific insight/proof/resource/opportunity to give on this call), `Discovery` (2–3 sharp questions to understand their situation and surface the real problem), `If they hesitate` (1–2 lines to handle the most likely objection and a low-pressure next step). Keep it conversational, not robotic.",
};

const BASE_SYSTEM =
`You are an elite high-ticket sales follow-up assistant for a coaching/consulting business. You write follow-ups that are persistent but never pushy, and that DELIVER VALUE on every single touch — so the prospect is glad to hear from you even if they don't buy.

Hard rules:
- Be specific to THIS person and where they are in the journey. No filler, no clichés ("just checking in", "circling back", "touching base", "hope this finds you well").
- Give before you ask. Earn the reply.
- Tell the truth. Use ONLY the client results, resources and facts supplied. Never invent a case study, statistic, client name, or URL.
- Match the requested channel format and length exactly.
- Confident and warm, never desperate or salesy. One clear, low-pressure next step.
- Default to UK English unless the profile tone says otherwise. Output only the message — no notes, no preamble, no markdown fences.`;

const CLOSE_SYSTEM =
`You are an elite high-ticket CLOSING follow-up assistant for a coaching/consulting business. This prospect has ALREADY had a sales/closing call and did not buy yet — they raised a specific objection. Your job is to follow up in a way that genuinely DISSOLVES that objection by giving value and lowering risk, and gently re-opens the decision — never by pressure, false scarcity, guilt, or manipulation.

Hard rules:
- Reference that you've already spoken — this is post-call, so do NOT reintroduce yourself or act like a cold first touch.
- Lead with empathy for their actual concern; make them feel understood before you reframe anything.
- Address the SPECIFIC objection given. Deliver real value toward it (a reframe, proof, a resource, an honest answer) — never a hollow "still interested?".
- Tell the truth. Use ONLY the client results, resources, guarantees and facts supplied. Never invent a case study, number, client, guarantee, or URL.
- Confident and warm, never desperate or pushy. End with one clear, low-pressure next step (often a short call or a simple yes/no question).
- Match the requested channel format and length exactly.
- Default to UK English unless the profile tone says otherwise. Output only the message — no notes, no preamble, no markdown fences.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

function buildContext(body) {
  const c = body.contact || {};
  const p = body.profile || {};
  const lines = [];

  lines.push("YOUR BUSINESS / OFFER:");
  lines.push(`- Coach name: ${clip(p.coachName, 80) || "(not set)"}`);
  lines.push(`- Offer: ${clip(p.offer, 600) || "(not set)"}`);
  lines.push(`- Ideal client: ${clip(p.idealClient, 400) || "(not set)"}`);
  lines.push(`- Tone: ${clip(p.tone, 200) || "warm, confident, concise"}`);

  const results = Array.isArray(p.results) ? p.results.filter(Boolean).slice(0, 12) : [];
  lines.push("\nPROOF YOU MAY USE (client results / case studies — use ONLY these, do not invent):");
  lines.push(results.length ? results.map((r) => `- ${clip(r, 300)}`).join("\n") : "- (none supplied)");

  const resources = Array.isArray(p.resources) ? p.resources.filter(Boolean).slice(0, 12) : [];
  lines.push("\nRESOURCES YOU MAY SHARE (use ONLY these links; do not invent URLs):");
  lines.push(
    resources.length
      ? resources.map((r) => `- ${clip(r.title, 160)}${r.url ? ` — ${clip(r.url, 300)}` : ""}`).join("\n")
      : "- (none supplied — offer to send one rather than inventing a link)"
  );

  lines.push("\nTHE PERSON YOU'RE FOLLOWING UP:");
  lines.push(`- Name: ${clip(c.name, 80) || "(unknown)"}`);
  lines.push(`- Interested in: ${clip(c.offerInterest, 300) || "(unspecified)"}`);
  lines.push(`- Stage: ${clip(c.stage, 60) || "new"}  |  Temperature: ${clip(c.temperature, 30) || "warm"}`);
  lines.push(`- What you know about them / notes: ${clip(c.notes, 2000) || "(none)"}`);

  const history = Array.isArray(body.history) ? body.history.filter(Boolean).slice(-12) : [];
  lines.push("\nRECENT TOUCH HISTORY (oldest first — DO NOT repeat what you've already said):");
  lines.push(history.length ? history.map((h) => `- ${clip(h, 400)}`).join("\n") : "- (no prior contact — this is the first touch)");

  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};

  if (!process.env.ACCESS_CODE) {
    res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." });
    return;
  }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." });
    return;
  }

  const channel = ["text", "email", "call"].includes(body.channel) ? body.channel : "text";
  const valueAngle = ANGLES[body.valueAngle] ? body.valueAngle : "insight";
  const intent = clip(body.intent, 200) || "Value follow-up";
  const variants = body.variants === 2 ? 2 : 1;
  const mode = body.mode === "closing" ? "closing" : "setting";
  const objKey = OBJECTION_GUIDE[body.objection] ? body.objection : "other";
  const objectionLabel = clip(body.objectionLabel, 120);

  const base = mode === "closing" ? CLOSE_SYSTEM : BASE_SYSTEM;
  const objectionBlock =
    mode === "closing"
      ? `\n\nOBJECTION TO DISSOLVE${objectionLabel ? ` ("${objectionLabel}")` : ""}: ${OBJECTION_GUIDE[objKey]}`
      : "";
  const system = `${base}\n\n${CHANNEL_RULES[channel]}\n\nVALUE ANGLE FOR THIS TOUCH: ${ANGLES[valueAngle]}${objectionBlock}`;

  const instruction =
    variants === 2 && channel !== "call"
      ? `Write TWO distinct options for this follow-up, labelled "Option 1" and "Option 2", separated by a line of "---". Make them genuinely different in angle or opening.`
      : `Write the follow-up.`;

  const userText =
    `PURPOSE OF THIS TOUCH: ${intent}\n` +
    `CHANNEL: ${channel}\n\n` +
    `${buildContext(body)}\n\n` +
    `TASK: ${instruction}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userText }],
    });
    const text = (msg.content.find((b) => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Drafting failed — please try again." });
  }
}
