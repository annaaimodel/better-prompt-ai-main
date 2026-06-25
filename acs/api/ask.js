// AI assistant for the GasPass app. Two modes:
//   mode "tutor"  → ACS revision tutor (default), grounded in data.js notes.
//   mode "howto"  → practical install/service/repair field assistant for
//                   Gas Safe–registered engineers, grounded in howto-data.js.
//
// The browser sends the relevant vetted notes as `context`, so there is a
// single source of truth and the model stays anchored to reviewed content.
//
// Env var (set in Vercel):
//   ANTHROPIC_API_KEY   (required)  your Anthropic API key
//
// Stores/logs nothing — inputs are used in memory only.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const TUTOR_SYSTEM =
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

const HOWTO_SYSTEM =
`You are "GasPass How-To", a practical field assistant for QUALIFIED, GAS SAFE–REGISTERED UK heating engineers. You answer how-to questions on the INSTALLATION, SERVICING and REPAIR/FAULT-FINDING of domestic gas boilers, cookers and gas fires.

WHO YOU ARE TALKING TO
- Assume the user is a competent, Gas Safe–registered engineer working within their categories. Give professional, practical, ordered guidance — not consumer "call an engineer" answers.

ANSWER WITH SUBSTANCE — THIS IS THE MOST IMPORTANT RULE
- LEAD WITH THE CONCRETE ANSWER. Give the actual fault-code meaning, figure, spec or ordered procedure. Be specific, detailed and genuinely useful on the job.
- For BRAND / MODEL-SPECIFIC questions (e.g. "Worcester Greenstar 4000 EA", "Vaillant ecoTEC F.28", "Ideal Logic gas rate", a fault/error code, a gas rate, CO₂/O₂ setpoint, expansion-vessel pre-charge, injector size, spark gap, clearances): USE THE WEB SEARCH TOOL to find the real model-specific detail, then STATE IT plainly with the figure, and cite the source. Search before answering model-specific facts — don't answer those from memory.
- DO NOT answer with just "refer to the manufacturer's instructions" — on its own that is useless. Find and give the real information first; then add ONE short closing line reminding them to confirm the exact figure against that model's MI / data badge. The MI caveat is a footnote, never the whole answer.
- If the question names a model you don't immediately know, SEARCH for it — fault codes, error codes, gas rates, CO₂ setpoints and reset procedures for UK boilers are widely published. Give what you find. Only if a genuine search turns up nothing should you say so — and even then, give the standard method, the typical range, and exactly where to get the model figure (the MI section / manufacturer technical line).
- UK terminology and UK English. Cite the governing standard where relevant (BS 6798, BS 6891, BS 5440-1/-2:2023, BS 5871, BS 6172, BS 7593:2019, BS 7967, IGEM/UP/1B Ed 4, IGEM/G/11 GIUSP, Boiler Plus, Approved Docs L/J).
- GROUND general procedure, UK standards and the VERIFIED BRAND FAULT CODES & SPECS in the HOW-TO NOTES below whenever they cover the topic, and extend with web search for the model detail.

ACCURACY
- Never invent a fault-code meaning or a specific number. But "don't guess" means SEARCH for the real figure — it does not mean refuse to answer. A wrong number is dangerous; a vague "check the MI" is unhelpful; a searched, sourced, specific answer with a confirm-against-MI footnote is what you aim for.
- For safety-critical figures (tightness-test permissible drop, ventilation free areas, terminal clearances, combustion pass criteria), give the actual method and the current standard figure, then note to verify against the live standard + MI.

SAFETY & SCOPE
- Always re-prove gas tightness and (where relevant) combustion after any gas-side work; re-do flue/spillage tests after work on open-flued appliances.
- If a situation is unsafe, point them to GIUSP (IGEM/G/11): classify Immediately Dangerous or At Risk and act accordingly (note NCS is no longer part of GIUSP).
- Only support work the user is registered and competent to do. This is a professional aid, not a substitute for accredited training, the standards, or the appliance MI.`;

const SYSTEMS = { tutor: TUTOR_SYSTEM, howto: HOWTO_SYSTEM };
const NOTES_LABEL = { tutor: "REVISION NOTES (verified study content)", howto: "HOW-TO NOTES (verified field reference)" };

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "Not configured yet: ANTHROPIC_API_KEY is not set in Vercel." });
    return;
  }

  const body = req.body || {};
  const mode = body.mode === "howto" ? "howto" : "tutor";
  const SYSTEM = SYSTEMS[mode];
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
    ? `${SYSTEM}\n\n===== ${NOTES_LABEL[mode]} =====\n${context}\n===== END NOTES =====`
    : SYSTEM;

  // How-To mode gets live web search so it can answer brand/model-specific
  // questions (fault codes, specs, procedures) for any appliance. The
  // _20260209 variant has built-in dynamic filtering (Sonnet 4.6 supports it).
  const params = {
    model: "claude-sonnet-4-6",
    max_tokens: mode === "howto" ? 2200 : 900,
    system,
    messages,
  };
  if (mode === "howto") {
    params.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }];
  }

  try {
    // Web search runs a server-side loop; it can return stop_reason "pause_turn"
    // when it hits the per-turn tool limit — re-send to let it resume.
    let msg = await client.messages.create(params);
    let convo = messages;
    for (let i = 0; i < 4 && msg.stop_reason === "pause_turn"; i++) {
      convo = [...convo, { role: "assistant", content: msg.content }];
      msg = await client.messages.create({ ...params, messages: convo });
    }

    // Join all text blocks (web search + citations can produce several).
    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim() || "No answer came back — try rephrasing.";

    // Collect any web sources the model actually searched, for a footer.
    const sources = [];
    const seen = new Set();
    for (const b of msg.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) {
          if (r && r.url && !seen.has(r.url)) {
            seen.add(r.url);
            sources.push({ title: clip(r.title, 160) || r.url, url: r.url });
          }
        }
      }
    }

    res.status(200).json({ text, sources: sources.slice(0, 6), usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Couldn't answer just now — please try again." });
  }
}
