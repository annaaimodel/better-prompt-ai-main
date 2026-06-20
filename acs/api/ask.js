// AI gas tutor for the GasPass ACS revision app.
//
// Answers UK domestic gas (ACS) revision questions, grounded in the app's own
// vetted reference notes which the browser sends as `context` (built from
// data.js). Keeping the knowledge base on the client means there is a single
// source of truth and the model stays anchored to content we've reviewed.
//
// Env var (set in Vercel):
//   ANTHROPIC_API_KEY   (required)  your Anthropic API key
//
// Stores/logs nothing — inputs are used in memory only.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are "GasPass Tutor", a patient, plain-English revision tutor for UK heating engineers studying for their ACS gas assessments (CCN1 core gas safety plus CENWAT, CKR1, HTR1 and MET1).

HOW TO ANSWER
- Be concise and exam-focused. Lead with the direct answer, then a short "why".
- Use UK terminology and UK English spelling. Quote the relevant regulation or standard when you can (e.g. GSIUR 1998, BS 6891, BS 5440-1/-2, IGEM/UP/1B, BS 7671, Boiler Plus).
- Prefer the facts in the REVISION NOTES below. If the notes cover it, ground your answer in them.
- If a question is outside domestic ACS scope, or you are not confident of an exact current figure, say so plainly and tell them to check the current standard / manufacturer instructions rather than guessing.
- Keep answers short by default (a few sentences or a tight bullet list). Offer to go deeper if useful.

SAFETY
- This is a study aid, not field authority. For anything safety-critical (exact clearances, tightness-test allowable drops, gas rates, ventilation areas), remind the user to verify against the CURRENT edition of the standard and the manufacturer's instructions.
- Never invent specific numbers you are unsure of. It is better to give the method and the source than a wrong figure.
- Do not help anyone carry out gas work they are not registered/competent to do; encourage proper ACS training and Gas Safe registration.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "Tutor isn't configured yet: ANTHROPIC_API_KEY is not set in Vercel." });
    return;
  }

  const body = req.body || {};
  const question = clip(body.question, 4000).trim();
  const context = clip(body.context, 60000); // vetted notes sent from the browser
  if (question.length < 2) { res.status(400).json({ error: "Type a question first." }); return; }

  // Conversation history (optional) — array of { role:"user"|"assistant", content }
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const messages = history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map(m => ({ role: m.role, content: clip(m.content, 4000) }));
  messages.push({ role: "user", content: question });

  const system = context
    ? `${SYSTEM}\n\n===== REVISION NOTES (verified study content) =====\n${context}\n===== END NOTES =====`
    : SYSTEM;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system,
      messages,
    });
    const text = (msg.content.find(b => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "The tutor couldn't answer just now — please try again." });
  }
}
