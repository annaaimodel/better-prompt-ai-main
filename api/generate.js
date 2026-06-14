// Private generator for cover letters + Loom scripts (Claude Sonnet 4.6).
// Gated by a secret ACCESS_CODE so only you can trigger paid API calls.
// Requires two Vercel env vars: ANTHROPIC_API_KEY and ACCESS_CODE.
// Stores/logs nothing — the CV and job description are used in memory only.
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

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: ACCESS_CODE is not set in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const kind = body.kind;
  const cv = (body.cv || "").toString();
  const jd = (body.jd || "").toString();
  const extra = (body.extra || "").toString();

  if (!SYSTEMS[kind]) { res.status(400).json({ error: "Unknown request type." }); return; }
  if (jd.length < 40) { res.status(400).json({ error: "Paste the job description first." }); return; }
  if (kind !== "questions" && cv.length < 40) { res.status(400).json({ error: "Paste your CV as well." }); return; }
  if (cv.length > 20000 || jd.length > 20000 || extra.length > 8000) {
    res.status(413).json({ error: "Input is too long — trim it down a little." }); return;
  }

  const userText = kind === "questions"
    ? `JOB DESCRIPTION:\n${jd}`
    : `CANDIDATE CV:\n${cv}\n\nJOB DESCRIPTION:\n${jd}` + (extra ? `\n\nEXTRA CONTEXT / ANSWERS:\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
      system: SYSTEMS[kind],
      messages: [{ role: "user", content: userText }],
    });
    const text = (msg.content.find((b) => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    const status = e?.status || 500;
    res.status(status).json({ error: e?.message || "Generation failed — please try again." });
  }
}
