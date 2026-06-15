// Private endpoint for the cover-letter / Loom tools (/apply) and the Quick Add
// page (/add). Gated by a secret ACCESS_CODE so only the owner can use it.
//
// Env vars (set in Vercel):
//   ACCESS_CODE       (required)  the password that unlocks /apply and /add
//   ANTHROPIC_API_KEY (required for AI kinds)  your Anthropic API key
//   INBOX_SYNC_URL    (required for save_job)  your Google Sheet Apps Script /exec URL
//
// Stores/logs nothing — inputs are used in memory only.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEMS = {
  cover_letter:
`You are an expert career writer for remote high-ticket sales roles (closers, appointment setters, SDRs, customer success, VAs). Write a tailored cover letter for the candidate, in UK English, 250–350 words, confident but not boastful, with no clichés or filler ("I am writing to apply…", "team player", "fast-paced environment"). Address it to the hiring company. Use ONLY facts present in the candidate's CV and any extra context — never invent employers, numbers, or qualifications. Make the relevance to THIS specific role unmistakable. Output only the letter.`,
  loom_script:
`You write spoken scripts for 60–90 second Loom video job applications in remote high-ticket sales. Write in the first person, UK English, in a natural spoken tone the candidate can read straight to camera. Structure: hook → who you are in one line → 1–2 of the most relevant proofs from the CV → why this company/role specifically → directly address anything the job description explicitly asks a Loom/video to cover → a confident close/CTA. Use ONLY facts from the CV and extra context. Keep the spoken script under ~200 words. After the script, add a short "Talking points" list (3–5 bullets) and rough timing markers (e.g. 0:00–0:10 hook).`,
  questions:
`A candidate is preparing a tailored job application. Read the job description and produce 4–6 short, specific questions whose answers would most strengthen a cover letter and Loom script for THIS role. Surface any explicit asks the job description makes (e.g. "record a Loom about X", required tools, languages, specific metrics or results). Output a simple numbered list and nothing else.`,
};

const PARSE_SYSTEM =
`Extract a single job posting from the user's pasted text, which may be a messy Discord/WhatsApp/email/forum message. Return ONLY a JSON object with these string keys: "title", "company", "comp", "location", "link". Rules: "comp" = pay/commission/OTE/salary if mentioned, else "". "location" = a place if stated, otherwise "Remote". "link" = the first URL in the text, else "". Use "" for anything genuinely absent. Do not invent details. Output JSON only — no prose, no markdown fences.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: ACCESS_CODE is not set in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }

  const kind = body.kind;

  // --- Save a job to the inbox (no AI) -------------------------------------
  if (kind === "save_job") {
    if (!process.env.INBOX_SYNC_URL) {
      res.status(503).json({ error: "Saving isn't set up yet: add INBOX_SYNC_URL (your Google Sheet Apps Script URL) in Vercel." });
      return;
    }
    const j = body.job || {};
    const row = {
      title: clip(j.title, 300), company: clip(j.company, 200), comp: clip(j.comp, 120),
      location: clip(j.location, 200) || "Remote", link: clip(j.link, 600),
      source: clip(j.source, 80) || "Quick Add", notes: clip(j.notes, 1000),
      savedAt: new Date().toISOString(),
    };
    if (!row.title && !row.link) { res.status(400).json({ error: "Need at least a title or a link." }); return; }
    try {
      await fetch(process.env.INBOX_SYNC_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(row) });
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: "Couldn't reach the inbox sheet — check INBOX_SYNC_URL." });
    }
    return;
  }

  // --- Everything below needs the Anthropic key ----------------------------
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  // --- Parse a pasted message into job fields ------------------------------
  if (kind === "parse_job") {
    const text = clip(body.text, 12000);
    if (text.trim().length < 15) { res.status(400).json({ error: "Paste a job message first." }); return; }
    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 500, system: PARSE_SYSTEM,
        messages: [{ role: "user", content: text }],
      });
      const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
      const m = raw.match(/\{[\s\S]*\}/);
      let job = {};
      try { job = JSON.parse(m ? m[0] : raw); } catch (e) { job = {}; }
      res.status(200).json({
        job: {
          title: clip(job.title, 300), company: clip(job.company, 200), comp: clip(job.comp, 120),
          location: clip(job.location, 200) || "Remote", link: clip(job.link, 600),
        },
        usage: msg.usage,
      });
    } catch (e) {
      res.status(e?.status || 500).json({ error: e?.message || "Couldn't read that — try again." });
    }
    return;
  }

  // --- Generate cover letter / Loom script / questions ---------------------
  if (!SYSTEMS[kind]) { res.status(400).json({ error: "Unknown request type." }); return; }
  const cv = clip(body.cv, 20000), jd = clip(body.jd, 20000), extra = clip(body.extra, 8000);
  if (jd.length < 40) { res.status(400).json({ error: "Paste the job description first." }); return; }
  if (kind !== "questions" && cv.length < 40) { res.status(400).json({ error: "Paste your CV as well." }); return; }

  const userText = kind === "questions"
    ? `JOB DESCRIPTION:\n${jd}`
    : `CANDIDATE CV:\n${cv}\n\nJOB DESCRIPTION:\n${jd}` + (extra ? `\n\nEXTRA CONTEXT / ANSWERS:\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1600, system: SYSTEMS[kind],
      messages: [{ role: "user", content: userText }],
    });
    const text = (msg.content.find((b) => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Generation failed — please try again." });
  }
}
