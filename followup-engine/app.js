/* Cadence — follow-up engine. Vanilla JS, localStorage-backed. No build step. */
"use strict";

// ---------------------------------------------------------------------------
// The cadence: speed-to-lead first, then a persistent multi-channel sequence
// that rotates value angles so no two touches in a row are hollow.
// gapHours = wait after the PREVIOUS touch before this one becomes due.
// ---------------------------------------------------------------------------
const CAD = [
  { gapHours: 0,   channel: "call",  valueAngle: "insight",  intent: "Speed-to-lead call — connect within 5 minutes" },
  { gapHours: 0.2, channel: "text",  valueAngle: "insight",  intent: "Intro text — reference exactly what they opted in for" },
  { gapHours: 3,   channel: "email", valueAngle: "resource", intent: "Welcome email + a genuinely useful resource for their goal" },
  { gapHours: 22,  channel: "call",  valueAngle: "insight",  intent: "Second call attempt — short, warm, value-led" },
  { gapHours: 48,  channel: "text",  valueAngle: "proof",    intent: "Drop a quick win from someone like them" },
  { gapHours: 72,  channel: "email", valueAngle: "insight",  intent: "Tailored insight on their situation + soft invite" },
  { gapHours: 96,  channel: "call",  valueAngle: "proof",    intent: "Value call — lead with a relevant result" },
  { gapHours: 96,  channel: "text",  valueAngle: "intro",    intent: "Relevant intro or a timely opportunity" },
  { gapHours: 120, channel: "email", valueAngle: "proof",    intent: "Case study + a clear, low-pressure invitation to book" },
  { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Human check-in — no pitch at all" },
  { gapHours: 240, channel: "email", valueAngle: "resource", intent: "Move to nurture + a parting resource they'll thank you for" },
];
// After the sequence, leads go to a long-term nurture: a value drop every 14 days,
// rotating angle + channel so you stay welcome in their world.
const NURTURE_GAP_HOURS = 14 * 24;
const NURTURE_ROT = [
  { channel: "email", valueAngle: "resource", intent: "Nurture value drop — share something useful, no ask" },
  { channel: "text",  valueAngle: "insight",  intent: "Nurture check-in — a relevant insight, stay human" },
  { channel: "email", valueAngle: "proof",    intent: "Nurture proof — a recent client win, soft door-opener" },
  { channel: "text",  valueAngle: "intro",    intent: "Nurture — a relevant intro or timely opportunity" },
];

// ---------------------------------------------------------------------------
// Closing track: after a closing call with no sale, the lead moves onto an
// objection-specific sequence that dissolves THAT concern with value, not
// pressure. The first touch is due immediately (a same-day recap).
// ---------------------------------------------------------------------------
const OBJECTIONS = {
  price: { label: "Too expensive / price", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day recap — reaffirm the result they want; price maps to that outcome" },
    { gapHours: 20,  channel: "email", valueAngle: "proof",    intent: "Case study of a client who balked at price, then made it back many times over" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Reframe: the cost of NOT solving this for another 6–12 months" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Quick call — walk ROI / payment options against their real numbers" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "Send a value/ROI breakdown they can sit with" },
    { gapHours: 120, channel: "text",  valueAngle: "proof",    intent: "Warm final invite — restate the value + a clear yes/no next step" },
  ] },
  money: { label: "No money right now", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day recap with empathy — reaffirm the goal, acknowledge the investment is real" },
    { gapHours: 20,  channel: "call",  valueAngle: "insight",  intent: "Call to explore payment options / a sequencing path that fits their reality" },
    { gapHours: 48,  channel: "email", valueAngle: "proof",    intent: "Proof of a client who found a way and the return that paid for it" },
    { gapHours: 72,  channel: "text",  valueAngle: "insight",  intent: "Reframe around priority + ROI — how the result funds itself" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "A resource to help them plan the investment" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Warm final check — is timing or the path the real blocker?" },
  ] },
  think: { label: "\"Think about it\"", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day — make the decision simple: what specifically would you need to be sure of?" },
    { gapHours: 22,  channel: "email", valueAngle: "insight",  intent: "Surface the real hesitation — name the 2–3 things people weigh, invite the true one" },
    { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Short call to answer the one open question and bring clarity" },
    { gapHours: 72,  channel: "text",  valueAngle: "proof",    intent: "Proof of someone who 'thought about it', joined, and what changed" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "A simple decision framework to weigh it cleanly" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Gentle final nudge — a clear yes/no so they're not stuck in limbo" },
  ] },
  partner: { label: "Talk to partner / spouse", plays: [
    { gapHours: 0,   channel: "email", valueAngle: "resource", intent: "Same-day: a clear one-pager they can show their partner (what, why, the result)" },
    { gapHours: 22,  channel: "text",  valueAngle: "insight",  intent: "Anticipate the questions their partner will ask + crisp answers" },
    { gapHours: 48,  channel: "text",  valueAngle: "intro",    intent: "Offer a short joint call so the partner can ask directly" },
    { gapHours: 72,  channel: "email", valueAngle: "proof",    intent: "Proof of a couple/partner who got aligned and the outcome" },
    { gapHours: 96,  channel: "call",  valueAngle: "insight",  intent: "Check in on the partner conversation — clear any remaining doubt" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Warm final nudge once they've had the conversation" },
  ] },
  research: { label: "Needs more research", plays: [
    { gapHours: 0,   channel: "email", valueAngle: "proof",    intent: "Same-day: send case studies + references so their diligence is easy" },
    { gapHours: 22,  channel: "text",  valueAngle: "insight",  intent: "Ask what specifically they want to verify — answer it directly" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "A comparison / FAQ resource covering the usual due-diligence questions" },
    { gapHours: 72,  channel: "call",  valueAngle: "proof",    intent: "Call to answer open questions and offer a reference to speak to" },
    { gapHours: 96,  channel: "text",  valueAngle: "insight",  intent: "Reframe: research is good — at some point the only data left is doing it" },
    { gapHours: 120, channel: "email", valueAngle: "proof",    intent: "Final: recap the proof + a clear next step to start" },
  ] },
  timing: { label: "Timing's not right", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day recap — name the cost of delay honestly, no fake urgency" },
    { gapHours: 22,  channel: "email", valueAngle: "insight",  intent: "What actually changes if they wait 6–12 months vs start now" },
    { gapHours: 48,  channel: "text",  valueAngle: "proof",    intent: "Proof of someone who started at an imperfect time and was glad" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Call to design a start that fits their real schedule" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "A resource showing how busy clients fit it in" },
    { gapHours: 120, channel: "text",  valueAngle: "intro",    intent: "Flag a sensible window to begin + a simple next step" },
  ] },
  fear_self: { label: "Fear in themselves (self-doubt)", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day: validate the self-doubt; the goal is achievable with support" },
    { gapHours: 22,  channel: "email", valueAngle: "proof",    intent: "Proof of someone with the SAME starting doubt who succeeded" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Shrink the fear — show how small/safe the first step is, they're not alone" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Call through their specific 'what if I can't' + the support structure" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "A resource showing the hand-holding that makes success likely" },
    { gapHours: 120, channel: "text",  valueAngle: "proof",    intent: "Final belief-builder + a gentle invite to back themselves" },
  ] },
  fear_us: { label: "Fear in you / the program", plays: [
    { gapHours: 0,   channel: "email", valueAngle: "proof",    intent: "Same-day: proof + references that lower the risk of trusting you" },
    { gapHours: 22,  channel: "text",  valueAngle: "insight",  intent: "Address their specific doubt about you / the program head-on and honestly" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "Transparency: exactly how it works, the support, any guarantee / risk-reversal" },
    { gapHours: 72,  channel: "call",  valueAngle: "proof",    intent: "Call — offer a client reference they can speak to directly" },
    { gapHours: 96,  channel: "text",  valueAngle: "insight",  intent: "Reframe the risk: what you do if they get stuck or don't get results" },
    { gapHours: 120, channel: "email", valueAngle: "proof",    intent: "Final: recap proof + risk-reversal + a clear, safe next step" },
  ] },
  other: { label: "Something else / unsure", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day recap — reaffirm the goal, invite the real concern to surface" },
    { gapHours: 24,  channel: "email", valueAngle: "proof",    intent: "Relevant proof that addresses the likely concern" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Gently surface the true objection with one sharp question" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Quick call to bring clarity and a next step" },
    { gapHours: 96,  channel: "email", valueAngle: "resource", intent: "A useful resource toward their decision" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Warm final invite — a clear yes/no" },
  ] },
};

// ---------------------------------------------------------------------------
// Customer success — the client lifecycle (fixed-term, hybrid course + support).
// Runs after a deal is won and the client is onboarded. Onboarding → activation
// through the material → results & accountability → renewal/ascension at term end.
// ---------------------------------------------------------------------------
const CS_LIFECYCLE = [
  { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Onboarding kickoff — warm welcome, lay out the path, book first support call + point to Module 1" },
  { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "Activation — get them into the material + a quick-start for an early easy win" },
  { gapHours: 72,  channel: "text",  valueAngle: "insight",  intent: "First-win check — celebrate the early win or remove the blocker" },
  { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Week-1 support call — review progress, set this week's focus" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Momentum — share a relevant client win to reinforce belief" },
  { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Accountability check-in — what's working, what's stuck" },
  { gapHours: 336, channel: "call",  valueAngle: "insight",  intent: "Mid-program review — measure results vs their goal, adjust the plan" },
  { gapHours: 336, channel: "email", valueAngle: "resource", intent: "Deepen value — a resource for the next stage of their result" },
  { gapHours: 336, channel: "text",  valueAngle: "intro",    intent: "Celebrate progress + plant what's possible at the next level" },
  { gapHours: 336, channel: "call",  valueAngle: "proof",    intent: "Renewal/upgrade call — review the results, present the next tier" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Renewal offer in writing + invite a testimonial/case study + ask for a referral" },
];

// Save-plays: triggered by a churn-risk signal, not the clock. Quicker, warmer,
// friction-removing. Each addresses the SPECIFIC signal.
const RISK_SIGNALS = {
  results: { label: "Not getting results", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Reach out personally — name that progress has stalled, you've got them, propose a quick reset call" },
    { gapHours: 24,  channel: "call",  valueAngle: "insight",  intent: "Reset call — diagnose the real blocker, rebuild the plan to a fast win" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "Send a targeted shortcut/resource for their specific sticking point" },
    { gapHours: 72,  channel: "text",  valueAngle: "proof",    intent: "Proof of a client who was stuck here and broke through + encouragement" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Check the quick win landed; recommit to the goal" },
  ] },
  quiet: { label: "Gone quiet / not replying", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Warm pattern-interrupt — 'haven't heard from you, all good?', zero guilt" },
    { gapHours: 24,  channel: "call",  valueAngle: "insight",  intent: "Call them directly — reconnect, surface what changed" },
    { gapHours: 48,  channel: "email", valueAngle: "insight",  intent: "Value + open door — remind them of their goal and that you're here" },
    { gapHours: 96,  channel: "text",  valueAngle: "proof",    intent: "A quick win/result to reignite + an easy next step" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Final warm re-engage — make it effortless to say where they're at" },
  ] },
  missing: { label: "Missing sessions / calls", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "No-judgment nudge — make rescheduling easy, reaffirm the value of the call" },
    { gapHours: 24,  channel: "email", valueAngle: "resource", intent: "Send what they'd have got on the call + a rebook link" },
    { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Personal call/voicemail — find the real reason (overwhelm? priorities?)" },
    { gapHours: 96,  channel: "text",  valueAngle: "insight",  intent: "Shrink it — propose a shorter focused session to rebuild the habit" },
    { gapHours: 168, channel: "text",  valueAngle: "proof",    intent: "Reconnect with a relevant win + lock in a time" },
  ] },
  engagement: { label: "Low engagement", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Re-onboard nudge — point to ONE high-leverage next action, make starting tiny" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "A quick-win shortcut to re-spark momentum" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Accountability call — co-do the next step, set a micro-commitment" },
    { gapHours: 120, channel: "text",  valueAngle: "proof",    intent: "Celebrate any movement + proof that small steps compound" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Recommit to the goal + an easy next action" },
  ] },
};

// Win-back: reactivate a past/lapsed client. Reconnect first, offer second.
const WINBACK = [
  { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Genuine reconnect — no pitch, ask how they're doing with their goal" },
  { gapHours: 72,  channel: "email", valueAngle: "proof",    intent: "Share what's new + a recent client win relevant to them" },
  { gapHours: 72,  channel: "text",  valueAngle: "intro",    intent: "Surface a timely opportunity/offer that fits where they are now" },
  { gapHours: 120, channel: "call",  valueAngle: "insight",  intent: "Catch-up call — where are they now, where do they want to go" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Welcome-back offer + proof + an easy next step" },
];

const STAGES = ["new", "contacted", "engaged", "booked", "post-call", "client", "at-risk", "alumni", "won", "lost", "nurture"];
const ANGLE_LABEL = { insight: "Insight", proof: "Proof", resource: "Resource", intro: "Intro/Opp" };
const CHANNEL_LABEL = { text: "Text", email: "Email", call: "Call" };
const TEMP_ORDER = { hot: 0, warm: 1, cold: 2 };

// The six pipeline segments — each its own filtered page.
const SEGMENTS = [
  { key: "lead", label: "Lead", hint: "New inbound, not yet worked" },
  { key: "set", label: "Set", hint: "Being worked to book the call" },
  { key: "call", label: "Call", hint: "Call booked — setter + closer linked" },
  { key: "followup", label: "Follow-up", hint: "Owed a touch (no-show, reschedule, gone quiet)" },
  { key: "close", label: "Close", hint: "Call done, working the close" },
  { key: "csm", label: "CSM", hint: "Won — customer success" },
];
const SEGMENT_KEYS = SEGMENTS.map((s) => s.key);
const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map((s) => [s.key, s.label]));
// Derive a segment for legacy leads that predate the field.
function deriveSegment(l) {
  if (["success", "save", "winback"].includes(l.track)) return "csm";
  if (l.track === "closing") return "close";
  if (l.stage === "booked") return "call";
  if (l.stage === "post-call") return "close";
  if (["contacted", "engaged"].includes(l.stage)) return "set";
  if (["client", "at-risk", "alumni"].includes(l.stage)) return "csm";
  return "lead";
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const KEY = "cadence.v1";
const HOUR = 3600 * 1000;

function defaultPlaybook() {
  return {
    offer: { name: "", summary: "", whoFor: "", transformation: "", deliverables: "", price: "", guarantee: "", differentiators: "", objections: "", faqs: "", extra: "" },
    methodology: { name: "", principles: "", emailStructure: "", callStructure: "", messageStructure: "", never: "" },
    tone: { formality: "", sentenceLength: "", energy: "", emoji: "", slang: "", signature: "", avoid: "", extra: "", samples: [] },
  };
}

let db = load();
if (!db.playbook) db.playbook = defaultPlaybook();
if (!db.assets) db.assets = [];
if (!db.team) db.team = { setters: [], closers: [], csms: [] };
// Backfill the segment field on any leads created before segments existed.
db.leads.forEach((l) => { if (!l.segment) l.segment = deriveSegment(l); });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    version: 1,
    settings: { access: "", coachName: "", offer: "", idealClient: "", results: [], resources: [], tone: "" },
    playbook: defaultPlaybook(),
    assets: [],
    team: { setters: [], closers: [], csms: [] },
    leads: [],
  };
}

// Assets ⇄ touches mapping: which asset types satisfy which value angle.
const ASSET_TYPES = ["testimonial", "case-study", "story", "stat", "resource"];
const ANGLE_ASSET_TYPES = {
  proof: ["testimonial", "case-study", "story", "stat"],
  resource: ["resource"],
  insight: [], intro: [],
};
// Pick the freshest on-message asset for this touch that the contact hasn't seen.
// Prefers assets tagged for the lead's objection/signal/segment; falls back to any.
function pickAsset(lead, valueAngle) {
  const types = ANGLE_ASSET_TYPES[valueAngle] || [];
  if (!types.length) return null;
  const used = lead.usedAssets || [];
  let pool = (db.assets || []).filter((a) => types.includes(a.type) && !used.includes(a.id));
  if (!pool.length) return null;
  const tags = [lead.objection, lead.signal, lead.segment, lead.track].filter(Boolean).map((x) => String(x).toLowerCase());
  const matches = (a) => (a.bestFor || []).some((t) => tags.includes(String(t).toLowerCase()));
  const preferred = pool.filter(matches);
  if (preferred.length) pool = preferred;
  // Global freshness: least-used first, then longest since last use.
  pool.sort((a, b) => (a.timesUsed || 0) - (b.timesUsed || 0)
    || (new Date(a.lastUsedAt || 0)) - (new Date(b.lastUsedAt || 0)));
  return pool[0];
}
function markAssetUsed(lead, assetId) {
  if (!assetId) return;
  const a = (db.assets || []).find((x) => x.id === assetId);
  if (!a) return;
  lead.usedAssets = lead.usedAssets || [];
  if (!lead.usedAssets.includes(assetId)) lead.usedAssets.push(assetId);
  a.timesUsed = (a.timesUsed || 0) + 1;
  a.lastUsedAt = new Date().toISOString();
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now() { return Date.now(); }

// ---------------------------------------------------------------------------
// Cadence helpers
// ---------------------------------------------------------------------------
// The active sequence for a lead: its objection track if closing, else the
// setting cadence. Both fall through to long-term nurture when exhausted.
function activeCadence(lead) {
  if (lead.track === "closing" && OBJECTIONS[lead.objection]) return OBJECTIONS[lead.objection].plays;
  if (lead.track === "save" && RISK_SIGNALS[lead.signal]) return RISK_SIGNALS[lead.signal].plays;
  if (lead.track === "success") return CS_LIFECYCLE;
  if (lead.track === "winback") return WINBACK;
  return CAD;
}
function currentStep(lead) {
  const seq = activeCadence(lead);
  if (lead.cadenceStep < seq.length) return { ...seq[lead.cadenceStep], nurture: false };
  const i = (lead.cadenceStep - seq.length) % NURTURE_ROT.length;
  return { ...NURTURE_ROT[i], gapHours: NURTURE_GAP_HOURS, nurture: true };
}
function gapForStep(lead, stepIndex) {
  const seq = activeCadence(lead);
  if (stepIndex < seq.length) return seq[stepIndex].gapHours;
  return NURTURE_GAP_HOURS;
}
function advanceCadence(lead, summary) {
  const step = currentStep(lead);
  const seq = activeCadence(lead);
  lead.touches = lead.touches || [];
  lead.touches.push({
    at: new Date().toISOString(),
    channel: step.channel, direction: "out",
    valueAngle: step.valueAngle, intent: step.intent,
    assetId: lead._pendingAsset || null,
    summary: (summary || "").slice(0, 280),
  });
  // No-repeat: lock in whichever asset the just-sent draft used.
  if (lead._pendingAsset) { markAssetUsed(lead, lead._pendingAsset); delete lead._pendingAsset; }
  // Light auto-stage progression (setting track only).
  if ((!lead.track || lead.track === "setting") && lead.stage === "new") lead.stage = "contacted";
  lead.cadenceStep += 1;
  // Roll exhausted setting/closing sequences into long-term nurture.
  if (lead.cadenceStep >= seq.length && lead.stage !== "won" && lead.stage !== "lost"
      && (!lead.track || lead.track === "setting" || lead.track === "closing")) {
    lead.stage = "nurture";
  }
  lead.nextActionAt = new Date(now() + gapForStep(lead, lead.cadenceStep) * HOUR).toISOString();
  save();
}

// Move a lead onto the closing track for a given objection (post-call, no sale).
function startClosing(lead, objKey) {
  lead.track = "closing";
  lead.objection = OBJECTIONS[objKey] ? objKey : "other";
  lead.cadenceStep = 0;
  lead.stage = "post-call";
  lead.segment = "close";
  lead.status = "active";
  lead.nextActionAt = new Date(now()).toISOString();
  lead.touches = lead.touches || [];
  lead.touches.push({
    at: new Date().toISOString(), channel: "call", direction: "out",
    valueAngle: "insight", intent: "Closing call held",
    summary: `Closing call — objection: ${OBJECTIONS[lead.objection].label}`,
  });
  save();
}

// Switch a lead onto a track that runs from cadence step 0, due now, logging a
// note of the transition. Shared by all customer-success transitions.
function switchTrack(lead, track, stage, summary, signal) {
  lead.track = track;
  lead.signal = track === "save" ? (RISK_SIGNALS[signal] ? signal : "engagement") : null;
  lead.cadenceStep = 0;
  lead.stage = stage;
  lead.segment = "csm";
  lead.status = "active";
  // On first onboarding, auto-assign a CSM if one's on the roster and none set.
  if (track === "success" && !lead.assignedCSM && (db.team.csms || []).length) lead.assignedCSM = db.team.csms[0];
  lead.nextActionAt = new Date(now()).toISOString();
  lead.touches = lead.touches || [];
  lead.touches.push({ at: new Date().toISOString(), channel: "call", direction: "out", valueAngle: "insight", intent: summary, summary });
  save();
}
function startClient(lead) { switchTrack(lead, "success", "client", "Onboarded as client — success track started"); }
function startSave(lead, sig) { switchTrack(lead, "save", "at-risk", `Flagged at-risk: ${RISK_SIGNALS[sig] ? RISK_SIGNALS[sig].label : "low engagement"}`, sig); }
function backOnTrack(lead) { switchTrack(lead, "success", "client", "Back on track — resumed success cadence"); }
function startWinback(lead) { switchTrack(lead, "winback", "alumni", "Reactivation started — win-back track"); }

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function startOfTomorrow() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
function relTime(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime(), diff = t - now();
  const d = Math.round(diff / (24 * HOUR));
  if (diff < 0) {
    const od = Math.abs(d);
    if (t > now() - 24 * HOUR) return "overdue today";
    return `overdue ${od}d`;
  }
  if (d === 0) return "due today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const esc = (s) => (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function trackChip(l) {
  if (l.track === "closing" && OBJECTIONS[l.objection])
    return `<span class="chip" style="color:var(--red);border-color:#4a2a24">⚑ ${esc(OBJECTIONS[l.objection].label)}</span>`;
  if (l.track === "save" && RISK_SIGNALS[l.signal])
    return `<span class="chip" style="color:var(--red);border-color:#4a2a24">⚠ At-risk: ${esc(RISK_SIGNALS[l.signal].label)}</span>`;
  if (l.track === "success")
    return `<span class="chip" style="color:var(--green);border-color:#224a37">★ Client</span>`;
  if (l.track === "winback")
    return `<span class="chip" style="color:var(--blue);border-color:#25405a">↺ Win-back</span>`;
  return "";
}

function dueLeads() {
  const cutoff = startOfTomorrow();
  return db.leads
    .filter((l) => l.status === "active" && l.nextActionAt && new Date(l.nextActionAt).getTime() <= cutoff)
    .sort((a, b) => {
      const ta = new Date(a.nextActionAt).getTime(), tb = new Date(b.nextActionAt).getTime();
      if (ta !== tb) return ta - tb;
      return (TEMP_ORDER[a.temperature] ?? 1) - (TEMP_ORDER[b.temperature] ?? 1);
    });
}

function renderToday() {
  const list = dueLeads();
  $("todayCount").textContent = list.length;
  const el = $("todayList");
  if (!list.length) {
    el.innerHTML = `<div class="empty"><p>🎯 Nothing due. Inbox-zero on follow-ups.</p><p class="small">Add a lead, or check the Pipeline for what's coming up.</p></div>`;
    return;
  }
  el.innerHTML = list.map((l) => {
    const step = currentStep(l);
    const overdue = new Date(l.nextActionAt).getTime() < (new Date().setHours(0, 0, 0, 0));
    return `
    <div class="lead ${overdue ? "overdue" : "due"}">
      <div>
        <div class="name"><a href="#" data-open="${l.id}">${esc(l.name) || "Unnamed lead"}</a>
          <span class="chip ${l.temperature}">${esc(l.temperature || "warm")}</span></div>
        <div class="meta">${esc(l.company || "")}${l.company && l.offerInterest ? " · " : ""}${esc(l.offerInterest || "")}</div>
        <div class="action">
          <span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span>
          <span class="chip ${step.valueAngle}">${ANGLE_LABEL[step.valueAngle]}</span>
          ${trackChip(l)}
          <strong>${relTime(l.nextActionAt)}</strong> — ${esc(step.intent)}
        </div>
      </div>
      <div class="btns">
        <button class="btn primary sm" data-draft="${l.id}">Draft ✦</button>
        <button class="btn sm" data-done="${l.id}">Done ▸</button>
        <button class="btn sm ghost" data-snooze="${l.id}">Snooze</button>
      </div>
    </div>`;
  }).join("");
}

let pipelineSegment = "lead";   // which segment page is open
let pipelineAssignee = "";       // optional filter by a person (any role)
function renderPipeline(filter) {
  const q = (filter || "").trim().toLowerCase();
  const match = (l) => !q || [l.name, l.company, l.offerInterest, l.source].some((v) => (v || "").toLowerCase().includes(q));
  const assignedTo = (l, name) => name && [l.assignedSetter, l.assignedCloser, l.assignedCSM].includes(name);
  const el = $("pipelineList");
  if (!db.leads.length) {
    $("segNav").innerHTML = ""; $("assigneeFilter").innerHTML = "";
    el.innerHTML = `<div class="empty"><p>No leads yet.</p><p class="small">Head to <strong>Add lead</strong> to drop in your first inbound.</p></div>`;
    return;
  }

  // Segment sub-nav with live counts.
  $("segNav").innerHTML = SEGMENTS.map((s) => {
    const n = db.leads.filter((l) => l.segment === s.key).length;
    return `<button class="seg ${s.key === pipelineSegment ? "active" : ""}" data-seg="${s.key}" title="${s.hint}">${s.label}<span class="count"> ${n}</span></button>`;
  }).join("");

  // Assignee filter built from the whole roster.
  const roster = [...new Set([...(db.team.setters || []), ...(db.team.closers || []), ...(db.team.csms || [])])];
  $("assigneeFilter").innerHTML = `<option value="">All people</option>` +
    roster.map((n) => `<option ${n === pipelineAssignee ? "selected" : ""}>${esc(n)}</option>`).join("");

  let pool = db.leads.filter((l) => l.segment === pipelineSegment && match(l));
  if (pipelineAssignee) pool = pool.filter((l) => assignedTo(l, pipelineAssignee));
  pool.sort((a, b) => new Date(a.nextActionAt || 0) - new Date(b.nextActionAt || 0));

  const seg = SEGMENTS.find((s) => s.key === pipelineSegment);
  el.innerHTML = pool.length
    ? `<div class="section-title">${seg.label} · ${pool.length}<span class="muted" style="text-transform:none;letter-spacing:0"> — ${seg.hint}</span></div>` + pool.map(leadRow).join("")
    : `<div class="empty"><p>Nothing in ${seg.label} yet.</p><p class="small">${esc(seg.hint)}.</p></div>`;
}

function leadRow(l) {
  const step = currentStep(l);
  const closed = l.status !== "active";
  return `
  <div class="lead">
    <div>
      <div class="name"><a href="#" data-open="${l.id}">${esc(l.name) || "Unnamed lead"}</a>
        <span class="chip ${l.temperature}">${esc(l.temperature || "warm")}</span>
        ${trackChip(l)}
        ${closed ? `<span class="chip">${esc(l.status)}</span>` : ""}</div>
      <div class="meta">${esc(l.company || "")}${l.company && l.offerInterest ? " · " : ""}${esc(l.offerInterest || "")}</div>
      ${assigneeChips(l)}
      ${closed ? "" : `<div class="action small muted">Next: <span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> ${esc(step.intent)} — <strong>${fmtDate(l.nextActionAt)}</strong></div>`}
    </div>
    <div class="btns">
      <select class="stage" data-stage="${l.id}">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select>
      ${closed ? `<button class="btn sm" data-reopen="${l.id}">Reopen</button>` : `<button class="btn primary sm" data-draft="${l.id}">Draft ✦</button>`}
    </div>
  </div>`;
}
function assigneeChips(l) {
  const bits = [];
  if (l.assignedSetter) bits.push(`<span class="chip role">S: ${esc(l.assignedSetter)}</span>`);
  if (l.assignedCloser) bits.push(`<span class="chip role">C: ${esc(l.assignedCloser)}</span>`);
  if (l.assignedCSM) bits.push(`<span class="chip role">CSM: ${esc(l.assignedCSM)}</span>`);
  return bits.length ? `<div class="action small">${bits.join(" ")}</div>` : "";
}
function teamOptions(role, selected) {
  const names = (db.team[role] || []);
  return `<option value="">—</option>` + names.map((n) => `<option ${n === selected ? "selected" : ""}>${esc(n)}</option>`).join("");
}

function renderCadenceView() {
  const el = $("cadenceView");
  const rows = CAD.map((s, i) => `
    <div class="action small" style="padding:6px 0;border-bottom:1px solid var(--line)">
      <strong>${i + 1}.</strong>
      <span class="chip ${s.channel}">${CHANNEL_LABEL[s.channel]}</span>
      <span class="chip ${s.valueAngle}">${ANGLE_LABEL[s.valueAngle]}</span>
      ${esc(s.intent)}
    </div>`).join("");
  const closing = Object.values(OBJECTIONS).map((o) =>
    `<div class="action small" style="padding:4px 0"><span class="chip" style="color:var(--red);border-color:#4a2a24">⚑ ${esc(o.label)}</span> ${o.plays.length}-touch sequence</div>`).join("");
  const savePlays = Object.values(RISK_SIGNALS).map((o) =>
    `<div class="action small" style="padding:4px 0"><span class="chip" style="color:var(--red);border-color:#4a2a24">⚠ ${esc(o.label)}</span> ${o.plays.length}-touch save-play</div>`).join("");
  el.innerHTML = rows +
    `<div class="action small muted" style="padding:8px 0">…then long-term nurture: a value drop every 14 days, rotating angle &amp; channel.</div>` +
    `<div class="section-title">Closing tracks (post-call, by objection)</div>` +
    `<p class="small muted" style="margin:0 0 6px">After a closing call with no sale, tag the objection on the lead and it switches to the matching sequence:</p>` +
    closing +
    `<div class="section-title">Customer success — client lifecycle (${CS_LIFECYCLE.length} touches)</div>` +
    `<p class="small muted" style="margin:0 0 6px">Onboard a won deal as a client and Cadence runs the full journey, ending in a renewal/upgrade + referral + case-study push:</p>` +
    CS_LIFECYCLE.map((s, i) => `<div class="action small" style="padding:4px 0"><strong>${i + 1}.</strong> <span class="chip ${s.channel}">${CHANNEL_LABEL[s.channel]}</span> <span class="chip ${s.valueAngle}">${ANGLE_LABEL[s.valueAngle]}</span> ${esc(s.intent)}</div>`).join("") +
    `<div class="section-title">Save-plays (at-risk, by churn signal)</div>` +
    `<p class="small muted" style="margin:0 0 6px">Flag a churn signal on a client and they switch to the matching re-engagement play:</p>` +
    savePlays +
    `<div class="section-title">Win-back (reactivation)</div>` +
    `<div class="action small muted" style="padding:4px 0">A ${WINBACK.length}-touch reconnect-first sequence for past/lapsed clients.</div>`;
}

// ---------------------------------------------------------------------------
// Lead detail modal (built dynamically)
// ---------------------------------------------------------------------------
function openDetail(id) {
  const l = db.leads.find((x) => x.id === id);
  if (!l) return;
  const bg = document.createElement("div");
  bg.className = "modal-bg open";
  const touches = (l.touches || []).slice().reverse();
  bg.innerHTML = `
    <div class="modal">
      <button class="close-x">&times;</button>
      <h3>${esc(l.name) || "Lead"}</h3>
      <div class="small muted" style="margin-bottom:10px">${esc(l.company || "")} ${l.phone ? "· " + esc(l.phone) : ""} ${l.email ? "· " + esc(l.email) : ""}</div>
      <div class="row">
        <div class="field"><label>Stage</label><select id="d_stage">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Temperature</label><select id="d_temp">${["hot", "warm", "cold"].map((t) => `<option ${t === l.temperature ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Interested in</label><input id="d_interest" value="${esc(l.offerInterest)}" /></div>
      <div class="field"><label>Notes</label><textarea id="d_notes" rows="3">${esc(l.notes)}</textarea></div>
      <div class="section-title">Pipeline &amp; assignment</div>
      <div class="row">
        <div class="field"><label>Segment (page)</label><select id="d_segment">${SEGMENTS.map((s) => `<option value="${s.key}" ${l.segment === s.key ? "selected" : ""}>${s.label}</option>`).join("")}</select></div>
        <div class="field" style="display:flex;align-items:flex-end"><button class="btn sm" id="d_setcall" style="width:100%">Set the call ▸</button></div>
      </div>
      <div class="row">
        <div class="field"><label>Setter</label><select id="d_setter">${teamOptions("setters", l.assignedSetter)}</select></div>
        <div class="field"><label>Closer</label><select id="d_closer">${teamOptions("closers", l.assignedCloser)}</select></div>
        <div class="field"><label>CSM</label><select id="d_csm">${teamOptions("csms", l.assignedCSM)}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn primary sm" id="d_save">Save</button>
        <button class="btn sm" id="d_draft">Draft next ✦</button>
        <button class="btn sm" id="d_won">Won 🏆</button>
        <button class="btn sm" id="d_lost">Lost</button>
        <button class="btn sm danger" id="d_del">Delete</button>
      </div>
      <div class="section-title">Closing follow-up ${l.track === "closing" ? `· on track: ${esc(OBJECTIONS[l.objection] ? OBJECTIONS[l.objection].label : l.objection)}` : ""}</div>
      <p class="small muted" style="margin:0 0 8px">Had a closing call but they didn't buy? Tag the objection — the lead switches to a follow-up sequence built to dissolve that exact concern.</p>
      <div class="row">
        <div class="field"><label>Objection from the call</label>
          <select id="d_obj">${Object.entries(OBJECTIONS).map(([k, v]) => `<option value="${k}" ${l.objection === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
        <div class="field" style="display:flex;align-items:flex-end">
          <button class="btn sm" id="d_startclose" style="width:100%">${l.track === "closing" ? "Update objection track" : "Didn't close → start closing track"}</button>
        </div>
      </div>
      <div class="section-title">Customer success</div>
      <p class="small muted" style="margin:0 0 8px">Won the deal? Onboard them and Cadence runs the client journey — onboarding → results → renewal/upsell — and catches churn risk before it costs you the client.</p>
      <div class="modal-actions">
        <button class="btn sm" id="d_onboard">${l.track === "success" ? "Restart client journey 🔁" : "Onboard as client ▸"}</button>
        <button class="btn sm" id="d_winback">Reactivate (win-back) ▸</button>
      </div>
      ${["success", "save", "winback"].includes(l.track) ? `
      <div class="row" style="margin-top:10px">
        <div class="field"><label>Flag a churn-risk signal</label>
          <select id="d_sig">${Object.entries(RISK_SIGNALS).map(([k, v]) => `<option value="${k}" ${l.signal === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
        <div class="field" style="display:flex;align-items:flex-end;gap:6px">
          <button class="btn sm danger" id="d_flag" style="flex:1">Flag at-risk ⚠</button>
          ${l.track === "save" ? `<button class="btn sm" id="d_back" style="flex:1">Back on track ▸</button>` : ""}
        </div>
      </div>` : ""}
      <div class="section-title">Touch history (${(l.touches || []).length})</div>
      ${touches.length ? `<ul class="tight small">${touches.map((t) => `<li><span class="chip ${t.channel}">${CHANNEL_LABEL[t.channel] || t.channel}</span> <span class="muted">${fmtDate(t.at)}</span> — ${esc(t.summary || t.intent)}</li>`).join("")}</ul>` : `<p class="small muted">No touches logged yet.</p>`}
    </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector("#d_save").onclick = () => {
    l.stage = bg.querySelector("#d_stage").value;
    l.temperature = bg.querySelector("#d_temp").value;
    l.offerInterest = bg.querySelector("#d_interest").value.trim();
    l.notes = bg.querySelector("#d_notes").value.trim();
    l.segment = bg.querySelector("#d_segment").value;
    l.assignedSetter = bg.querySelector("#d_setter").value;
    l.assignedCloser = bg.querySelector("#d_closer").value;
    l.assignedCSM = bg.querySelector("#d_csm").value;
    save(); close(); rerender(); toast("Saved");
  };
  bg.querySelector("#d_setcall").onclick = () => {
    l.assignedSetter = bg.querySelector("#d_setter").value;
    l.assignedCloser = bg.querySelector("#d_closer").value;
    l.segment = "call"; l.stage = "booked"; l.status = "active";
    save(); close(); rerender();
    toast(l.assignedCloser ? `Call set — linked to ${l.assignedCloser}` : "Call set ▸ (assign a closer in the lead)");
  };
  bg.querySelector("#d_draft").onclick = () => { close(); openDraft(l.id); };
  bg.querySelector("#d_won").onclick = () => {
    l.assignedCloser = bg.querySelector("#d_closer").value || l.assignedCloser;
    l.assignedCSM = bg.querySelector("#d_csm").value || l.assignedCSM || (db.team.csms || [])[0] || "";
    l.status = "won"; l.stage = "won"; l.segment = "csm";
    save(); close(); rerender();
    toast(l.assignedCSM ? `Won 🏆 — handed to ${l.assignedCSM}` : "Won 🏆 — add a CSM to assign");
  };
  bg.querySelector("#d_lost").onclick = () => { l.status = "lost"; l.stage = "lost"; save(); close(); rerender(); toast("Marked lost"); };
  bg.querySelector("#d_startclose").onclick = () => { startClosing(l, bg.querySelector("#d_obj").value); close(); rerender(); setView("today"); toast("Closing track started ▸"); };
  bg.querySelector("#d_onboard").onclick = () => { startClient(l); close(); rerender(); setView("today"); toast(l.track === "success" ? "Client journey restarted 🔁" : "Onboarded — client journey started ▸"); };
  bg.querySelector("#d_winback").onclick = () => { startWinback(l); close(); rerender(); setView("today"); toast("Win-back started ▸"); };
  const flagBtn = bg.querySelector("#d_flag");
  if (flagBtn) flagBtn.onclick = () => { startSave(l, bg.querySelector("#d_sig").value); close(); rerender(); setView("today"); toast("Flagged at-risk — save-play started ⚠"); };
  const backBtn = bg.querySelector("#d_back");
  if (backBtn) backBtn.onclick = () => { backOnTrack(l); close(); rerender(); setView("today"); toast("Back on track ▸"); };
  bg.querySelector("#d_del").onclick = () => { if (confirm("Delete this lead permanently?")) { db.leads = db.leads.filter((x) => x.id !== id); save(); close(); rerender(); toast("Deleted"); } };
}

// ---------------------------------------------------------------------------
// Draft modal
// ---------------------------------------------------------------------------
let draftCtx = null;
function openDraft(id) {
  const l = db.leads.find((x) => x.id === id);
  if (!l) return;
  const step = currentStep(l);
  const asset = pickAsset(l, step.valueAngle);
  draftCtx = { leadId: id, channel: step.channel, valueAngle: step.valueAngle, intent: step.intent, variants: 1, asset };
  $("modalTitle").textContent = `Draft — ${l.name || "lead"}`;
  const assetChip = asset ? `<span class="chip proof">✶ ${esc(asset.title || asset.person || asset.type)}</span>` : "";
  $("modalMeta").innerHTML = `<span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> <span class="chip ${step.valueAngle}">${ANGLE_LABEL[step.valueAngle]}</span> ${trackChip(l)} ${assetChip} ${esc(step.intent)}`;
  $("modalOut").textContent = "…";
  $("modal").classList.add("open");
  runDraft();
}
async function runDraft() {
  if (!draftCtx) return;
  const l = db.leads.find((x) => x.id === draftCtx.leadId);
  if (!l) return;
  if (!db.settings.access) { $("modalOut").textContent = "Set your access code in Settings first."; return; }
  $("modalOut").textContent = "Drafting…";
  const history = (l.touches || []).map((t) => `${fmtDate(t.at)} ${t.channel} (${t.direction}): ${t.summary || t.intent}`);
  try {
    const r = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({
        channel: draftCtx.channel, valueAngle: draftCtx.valueAngle, intent: draftCtx.intent,
        variants: draftCtx.variants,
        mode: ["closing", "success", "save", "winback"].includes(l.track) ? l.track : "setting",
        objection: l.objection || "other",
        objectionLabel: l.track === "closing" && OBJECTIONS[l.objection] ? OBJECTIONS[l.objection].label : "",
        signal: l.signal || "engagement",
        signalLabel: l.track === "save" && RISK_SIGNALS[l.signal] ? RISK_SIGNALS[l.signal].label : "",
        contact: { name: l.name, offerInterest: l.offerInterest, stage: l.stage, temperature: l.temperature, notes: l.notes },
        history,
        profile: db.settings,
        playbook: db.playbook,
        asset: draftCtx.asset || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) { $("modalOut").textContent = "⚠ " + (j.error || "Drafting failed."); return; }
    $("modalOut").textContent = j.text || "(empty)";
    // Remember which asset this draft used so it's locked in when you advance.
    l._pendingAsset = draftCtx.asset ? draftCtx.asset.id : null; save();
  } catch (e) {
    $("modalOut").textContent = "⚠ Network error — try again.";
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function setView(name) {
  ["today", "pipeline", "add", "playbook", "assets", "settings"].forEach((v) => $("view-" + v).classList.toggle("hidden", v !== name));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "today") renderToday();
  if (name === "pipeline") renderPipeline($("search").value);
  if (name === "playbook") loadPlaybookForm();
  if (name === "assets") renderAssets();
  if (name === "settings") loadSettingsForm();
}
function rerender() {
  renderToday();
  if (!$("view-pipeline").classList.contains("hidden")) renderPipeline($("search").value);
}

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

// Tabs
$("tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) setView(b.dataset.view); });

// Delegated clicks (Today + Pipeline)
document.body.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.draft) { openDraft(t.dataset.draft); }
  else if (t.dataset.open) { e.preventDefault(); openDetail(t.dataset.open); }
  else if (t.dataset.done) { const l = db.leads.find((x) => x.id === t.dataset.done); if (l) { advanceCadence(l, "(marked sent)"); rerender(); toast("Sent & advanced ▸"); } }
  else if (t.dataset.snooze) { const l = db.leads.find((x) => x.id === t.dataset.snooze); if (l) { l.nextActionAt = new Date(now() + 24 * HOUR).toISOString(); save(); rerender(); toast("Snoozed 1 day"); } }
  else if (t.dataset.reopen) { const l = db.leads.find((x) => x.id === t.dataset.reopen); if (l) { l.status = "active"; if (l.stage === "won" || l.stage === "lost") l.stage = "engaged"; save(); rerender(); toast("Reopened"); } }
  else if (t.dataset.aedit) { openAssetEdit(t.dataset.aedit); }
  else if (t.dataset.adel) { if (confirm("Delete this asset?")) { db.assets = (db.assets || []).filter((x) => x.id !== t.dataset.adel); save(); renderAssets(); toast("Deleted"); } }
});
document.body.addEventListener("change", (e) => {
  if (e.target.dataset.stage) {
    const l = db.leads.find((x) => x.id === e.target.dataset.stage);
    if (l) { l.stage = e.target.value; if (l.stage === "won") l.status = "won"; else if (l.stage === "lost") l.status = "lost"; else l.status = "active"; save(); rerender(); }
  }
});

// Draft modal controls
$("modalClose").onclick = () => $("modal").classList.remove("open");
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.remove("open"); });
$("regenBtn").onclick = () => { if (draftCtx) { draftCtx.variants = 1; runDraft(); } };
$("twoBtn").onclick = () => { if (draftCtx) { draftCtx.variants = 2; runDraft(); } };
$("copyBtn").onclick = async () => { try { await navigator.clipboard.writeText($("modalOut").textContent); toast("Copied"); } catch (e) { toast("Copy failed"); } };
$("logFromDraftBtn").onclick = () => {
  if (!draftCtx) return;
  const l = db.leads.find((x) => x.id === draftCtx.leadId);
  if (l) { advanceCadence(l, $("modalOut").textContent.slice(0, 200)); $("modal").classList.remove("open"); rerender(); toast("Logged & advanced ▸"); }
};

// Add lead — parse
$("parseBtn").onclick = async () => {
  const text = $("pasteBox").value.trim();
  if (text.length < 8) { toast("Paste the lead first"); return; }
  if (!db.settings.access) { toast("Set access code in Settings"); setView("settings"); return; }
  $("parseBtn").disabled = true; $("parseBtn").textContent = "Parsing…";
  try {
    const r = await fetch("/api/intake", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ text }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Parse failed"); }
    else {
      const c = j.contact || {};
      $("f_name").value = c.name || ""; $("f_company").value = c.company || "";
      $("f_email").value = c.email || ""; $("f_phone").value = c.phone || "";
      $("f_offerInterest").value = c.offerInterest || ""; $("f_source").value = c.source || "";
      $("f_notes").value = c.notes || "";
      toast("Parsed — review & add");
    }
  } catch (e) { toast("Network error"); }
  $("parseBtn").disabled = false; $("parseBtn").textContent = "Parse with AI";
};

function clearLeadForm() {
  ["f_name", "f_company", "f_email", "f_phone", "f_offerInterest", "f_source", "f_dealValue", "f_notes"].forEach((id) => ($(id).value = ""));
  $("f_temperature").value = "warm"; $("pasteBox").value = "";
}
$("clearLeadBtn").onclick = clearLeadForm;

$("saveLeadBtn").onclick = () => {
  const name = $("f_name").value.trim();
  if (!name && !$("f_email").value.trim() && !$("f_phone").value.trim()) { toast("Add a name, email or phone"); return; }
  const lead = {
    id: uid(),
    name, company: $("f_company").value.trim(), email: $("f_email").value.trim(), phone: $("f_phone").value.trim(),
    offerInterest: $("f_offerInterest").value.trim(), source: $("f_source").value.trim(),
    temperature: $("f_temperature").value, dealValue: $("f_dealValue").value.trim(),
    notes: $("f_notes").value.trim(),
    stage: "new", status: "active", segment: "lead",
    assignedSetter: db.team.setters[0] || "", assignedCloser: "", assignedCSM: "",
    createdAt: new Date().toISOString(), cadenceStep: 0,
    nextActionAt: new Date().toISOString(), touches: [],
  };
  db.leads.push(lead); save(); clearLeadForm();
  toast("Added — it's in Today now"); setView("today");
};

// Settings
function loadSettingsForm() {
  const s = db.settings;
  $("s_access").value = s.access || ""; $("s_coachName").value = s.coachName || "";
  $("s_offer").value = s.offer || ""; $("s_idealClient").value = s.idealClient || "";
  $("s_results").value = (s.results || []).join("\n");
  $("s_resources").value = (s.resources || []).map((r) => (r.url ? `${r.title} — ${r.url}` : r.title)).join("\n");
  $("s_tone").value = s.tone || "";
  $("s_setters").value = (db.team.setters || []).join(", ");
  $("s_closers").value = (db.team.closers || []).join(", ");
  $("s_csms").value = (db.team.csms || []).join(", ");
  renderCadenceView();
}
const parseNames = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
$("s_saveTeam").onclick = () => {
  db.team = {
    setters: parseNames($("s_setters").value),
    closers: parseNames($("s_closers").value),
    csms: parseNames($("s_csms").value),
  };
  save(); toast("Roster saved");
};
$("saveSettingsBtn").onclick = () => {
  db.settings.access = $("s_access").value.trim();
  db.settings.coachName = $("s_coachName").value.trim();
  db.settings.offer = $("s_offer").value.trim();
  db.settings.idealClient = $("s_idealClient").value.trim();
  db.settings.tone = $("s_tone").value.trim();
  db.settings.results = $("s_results").value.split("\n").map((x) => x.trim()).filter(Boolean);
  db.settings.resources = $("s_resources").value.split("\n").map((line) => {
    const m = line.split(/\s+[—-]\s+/);
    const url = (line.match(/https?:\/\/\S+/) || [""])[0];
    const title = url ? line.replace(url, "").replace(/[—-]\s*$/, "").trim() : line.trim();
    return title || url ? { title: title || url, url } : null;
  }).filter(Boolean);
  save(); toast("Profile saved");
};
// Persist access code as you type so first AI call works without a save round-trip.
$("s_access").addEventListener("change", () => { db.settings.access = $("s_access").value.trim(); save(); });

// Playbook ------------------------------------------------------------------
function loadPlaybookForm() {
  const p = db.playbook || defaultPlaybook();
  const o = p.offer || {}, m = p.methodology || {}, t = p.tone || {};
  $("pb_name").value = o.name || ""; $("pb_price").value = o.price || "";
  $("pb_summary").value = o.summary || ""; $("pb_whoFor").value = o.whoFor || "";
  $("pb_transformation").value = o.transformation || ""; $("pb_deliverables").value = o.deliverables || "";
  $("pb_guarantee").value = o.guarantee || ""; $("pb_differentiators").value = o.differentiators || "";
  $("pb_objections").value = o.objections || ""; $("pb_faqs").value = o.faqs || ""; $("pb_extra").value = o.extra || "";
  $("pb_m_name").value = m.name || ""; $("pb_m_principles").value = m.principles || "";
  $("pb_m_email").value = m.emailStructure || ""; $("pb_m_call").value = m.callStructure || "";
  $("pb_m_message").value = m.messageStructure || ""; $("pb_m_never").value = m.never || "";
  $("pb_t_formality").value = t.formality || ""; $("pb_t_emoji").value = t.emoji || "";
  $("pb_t_sentence").value = t.sentenceLength || ""; $("pb_t_energy").value = t.energy || "";
  $("pb_t_slang").value = t.slang || ""; $("pb_t_signature").value = t.signature || "";
  $("pb_t_avoid").value = t.avoid || "";
  $("pb_t_samples").value = (t.samples || []).join("\n---\n");
  updatePlaybookStatus();
}
function updatePlaybookStatus() {
  const p = db.playbook || {};
  const filled = (obj) => Object.values(obj || {}).filter((v) => (Array.isArray(v) ? v.length : v && String(v).trim())).length;
  $("pb_status").textContent = `Offer ${filled(p.offer)}/11 · Method ${filled(p.methodology)}/6 · Voice ${filled(p.tone)}/8 fields filled`;
}
$("pb_save").onclick = () => {
  db.playbook = {
    offer: {
      name: $("pb_name").value.trim(), summary: $("pb_summary").value.trim(), whoFor: $("pb_whoFor").value.trim(),
      transformation: $("pb_transformation").value.trim(), deliverables: $("pb_deliverables").value.trim(),
      price: $("pb_price").value.trim(), guarantee: $("pb_guarantee").value.trim(),
      differentiators: $("pb_differentiators").value.trim(), objections: $("pb_objections").value.trim(),
      faqs: $("pb_faqs").value.trim(), extra: $("pb_extra").value.trim(),
    },
    methodology: {
      name: $("pb_m_name").value.trim(), principles: $("pb_m_principles").value.trim(),
      emailStructure: $("pb_m_email").value.trim(), callStructure: $("pb_m_call").value.trim(),
      messageStructure: $("pb_m_message").value.trim(), never: $("pb_m_never").value.trim(),
    },
    tone: {
      formality: $("pb_t_formality").value, sentenceLength: $("pb_t_sentence").value.trim(),
      energy: $("pb_t_energy").value.trim(), emoji: $("pb_t_emoji").value,
      slang: $("pb_t_slang").value.trim(), signature: $("pb_t_signature").value.trim(),
      avoid: $("pb_t_avoid").value.trim(),
      samples: $("pb_t_samples").value.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean),
    },
  };
  save(); updatePlaybookStatus(); toast("Playbook saved");
  $("pb_status").textContent = "Saved ✓ — every draft now builds from your offer, method & voice";
};

// Assets library ------------------------------------------------------------
const ASSET_TYPE_LABEL = { testimonial: "Testimonial", "case-study": "Case study", story: "Story", stat: "Stat", resource: "Resource" };
function renderAssets() {
  const v = $("assetsView");
  v.innerHTML = `
    <div class="card">
      <h2>Proof &amp; asset library</h2>
      <p class="small muted">Testimonials, case studies, stats and resources on tap. When a touch calls for proof or a resource, the drafter auto-pulls the freshest one that fits — never the same one twice for a person (per-contact), rotated globally so nothing goes stale.</p>
      <div class="kbar">
        <button class="btn sm" id="as_import">Import starter pack (JSON)</button>
        <input id="as_importFile" type="file" accept="application/json" class="hidden" />
        <button class="btn sm" id="as_export">Export assets</button>
        <span class="small muted">${(db.assets || []).length} assets</span>
      </div>
    </div>
    <div class="card">
      <h2>Add an asset</h2>
      <div class="row">
        <div class="field"><label>Type</label><select id="as_type">${ASSET_TYPES.map((t) => `<option value="${t}">${ASSET_TYPE_LABEL[t]}</option>`).join("")}</select></div>
        <div class="field"><label>Title (short label)</label><input id="as_title" placeholder="e.g. Hector — 4 models in 6 weeks" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Person</label><input id="as_person" /></div>
        <div class="field"><label>Location</label><input id="as_location" placeholder="e.g. US" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Their starting point</label><input id="as_start" /></div>
        <div class="field"><label>Result</label><input id="as_result" /></div>
      </div>
      <div class="field"><label>Body / quote (or what the resource is)</label><textarea id="as_body" rows="3"></textarea></div>
      <div class="row">
        <div class="field"><label>Link (for resources)</label><input id="as_link" /></div>
        <div class="field"><label>Best for (comma tags: objection / segment)</label><input id="as_bestfor" placeholder="e.g. fear_us, research, hto" /></div>
      </div>
      <button class="btn primary" id="as_add">Add asset</button>
    </div>
    <div id="as_list"></div>`;
  $("as_add").onclick = addAssetFromForm;
  $("as_import").onclick = () => $("as_importFile").click();
  $("as_importFile").onchange = (e) => { if (e.target.files[0]) importStarter(e.target.files[0]); };
  $("as_export").onclick = () => {
    const blob = new Blob([JSON.stringify({ assets: db.assets || [] }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `cadence-assets-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast("Exported");
  };
  renderAssetList();
}
function renderAssetList() {
  const el = $("as_list"); if (!el) return;
  const list = db.assets || [];
  if (!list.length) { el.innerHTML = `<div class="empty">No assets yet. Add your testimonials and case studies above, or import a starter pack.</div>`; return; }
  el.innerHTML = list.map((a) => `
    <div class="lead">
      <div>
        <div class="name">${esc(a.title || a.person || ASSET_TYPE_LABEL[a.type] || "Asset")} <span class="chip">${ASSET_TYPE_LABEL[a.type] || esc(a.type)}</span></div>
        <div class="meta">${esc(a.person || "")}${a.location ? ` · ${esc(a.location)}` : ""}${a.result ? ` · ${esc(a.result)}` : ""}</div>
        ${(a.bestFor && a.bestFor.length) ? `<div class="action small">${a.bestFor.map((t) => `<span class="chip">${esc(t)}</span>`).join(" ")}</div>` : ""}
        <div class="action tiny muted">Used ${a.timesUsed || 0}×${a.lastUsedAt ? ` · last ${fmtDate(a.lastUsedAt)}` : ""}</div>
      </div>
      <div class="btns">
        <button class="btn sm" data-aedit="${a.id}">Edit</button>
        <button class="btn sm danger" data-adel="${a.id}">Delete</button>
      </div>
    </div>`).join("");
}
function addAssetFromForm() {
  const a = {
    id: uid(), type: $("as_type").value,
    title: $("as_title").value.trim(), person: $("as_person").value.trim(), location: $("as_location").value.trim(),
    startingPoint: $("as_start").value.trim(), result: $("as_result").value.trim(),
    body: $("as_body").value.trim(), link: $("as_link").value.trim(),
    bestFor: $("as_bestfor").value.split(",").map((s) => s.trim()).filter(Boolean),
    timesUsed: 0, lastUsedAt: null,
  };
  if (!a.title && !a.body && !a.person) { toast("Add at least a title, person or body"); return; }
  db.assets.push(a); save(); renderAssets(); toast("Asset added");
}
function openAssetEdit(id) {
  const a = (db.assets || []).find((x) => x.id === id);
  if (!a) return;
  const bg = document.createElement("div"); bg.className = "modal-bg open";
  bg.innerHTML = `
    <div class="modal">
      <button class="close-x">&times;</button>
      <h3>Edit asset</h3>
      <div class="row">
        <div class="field"><label>Type</label><select id="ae_type">${ASSET_TYPES.map((t) => `<option value="${t}" ${t === a.type ? "selected" : ""}>${ASSET_TYPE_LABEL[t]}</option>`).join("")}</select></div>
        <div class="field"><label>Title</label><input id="ae_title" value="${esc(a.title)}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Person</label><input id="ae_person" value="${esc(a.person)}" /></div>
        <div class="field"><label>Location</label><input id="ae_location" value="${esc(a.location)}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Starting point</label><input id="ae_start" value="${esc(a.startingPoint)}" /></div>
        <div class="field"><label>Result</label><input id="ae_result" value="${esc(a.result)}" /></div>
      </div>
      <div class="field"><label>Body / quote</label><textarea id="ae_body" rows="4">${esc(a.body)}</textarea></div>
      <div class="row">
        <div class="field"><label>Link</label><input id="ae_link" value="${esc(a.link)}" /></div>
        <div class="field"><label>Best for (comma tags)</label><input id="ae_bestfor" value="${esc((a.bestFor || []).join(", "))}" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn primary sm" id="ae_save">Save</button>
        <button class="btn sm" id="ae_reset">Reset usage</button>
      </div>
      <p class="small muted" style="margin-top:8px">Used ${a.timesUsed || 0}×${a.lastUsedAt ? ` · last ${fmtDate(a.lastUsedAt)}` : ""}</p>
    </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector("#ae_save").onclick = () => {
    a.type = bg.querySelector("#ae_type").value; a.title = bg.querySelector("#ae_title").value.trim();
    a.person = bg.querySelector("#ae_person").value.trim(); a.location = bg.querySelector("#ae_location").value.trim();
    a.startingPoint = bg.querySelector("#ae_start").value.trim(); a.result = bg.querySelector("#ae_result").value.trim();
    a.body = bg.querySelector("#ae_body").value.trim(); a.link = bg.querySelector("#ae_link").value.trim();
    a.bestFor = bg.querySelector("#ae_bestfor").value.split(",").map((s) => s.trim()).filter(Boolean);
    save(); close(); renderAssets(); toast("Saved");
  };
  bg.querySelector("#ae_reset").onclick = () => { a.timesUsed = 0; a.lastUsedAt = null; save(); close(); renderAssets(); toast("Usage reset"); };
}
function importStarter(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let n = 0;
      if (data.playbook) db.playbook = Object.assign(defaultPlaybook(), db.playbook, data.playbook);
      if (Array.isArray(data.assets)) {
        const ids = new Set((db.assets || []).map((x) => x.id));
        data.assets.forEach((a) => { if (!a.id) a.id = uid(); if (!ids.has(a.id)) { db.assets.push(Object.assign({ timesUsed: 0, lastUsedAt: null, bestFor: [] }, a)); n++; } });
      }
      save(); renderAssets(); toast(`Imported${data.playbook ? " playbook +" : ""} ${n} assets`);
    } catch (e) { toast("Invalid file"); }
  };
  reader.readAsText(file);
}

// Export / import / wipe
function doExport() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cadence-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href); toast("Exported");
}
function doImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.leads)) throw 0;
      db = data; save(); rerender(); loadSettingsForm(); toast("Imported");
    } catch (e) { toast("Invalid backup file"); }
  };
  reader.readAsText(file);
}
$("exportBtn").onclick = doExport; $("exportBtn2").onclick = doExport;
$("importBtn").onclick = () => $("importFile").click();
$("importBtn2").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => { if (e.target.files[0]) doImport(e.target.files[0]); };
$("wipeBtn").onclick = () => { if (confirm("Erase ALL leads and settings on this device? Export first if unsure.")) { localStorage.removeItem(KEY); db = load(); rerender(); loadSettingsForm(); toast("Wiped"); } };
$("search").addEventListener("input", (e) => renderPipeline(e.target.value));
$("segNav").addEventListener("click", (e) => { const b = e.target.closest("button[data-seg]"); if (b) { pipelineSegment = b.dataset.seg; renderPipeline($("search").value); } });
$("assigneeFilter").addEventListener("change", (e) => { pipelineAssignee = e.target.value; renderPipeline($("search").value); });

// Go
renderToday();
