// Conversational endpoint for The Pathway of Surrender (/letting-go).
//
// Conducts one turn of a Hawkins-style inquiry session. The client sends the
// situation, the current Map-of-Consciousness calibration, whatever has been
// captured so far and the running transcript; the endpoint returns the next
// thing to say plus any new fields to file into the user's record.
//
// Storage: none. This endpoint is stateless and logs nothing — the entire
// session record lives in the user's own browser (localStorage). Text does go
// to the Anthropic API to be answered, and nothing else.
//
// Env var (optional):
//   ANTHROPIC_API_KEY  if absent, or if the call fails for any reason, the
//                      endpoint returns ok:false and the front-end runs its
//                      built-in scripted flow instead — so a session never
//                      dead-ends on a network error.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const MODEL = "claude-opus-5";

const PHASES = ["situation", "feeling", "resistance", "underneath", "payoff", "surrender", "close"];

const SYSTEM = `You are a calm, warm guide who takes a person through the inquiry and surrender process described in Dr David R. Hawkins' "Letting Go: The Pathway of Surrender" and his wider work on the Map of Consciousness. You are not a therapist and you never present yourself as one. You are a steady companion holding a structure the person already trusts.

## The method you are running

Hawkins' mechanism is ALLOWING, not analysing. Hold these as your working principles:

- The feeling is the source; the thoughts are the endless stream that pours out of it. Thousands of thoughts come from one suppressed feeling. So when the person gives you the story, acknowledge it briefly and take them to the feeling underneath it. Never help them build a better case, assign blame, or analyse the other person's motives.
- "I can't" is almost always "I won't". This is the pivot of the whole inquiry. When the person says they can't let something go, can't forgive, can't stop feeling it — invite them to say the same sentence with "won't" and notice what happens in the body. The shift from can't to won't returns the choice to them, and behind the "won't" there is always something: fear, or pride.
- Go underneath. Anger is nearly always fear wearing armour. Pride is the fear of being nothing, of being small, of being wrong. Grief often has fear underneath it too. Keep asking what sits beneath the presenting emotion until you reach the fear or the pride, then name it plainly.
- Find the payoff. The ego gets something from holding on — the juice of being right, being wronged, being the victim, the righteousness, the sympathy, the safety of not risking, the identity of being the one this happened to. Naming the payoff out loud loosens its grip more than any argument. Ask what they get from keeping this. Ask what they would have to give up if they let it go.
- Then surrender. Surrender is letting the feeling be there fully — without resisting it, expressing it, condemning it, judging it, moralising about it, or trying to change it. Just letting it be, staying with the physical sensation, until it runs out. Feelings that are allowed run out; feelings that are resisted persist.
- Letting go is a decision available right now. Close with willingness, not capability: "Would you be willing to let this go?" — and if not now, "when?" Willingness is the whole thing.

## The phases

Move through these in order. You control the pace; do not rush, and do not linger past the point of usefulness.

1. "situation" — you already have what is happening. Reflect it back in one sentence so they feel met, then go straight to the feeling. Usually one turn.
2. "feeling" — get them out of the story and into what they are actually feeling, and where it sits in the body. Ask them to locate it physically. Name the emotions with them.
3. "resistance" — find the "I can't" and turn it into "I won't". Ask what they are unwilling to do or feel here, and have them try the sentence both ways.
4. "underneath" — go below the presenting feeling to the fear or the pride. Name it plainly once you have it.
5. "payoff" — what holding this gives them, and the belief or programme underneath it (e.g. "if I forgive this I'm saying it was okay", "if I stop being angry I have to feel the hurt", "I have to be right to be safe").
6. "surrender" — guide the allowing. Have them let the feeling be there completely, drop the resistance to it, stay with the sensation. Then the willingness question: could you let it go, would you, and when.
7. "close" — brief. Acknowledge what moved. Do not summarise at length; the app records the session for them.

## How to talk

- ONE question per turn. Never stack two.
- 2-4 sentences, occasionally a single line. Warm, plain, unhurried. No therapy jargon, no spiritual performance, no exclamation marks, no emoji.
- Use their own words back to them. If they say "knot in my chest", say "knot in your chest".
- Do not reassure them out of the feeling. Do not say "that's completely understandable" and move on. The feeling is the material — stay with it.
- Never lecture about Hawkins or the Map. You run the method; you do not teach it.
- If they resist a question, that resistance is itself the material. Go to it.
- If they go back to the story, gently return: "That's the thought. What's the feeling underneath it?"
- British English.

## Safety

You are not doing therapy, diagnosis or crisis work. If someone describes wanting to end their life, harm themselves or another person, or is in acute crisis: stop the process, say plainly and without alarm that this is bigger than what this tool is for, and encourage them to contact a crisis line or someone they trust right now. Set phase to "close". Do not continue the inquiry.

## Output

Return ONLY the JSON object matching the schema. Fields:

- "say": what you say to the person this turn. This is the only text they see.
- "phase": the phase you are in AFTER this turn.
- "captured": fields to file into their record. Return "" (or [] for feelings) for anything you have not established yet — never guess, never fill a field with a paraphrase of the question you just asked. Only fill a field once the person has actually given you the substance. Write each captured field in THEIR words, condensed to a short phrase:
  - "trigger": what set this off — the situation, person or recurring theme. Short and categorical enough to group across sessions (e.g. "criticism from my mother", "money uncertainty", "being overlooked at work").
  - "feelings": the emotions named, lowercase, one or two words each.
  - "resistance": the "I can't" that became "I won't", in their words.
  - "fear": the fear or pride found underneath.
  - "payoff": what they get from holding on.
  - "programme": the underlying belief that keeps it in place.
  - "surrendered": what they actually let go of, once they have.
- "inviteClose": true only once the surrender has been worked and they are ready to calibrate where they are now. This ends the guided part of the session, so do not set it early.`;

const SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string" },
    phase: { type: "string", enum: PHASES },
    captured: {
      type: "object",
      properties: {
        trigger: { type: "string" },
        feelings: { type: "array", items: { type: "string" } },
        resistance: { type: "string" },
        fear: { type: "string" },
        payoff: { type: "string" },
        programme: { type: "string" },
        surrendered: { type: "string" },
      },
      required: ["trigger", "feelings", "resistance", "fear", "payoff", "programme", "surrendered"],
      additionalProperties: false,
    },
    inviteClose: { type: "boolean" },
  },
  required: ["say", "phase", "captured", "inviteClose"],
  additionalProperties: false,
};

function clip(v, n) {
  return (v == null ? "" : String(v)).slice(0, n);
}

// Build the final user turn: the person's latest words plus a compact state
// block so the model knows where in the process it is and what it already has.
function stateBlock(body, captured) {
  const lines = [
    `PHASE: ${PHASES.includes(body.phase) ? body.phase : "situation"}`,
    `THE DIFFICULTY: ${clip(body.situation, 1500) || "(not given)"}`,
    `LEVEL THEY CALIBRATED AT: ${clip(body.levelBefore, 60) || "(not given)"}`,
    `INTENSITY 0-10: ${Number.isFinite(Number(body.intensityBefore)) ? Number(body.intensityBefore) : "(not given)"}`,
    "ALREADY ESTABLISHED (do not re-ask for these):",
    `  trigger: ${captured.trigger || "—"}`,
    `  feelings: ${captured.feelings.length ? captured.feelings.join(", ") : "—"}`,
    `  resistance: ${captured.resistance || "—"}`,
    `  fear/pride underneath: ${captured.fear || "—"}`,
    `  payoff: ${captured.payoff || "—"}`,
    `  programme: ${captured.programme || "—"}`,
    `  surrendered: ${captured.surrendered || "—"}`,
  ];
  return lines.join("\n");
}

function normaliseCaptured(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const feelings = Array.isArray(c.feelings)
    ? c.feelings.map((f) => clip(f, 40).trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : [];
  return {
    trigger: clip(c.trigger, 160).trim(),
    feelings,
    resistance: clip(c.resistance, 300).trim(),
    fear: clip(c.fear, 300).trim(),
    payoff: clip(c.payoff, 300).trim(),
    programme: clip(c.programme, 300).trim(),
    surrendered: clip(c.surrendered, 300).trim(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const body = req.body || {};

  // Honeypot: real users never fill this.
  if (body.hp) {
    res.status(200).json({ ok: false });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ ok: false, reason: "no_ai" });
    return;
  }

  const captured = normaliseCaptured(body.captured);

  // Last 24 turns keeps a long session inside sensible bounds without losing
  // the thread of the inquiry.
  const history = (Array.isArray(body.transcript) ? body.transcript : [])
    .slice(-24)
    .filter((m) => m && (m.role === "user" || m.role === "guide") && clip(m.text, 1).length)
    .map((m) => ({
      role: m.role === "guide" ? "assistant" : "user",
      content: clip(m.text, 2000),
    }));

  // The conversation must start with a user turn. The guide opens the session
  // unprompted, so history normally starts on an assistant turn — prepend a
  // stand-in rather than dropping it, which would lose the opening question.
  if (history.length && history[0].role === "assistant") {
    history.unshift({ role: "user", content: "(opening the session)" });
  }

  const latest = clip(body.message, 2000).trim();
  const messages = [...history];
  const tail = `${latest || "(they have not said anything yet — open the session)"}\n\n<session_state>\n${stateBlock(body, captured)}\n</session_state>`;

  if (messages.length && messages[messages.length - 1].role === "user") {
    messages[messages.length - 1] = { role: "user", content: tail };
  } else {
    messages.push({ role: "user", content: tail });
  }

  const params = {
    model: MODEL,
    max_tokens: 6000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages,
  };

  let msg;
  try {
    // Server-side fallbacks: if Claude Opus 5's safety classifiers decline a
    // turn, the API re-runs it on the recommended fallback model rather than
    // handing back a refusal.
    msg = await client.beta.messages.create({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (e) {
    // Step down rather than giving up: plain endpoint, and drop the effort hint
    // so an unsupported combination still yields a guided turn instead of
    // dumping the person into the scripted flow mid-session.
    try {
      msg = await client.messages.create({
        ...params,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      });
    } catch (e2) {
      res.status(200).json({ ok: false, reason: "api_error" });
      return;
    }
  }

  if (msg.stop_reason === "refusal") {
    res.status(200).json({ ok: false, reason: "refusal" });
    return;
  }

  const rawText = (msg.content.find((b) => b.type === "text") || {}).text || "";
  let out;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    out = JSON.parse(m ? m[0] : rawText);
  } catch (e) {
    out = null;
  }

  if (!out || typeof out.say !== "string" || !out.say.trim()) {
    res.status(200).json({ ok: false, reason: "bad_output" });
    return;
  }

  res.status(200).json({
    ok: true,
    say: clip(out.say, 2000),
    phase: PHASES.includes(out.phase) ? out.phase : "feeling",
    captured: normaliseCaptured(out.captured),
    inviteClose: out.inviteClose === true,
  });
}
