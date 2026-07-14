/* Cadence - follow-up engine. Vanilla JS, localStorage-backed. No build step. */
"use strict";

// ---------------------------------------------------------------------------
// The cadence: speed-to-lead first, then a persistent multi-channel sequence
// that rotates value angles so no two touches in a row are hollow.
// gapHours = wait after the PREVIOUS touch before this one becomes due.
// ---------------------------------------------------------------------------
const CAD = [
  { gapHours: 0,   channel: "call",  valueAngle: "insight",  intent: "Speed-to-lead call - connect within 5 minutes" },
  { gapHours: 0.2, channel: "text",  valueAngle: "insight",  intent: "Intro text - reference exactly what they opted in for" },
  { gapHours: 3,   channel: "email", valueAngle: "resource", intent: "Welcome email + a genuinely useful resource for their goal" },
  { gapHours: 22,  channel: "call",  valueAngle: "insight",  intent: "Second call attempt - short, warm, value-led" },
  { gapHours: 48,  channel: "text",  valueAngle: "proof",    intent: "Drop a quick win from someone like them" },
  { gapHours: 72,  channel: "email", valueAngle: "insight",  intent: "Tailored insight on their situation + soft invite" },
  { gapHours: 96,  channel: "call",  valueAngle: "proof",    intent: "Value call - lead with a relevant result" },
  { gapHours: 96,  channel: "text",  valueAngle: "intro",    intent: "Relevant intro or a timely opportunity" },
  { gapHours: 120, channel: "email", valueAngle: "proof",    intent: "Case study + a clear, low-pressure invitation to book" },
  { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Human check-in - no pitch at all" },
  { gapHours: 240, channel: "email", valueAngle: "resource", intent: "Move to nurture + a parting resource they'll thank you for" },
];
// After the sequence, leads go to a long-term nurture: a value drop every 14 days,
// rotating angle + channel so you stay welcome in their world.
const NURTURE_GAP_HOURS = 14 * 24;
const NURTURE_ROT = [
  { channel: "email", valueAngle: "resource", intent: "Nurture value drop - share something useful, no ask" },
  { channel: "text",  valueAngle: "insight",  intent: "Nurture check-in - a relevant insight, stay human" },
  { channel: "email", valueAngle: "proof",    intent: "Nurture proof - a recent client win, soft door-opener" },
  { channel: "text",  valueAngle: "intro",    intent: "Nurture - a relevant intro or timely opportunity" },
];

// ---------------------------------------------------------------------------
// Closing track: after a closing call with no sale, the lead moves onto an
// objection-specific sequence that dissolves THAT concern with value, not
// pressure. The first touch is due immediately (a same-day recap).
// ---------------------------------------------------------------------------
const OBJECTIONS = {
  price: { label: "Too expensive / can't afford", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day - acknowledge cost is real; reaffirm what they want and that they're worth it" },
    { gapHours: 22,  channel: "email", valueAngle: "proof",    intent: "A relatable story of someone who hesitated on cost and was glad they went ahead" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Gently reframe the cost of staying stuck; share any honest payment/plan options" },
    { gapHours: 96,  channel: "call",  valueAngle: "insight",  intent: "Quick friendly call to find a way that fits their budget" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Warm, no-pressure check-in" },
  ] },
  partner: { label: "Talk to spouse / family", plays: [
    { gapHours: 0,   channel: "email", valueAngle: "resource", intent: "Same-day - a simple thing they can show their partner (what it is, why, the benefit)" },
    { gapHours: 22,  channel: "text",  valueAngle: "insight",  intent: "Anticipate the questions their partner will ask + easy answers" },
    { gapHours: 48,  channel: "text",  valueAngle: "intro",    intent: "Offer a quick joint chat so the partner can ask directly" },
    { gapHours: 96,  channel: "email", valueAngle: "proof",    intent: "A relatable story of someone whose family got on board" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Warm nudge once they've had the conversation" },
  ] },
  think: { label: "\"Think about it\"", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day - make it easy: what specifically would help them feel sure?" },
    { gapHours: 22,  channel: "email", valueAngle: "insight",  intent: "Name the 2-3 things people usually weigh + invite the real one" },
    { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Short friendly call to answer the one open question" },
    { gapHours: 96,  channel: "text",  valueAngle: "proof",    intent: "Story of someone who took their time, went ahead, and what changed" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Gentle final nudge - a clear yes/no so they're not stuck" },
  ] },
  works: { label: "Not sure it'll work for me", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "proof",    intent: "Same-day - a relatable example of someone in a similar situation who got a result" },
    { gapHours: 22,  channel: "email", valueAngle: "insight",  intent: "Address their specific doubt about whether it fits them, honestly" },
    { gapHours: 48,  channel: "text",  valueAngle: "resource", intent: "Helpful info on how it works so it feels real and achievable" },
    { gapHours: 96,  channel: "call",  valueAngle: "proof",    intent: "Call to talk through their situation + a real example" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Reassure + an easy next step" },
  ] },
  safe: { label: "Is it safe? / side effects", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "resource", intent: "Same-day - honest safety reassurance; never overstate, no medical claims" },
    { gapHours: 22,  channel: "email", valueAngle: "resource", intent: "Clear facts on safety / what to expect, only from the provided info" },
    { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Call to answer safety questions honestly; suggest checking with their doctor if appropriate" },
    { gapHours: 96,  channel: "text",  valueAngle: "proof",    intent: "A real person's honest experience (no medical claims)" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Warm check-in" },
  ] },
  tried: { label: "Tried things before", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day - validate the past frustration; why this is different" },
    { gapHours: 22,  channel: "email", valueAngle: "proof",    intent: "Story of someone who'd tried other things and this worked" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Address why it didn't work before vs now" },
    { gapHours: 96,  channel: "call",  valueAngle: "insight",  intent: "Call to understand what they tried and tailor it" },
    { gapHours: 168, channel: "text",  valueAngle: "proof",    intent: "Encouragement + an easy next step" },
  ] },
  timing: { label: "Not the right time", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day - no pressure; gently note what waiting costs" },
    { gapHours: 22,  channel: "email", valueAngle: "insight",  intent: "What changes if they start now vs later" },
    { gapHours: 48,  channel: "text",  valueAngle: "proof",    intent: "Someone who started at an imperfect time and was glad" },
    { gapHours: 96,  channel: "call",  valueAngle: "insight",  intent: "Call to find a start that fits their life" },
    { gapHours: 168, channel: "text",  valueAngle: "intro",    intent: "Flag a sensible time to begin + a simple next step" },
  ] },
  research: { label: "Research / ask my doctor", plays: [
    { gapHours: 0,   channel: "email", valueAngle: "proof",    intent: "Same-day - send helpful info / reviews so checking it out is easy" },
    { gapHours: 22,  channel: "text",  valueAngle: "insight",  intent: "Ask what specifically they want to be sure of - answer it" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "A simple FAQ / info sheet covering the common questions" },
    { gapHours: 96,  channel: "call",  valueAngle: "proof",    intent: "Call to answer questions; encourage asking their doctor where relevant" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Warm follow-up once they've looked into it" },
  ] },
  other: { label: "Something else / unsure", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Same-day - reaffirm what they want, invite the real concern to surface" },
    { gapHours: 24,  channel: "email", valueAngle: "proof",    intent: "Relevant reassurance / proof for the likely concern" },
    { gapHours: 48,  channel: "text",  valueAngle: "insight",  intent: "Gently surface the real worry with one question" },
    { gapHours: 96,  channel: "call",  valueAngle: "insight",  intent: "Quick friendly call to bring clarity and a next step" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Warm final nudge - a clear yes/no" },
  ] },
};

// ---------------------------------------------------------------------------
// Customer success - the client lifecycle (fixed-term, hybrid course + support).
// Runs after a deal is won and the client is onboarded. Onboarding → activation
// through the material → results & accountability → renewal/ascension at term end.
// ---------------------------------------------------------------------------
const CS_LIFECYCLE = [
  { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Onboarding kickoff - warm welcome, lay out the path, book first support call + point to Module 1" },
  { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "Activation - get them into the material + a quick-start for an early easy win" },
  { gapHours: 72,  channel: "text",  valueAngle: "insight",  intent: "First-win check - celebrate the early win or remove the blocker" },
  { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Week-1 support call - review progress, set this week's focus" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Momentum - share a relevant client win to reinforce belief" },
  { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Accountability check-in - what's working, what's stuck" },
  { gapHours: 336, channel: "call",  valueAngle: "insight",  intent: "Mid-program review - measure results vs their goal, adjust the plan" },
  { gapHours: 336, channel: "email", valueAngle: "resource", intent: "Deepen value - a resource for the next stage of their result" },
  { gapHours: 336, channel: "text",  valueAngle: "intro",    intent: "Celebrate progress + plant what's possible at the next level" },
  { gapHours: 336, channel: "call",  valueAngle: "proof",    intent: "Renewal/upgrade call - review the results, present the next tier" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Renewal offer in writing + invite a testimonial/case study + ask for a referral" },
];

// Save-plays: triggered by a churn-risk signal, not the clock. Quicker, warmer,
// friction-removing. Each addresses the SPECIFIC signal.
const RISK_SIGNALS = {
  results: { label: "Not getting results", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Reach out personally - name that progress has stalled, you've got them, propose a quick reset call" },
    { gapHours: 24,  channel: "call",  valueAngle: "insight",  intent: "Reset call - diagnose the real blocker, rebuild the plan to a fast win" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "Send a targeted shortcut/resource for their specific sticking point" },
    { gapHours: 72,  channel: "text",  valueAngle: "proof",    intent: "Proof of a client who was stuck here and broke through + encouragement" },
    { gapHours: 120, channel: "text",  valueAngle: "insight",  intent: "Check the quick win landed; recommit to the goal" },
  ] },
  quiet: { label: "Gone quiet / not replying", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Warm pattern-interrupt - 'haven't heard from you, all good?', zero guilt" },
    { gapHours: 24,  channel: "call",  valueAngle: "insight",  intent: "Call them directly - reconnect, surface what changed" },
    { gapHours: 48,  channel: "email", valueAngle: "insight",  intent: "Value + open door - remind them of their goal and that you're here" },
    { gapHours: 96,  channel: "text",  valueAngle: "proof",    intent: "A quick win/result to reignite + an easy next step" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Final warm re-engage - make it effortless to say where they're at" },
  ] },
  missing: { label: "Missing sessions / calls", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "No-judgment nudge - make rescheduling easy, reaffirm the value of the call" },
    { gapHours: 24,  channel: "email", valueAngle: "resource", intent: "Send what they'd have got on the call + a rebook link" },
    { gapHours: 48,  channel: "call",  valueAngle: "insight",  intent: "Personal call/voicemail - find the real reason (overwhelm? priorities?)" },
    { gapHours: 96,  channel: "text",  valueAngle: "insight",  intent: "Shrink it - propose a shorter focused session to rebuild the habit" },
    { gapHours: 168, channel: "text",  valueAngle: "proof",    intent: "Reconnect with a relevant win + lock in a time" },
  ] },
  engagement: { label: "Low engagement", plays: [
    { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Re-onboard nudge - point to ONE high-leverage next action, make starting tiny" },
    { gapHours: 48,  channel: "email", valueAngle: "resource", intent: "A quick-win shortcut to re-spark momentum" },
    { gapHours: 72,  channel: "call",  valueAngle: "insight",  intent: "Accountability call - co-do the next step, set a micro-commitment" },
    { gapHours: 120, channel: "text",  valueAngle: "proof",    intent: "Celebrate any movement + proof that small steps compound" },
    { gapHours: 168, channel: "text",  valueAngle: "insight",  intent: "Recommit to the goal + an easy next action" },
  ] },
};

// Win-back: reactivate a past/lapsed client. Reconnect first, offer second.
const WINBACK = [
  { gapHours: 0,   channel: "text",  valueAngle: "insight",  intent: "Genuine reconnect - no pitch, ask how they're doing with their goal" },
  { gapHours: 72,  channel: "email", valueAngle: "proof",    intent: "Share what's new + a recent client win relevant to them" },
  { gapHours: 72,  channel: "text",  valueAngle: "intro",    intent: "Surface a timely opportunity/offer that fits where they are now" },
  { gapHours: 120, channel: "call",  valueAngle: "insight",  intent: "Catch-up call - where are they now, where do they want to go" },
  { gapHours: 168, channel: "email", valueAngle: "proof",    intent: "Welcome-back offer + proof + an easy next step" },
];

const STAGES = ["new", "contacted", "engaged", "booked", "post-call", "client", "at-risk", "alumni", "won", "lost", "nurture"];
const ANGLE_LABEL = { insight: "Insight", proof: "Proof", resource: "Resource", intro: "Intro/Opp" };
const CHANNEL_LABEL = { text: "Text", email: "Email", call: "Call" };
const TEMP_ORDER = { hot: 0, warm: 1, cold: 2 };

// The six pipeline segments - each its own filtered page.
const SEGMENTS = [
  { key: "lead", label: "Lead", hint: "New inbound, not yet worked" },
  { key: "set", label: "Set", hint: "Being worked to book the call" },
  { key: "call", label: "Call", hint: "Call booked - setter + closer linked" },
  { key: "followup", label: "Follow-up", hint: "Owed a touch (no-show, reschedule, gone quiet)" },
  { key: "close", label: "Close", hint: "Call done, working the close" },
  { key: "csm", label: "CSM", hint: "Won - customer success" },
];
const SEGMENT_KEYS = SEGMENTS.map((s) => s.key);
const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map((s) => [s.key, s.label]));
// Which page a lead belongs on for a given stage (so changing stage moves it).
const STAGE_SEGMENT = {
  new: "lead", contacted: "set", engaged: "set", booked: "call",
  "post-call": "followup", client: "csm", "at-risk": "csm", alumni: "csm", won: "csm",
};
const MASK_LABEL = { significance: "Significance", acceptance: "Acceptance", approval: "Approval", intelligence: "Intelligence", understanding: "Understanding", power: "Power" };
function maskChip(l) {
  if (!l.mask || !MASK_LABEL[l.mask.mask]) return "";
  return `<span class="chip" style="border-color:#3a2f4a;color:#c9a6f0">🎭 ${MASK_LABEL[l.mask.mask]}</span>`;
}
// Derive a segment for legacy leads that predate the field.
function deriveSegment(l) {
  if (["success", "save", "winback"].includes(l.track)) return "csm";
  if (l.track === "closing") return "close";
  if (l.stage === "booked") return "call";
  if (l.stage === "post-call") return "followup";
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
    offer: { name: "", summary: "", whoFor: "", transformation: "", deliverables: "", price: "", guarantee: "", differentiators: "", objections: "", faqs: "", booking: "", extra: "" },
    methodology: { name: "", principles: "", emailStructure: "", callStructure: "", messageStructure: "", never: "" },
    tone: { formality: "", sentenceLength: "", energy: "", emoji: "", slang: "", signature: "", avoid: "", extra: "", samples: [] },
  };
}

// Built-in Quick Pitch script (compliant version - support language, doctor owns
// meds). Seeded once into Saved scripts; blank lines chunk it into teleprompter
// blocks. Placeholders: NAME, PRODUCT, ADDRESS, WEIGHT, AGE, PRICE, YOUR NAME.
const QUICK_PITCH_TEXT = `QUICK PITCH

OPENING (lift your energy on "what's going on")
Hi, is this NAME?
Hi NAME, this is the PRODUCT you ordered online for your weight loss, after watching the video. How are you?
Good. Well, I wanted to welcome you. We shipped that out to ADDRESS, is that correct?
So NAME, I'm YOUR NAME, the senior health specialist here, I'll be helping you out. I just want to go over a quick protocol and make sure there are no conflicts with anything you might be taking.
So NAME, what brings you to this? Are you looking to lose weight, improve overall health, a little bit of both? What's going on?

QUALIFY (optional, weeds out time-wasters)
Just so we're certain about the results, you're wanting to lose weight. What's your weight like now?
And what's your ideal weight, what are you wanting to get down to?
Is that extra weight mostly around the middle, or all over?
Did you gain it recently, or has it come on gradually over the years?

PAIN POINT QUESTIONS (get them to say it, do not say it for them)
Have you ever been down to your ideal weight before?
What was that like for you? Do you remember how it felt?
What would it do for you, how would it change your life, if you got back down to your ideal weight?

HEALTH ANCHORS (jot every answer as you go)
Are you on any blood pressure or cholesterol medication?
Have you ever been diagnosed with diabetes or prediabetes? Type 1 or type 2?
Any high levels of stress, anxiety, or feelings of depression?
Any low energy or fatigue through the day?
Any problems sleeping, falling asleep or staying asleep?

AGE AND RAPPORT
If I may ask, what's your age?
AGE years young, huh?
Well, at least you're not 92, right? There's still some gas in the tank.

MOTIVATION (dig the pain a second time)
I'm assuming another goal is to feel less reliant on some of these medications over time. Is that right? Your doctor stays in charge of that, of course.
What's given you the motivation to get healthy and make a change now?
So family is really important to you. Is that right? Well, let's keep you around for them, okay?

TRANSITION (honest urgency, no fear)
I'm really glad you're taking action now. Most people think they can put this off and keep doing what they've been doing, and we know where that gets them. Honestly, most of our clients are just sick and tired of feeling sick and tired. So we're going to work on getting you feeling healthy, okay?

THE PROTOCOL (AM and PM, keep it simple)
The way we get this done, NAME, is you follow the exact process we use with all our clients to support your weight loss and, more importantly, help you keep it off. We help rebalance your hormonal signaling and support a healthy metabolic rate.
So when you get the PRODUCT you ordered, take that in the morning, a dropper in water or under the tongue, with or without food.
Around when you take your other pills, you'll also take a capsule of Cardiozen and a capsule of GLP-1 Max. Cardiozen supports oxygen and nutrient delivery. GLP-1 Max is not a chemical or a semaglutide, it supports your metabolism, curbs appetite a little, and supports healthy blood sugar so your body can use stored fat for energy.
Then in the evening, a capsule of Lipocorpus and a capsule of Deep Sleep, to support mood and help manage stress and cortisol at night, so your body stays in fat-burning mode while you sleep.
So it's just your AM essentials and your PM essentials. Simple.

REBUTTAL - "Is this coming with what I ordered? / That's not what I ordered"
(Not a no, it's confusion. Slow down and clarify.)
Yeah, I know you only ordered the PRODUCT online. The reason we go over this on the phone, NAME, is that when you watched the video we didn't know your medications, your age, your goals, or that you've got WEIGHT to lose. That's exactly why we call you and set it up the right way.
So yes, there are a few additional supplements I'll send out. But the good news is it's temporary, not long term. Once you've got your results we move you into maintenance and you stop taking them. It's a one-and-done protocol.
Okay?

COMPLIANCE LINE (protects you and them)
Keep following your doctor's orders on your medications for now, that way we're being totally safe. When you finish the program you go back to your doctor, and if your numbers are better they'll advise you on anything to do with your medication. We're just using the supplements to support your body.

THE CLOSE (anchor high, deliver it slow)
So now you're a member with us. We discount off what you already ordered online, and anything you were double-billed for.
The 12-month standard program, NAME, the full one-year protocol, is right around PRICE. That's everything you need for the full year, all-inclusive, nothing else to buy.

IF "THAT'S A LOT OF MONEY" (double down, do not discount)
You're right, NAME, that is a lot of money. But once you've lost the weight, you're feeling better, breathing better, spending more time with the grandkids, you're going to see it's money well spent. So let's go ahead and get you what you need, okay?

IF "I DON'T HAVE THAT KIND OF MONEY" (walk down)
You're right, that is a lot. Are you on a budget?
Okay, so let's not do anything too big. Rather than the 12 months, let's stick with the 6-month program. It still gets you your 90-day results guarantee, and we go from there. Would that be better for you?
(Do not quote a price yet. Let them ask, then apply discounts.)

RESULTS GUARANTEE (never say money-back)
You'll get the results, but you have to take the supplements. Commit to 90 days with me, we commit to 90 days with you.`;

// Fill in any missing collections/fields so old data (or a copy pulled from
// another device) is always safe to render. Pure shape work, no side effects.
function ensureShape(d) {
  if (!d.settings) d.settings = { access: "", coachName: "", offer: "", idealClient: "", results: [], resources: [], tone: "" };
  if (!d.playbook) d.playbook = defaultPlaybook();
  if (!d.assets) d.assets = [];
  if (!d.team) d.team = { setters: [], closers: [], csms: [] };
  if (!d.savedPlans) d.savedPlans = [];
  if (!d.content) d.content = [];
  if (!d.creator) d.creator = { niche: "", audience: "", pillars: "", platforms: "", cadence: "", goal: "" };
  if (!d.contentPlan) d.contentPlan = [];
  if (!d.scripts) d.scripts = [];
  if (typeof d.liveScriptId !== "string") d.liveScriptId = "";
  if (!d.products) d.products = [];
  if (!d.medRefs) d.medRefs = [];
  if (!d.leads) d.leads = [];
  d.products.forEach((p) => { if (!p.kind) p.kind = "product"; });
  if (typeof d.updatedAt !== "number") d.updatedAt = 0;
  if (typeof d.settings.sync !== "boolean") d.settings.sync = false;
  if (typeof d.settings.lite !== "boolean") d.settings.lite = false;
  // Seed the built-in Quick Pitch once. The flag means it won't reappear if deleted.
  if (!d.seededQuickPitch) {
    if (!d.scripts.some((s) => s.name === "Quick Pitch")) {
      d.scripts.push({ id: uid(), name: "Quick Pitch", text: QUICK_PITCH_TEXT });
    }
    d.seededQuickPitch = true;
  }
  // Backfill the segment field on any leads created before segments existed.
  d.leads.forEach((l) => { if (!l.segment) l.segment = deriveSegment(l); });
  return d;
}
let db = ensureShape(load());
maybeDailyBackup();

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
    savedPlans: [],
    content: [],
    creator: { niche: "", audience: "", pillars: "", platforms: "", cadence: "", goal: "" },
    contentPlan: [],
    scripts: [],
    liveScriptId: "",
    products: [],
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
// Persist locally without touching the sync clock or pushing (used when adopting
// a pulled copy from the cloud, so we keep the remote timestamp).
function persistLocal() { localStorage.setItem(KEY, JSON.stringify(db)); }
function save() { db.updatedAt = Date.now(); persistLocal(); schedulePush(); }

// ----- Cross-device sync -------------------------------------------------
// One private JSON document per access code, stored server-side. Pull on load
// and on tab focus; debounced push on every save. Last write wins by updatedAt.
const Sync = { pushTimer: null, pulling: false, pushing: false, lastError: "" };
function syncOn() { return !!(db.settings.sync && db.settings.access); }
function syncHeaders() { return { "Content-Type": "application/json", "x-access-code": db.settings.access }; }

function schedulePush() {
  if (!syncOn()) return;
  if (Sync.pushTimer) clearTimeout(Sync.pushTimer);
  Sync.pushTimer = setTimeout(syncPush, 1500);
}

async function syncPush() {
  if (!syncOn() || Sync.pushing) return;
  Sync.pushing = true; updateSyncStatus("Saving to cloud…");
  try {
    const r = await fetch("/api/sync", { method: "POST", headers: syncHeaders(), body: JSON.stringify({ data: db, updatedAt: db.updatedAt }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { Sync.lastError = j.error || "Sync failed"; updateSyncStatus("Sync error: " + Sync.lastError); }
    else { Sync.lastError = ""; db.syncedAt = j.updatedAt || db.updatedAt; updateSyncStatus("Synced just now."); }
  } catch (e) { Sync.lastError = "Network error"; updateSyncStatus("Sync error: offline"); }
  Sync.pushing = false;
}

// Pull the cloud copy. Normally we only adopt it if it is newer than what is on
// this device (last write wins). force=true adopts it regardless (the manual
// "Pull cloud" button) - a backup is taken first so it is always recoverable.
// announce=true reports even when nothing changed.
async function syncPull(announce, force) {
  if (!syncOn() || Sync.pulling) return;
  Sync.pulling = true; updateSyncStatus("Checking cloud…");
  try {
    const r = await fetch("/api/sync", { method: "GET", headers: syncHeaders() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { Sync.lastError = j.error || "Sync failed"; updateSyncStatus("Sync error: " + Sync.lastError); Sync.pulling = false; return; }
    const remote = j.data, remoteAt = j.updatedAt || 0;
    if (remote && (force || remoteAt > (db.updatedAt || 0))) {
      // Always snapshot the current device BEFORE adopting a cloud copy, even on
      // a silent background pull, so nothing is ever overwritten unrecoverably.
      if ((db.leads || []).length || (db.products || []).length) snapshotBackup(force ? "before force pull" : "before sync overwrite");
      db = ensureShape(remote);
      db.updatedAt = remoteAt || Date.now();
      db.syncedAt = remoteAt;
      persistLocal();
      rerender(); if (typeof loadSettingsForm === "function") loadSettingsForm();
      updateSyncStatus(force ? "Replaced this device with the cloud copy." : "Pulled newer data from cloud.");
      toast("Synced from cloud");
    } else if (!remote) {
      // Nothing in the cloud yet - seed it from this device.
      updateSyncStatus("First sync - uploading this device…");
      await syncPush();
    } else {
      updateSyncStatus(announce ? "Already up to date (this device is newest)." : "Synced.");
    }
  } catch (e) { updateSyncStatus("Sync error: offline"); }
  Sync.pulling = false;
}

function agoLabel(ms) {
  if (!ms) return "never";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
function updateSyncStatus(msg) {
  const el = document.getElementById("s_syncStatus");
  if (!el) return;
  if (!db.settings.access) { el.textContent = "Set your access code above first."; return; }
  if (!db.settings.sync) { el.textContent = "Off. Turn on to share this data across devices."; return; }
  el.textContent = msg || "On.";
}

// Auto-backups: rolling snapshots so nothing is ever lost. Taken before risky
// actions (import/erase) and once a day. Kept in a separate key; quota-safe.
const BKEY = "cadence.v1.backups";
function readBackups() { try { return JSON.parse(localStorage.getItem(BKEY)) || []; } catch (e) { return []; } }
function snapshotBackup(reason) {
  try {
    let arr = readBackups();
    arr.unshift({ at: new Date().toISOString(), reason: reason || "manual", data: JSON.stringify(db) });
    arr = arr.slice(0, 12);
    // If we hit the storage quota, drop the oldest snapshot and retry.
    while (arr.length) {
      try { localStorage.setItem(BKEY, JSON.stringify(arr)); break; } catch (e) { arr = arr.slice(0, arr.length - 1); }
    }
  } catch (e) {}
}
function maybeDailyBackup() {
  const last = readBackups()[0];
  if (!last || (Date.now() - new Date(last.at).getTime()) > 20 * 3600 * 1000) snapshotBackup("daily");
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now() { return Date.now(); }

// Save an AI output (draft / coach plan) onto a lead so it is never lost.
// Deduped by exact text; newest first; capped.
function saveToLead(lead, kind, label, text) {
  if (!lead || !text || !text.trim()) return false;
  lead.saved = lead.saved || [];
  if (lead.saved.some((s) => s.text === text)) return false;
  lead.saved.unshift({ id: uid(), at: new Date().toISOString(), kind, label: label || kind, text: String(text).slice(0, 8000) });
  if (lead.saved.length > 60) lead.saved = lead.saved.slice(0, 60);
  save();
  return true;
}

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
    summary: `Closing call - objection: ${OBJECTIONS[lead.objection].label}`,
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
function startClient(lead) { switchTrack(lead, "success", "client", "Onboarded as client - success track started"); }
function startSave(lead, sig) { switchTrack(lead, "save", "at-risk", `Flagged at-risk: ${RISK_SIGNALS[sig] ? RISK_SIGNALS[sig].label : "low engagement"}`, sig); }
function backOnTrack(lead) { switchTrack(lead, "success", "client", "Back on track - resumed success cadence"); }
function startWinback(lead) { switchTrack(lead, "winback", "alumni", "Reactivation started - win-back track"); }

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function startOfTomorrow() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
function relTime(iso) {
  if (!iso) return "-";
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
  if (!iso) return "-";
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
          ${trackChip(l)} ${maskChip(l)}
          <strong>${relTime(l.nextActionAt)}</strong> - ${esc(step.intent)}
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
    ? `<div class="section-title">${seg.label} · ${pool.length}<span class="muted" style="text-transform:none;letter-spacing:0"> - ${seg.hint}</span></div>` + pool.map(leadRow).join("")
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
        ${trackChip(l)} ${maskChip(l)}
        ${closed ? `<span class="chip">${esc(l.status)}</span>` : ""}</div>
      <div class="meta">${esc(l.company || "")}${l.company && l.offerInterest ? " · " : ""}${esc(l.offerInterest || "")}</div>
      ${assigneeChips(l)}
      ${closed ? "" : `<div class="action small muted">Next: <span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> ${esc(step.intent)} - <strong>${fmtDate(l.nextActionAt)}</strong></div>`}
    </div>
    <div class="btns">
      <select class="stage" data-stage="${l.id}">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select>
      <button class="btn sm" data-savestage="${l.id}">Save</button>
      ${closed ? `<button class="btn sm" data-reopen="${l.id}">Reopen</button>` : `<button class="btn primary sm" data-draft="${l.id}">Draft ✦</button>`}
      <button class="btn sm danger" data-leaddel="${l.id}">Delete</button>
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
  return `<option value="">-</option>` + names.map((n) => `<option ${n === selected ? "selected" : ""}>${esc(n)}</option>`).join("");
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
    `<div class="section-title">Customer success - client lifecycle (${CS_LIFECYCLE.length} touches)</div>` +
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
      <div class="row">
        <div class="field"><label>Name</label><input id="d_name" value="${esc(l.name)}" /></div>
        <div class="field"><label>Company</label><input id="d_company" value="${esc(l.company)}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Email</label><input id="d_email" value="${esc(l.email)}" /></div>
        <div class="field"><label>Phone</label><input id="d_phone" value="${esc(l.phone)}" /></div>
      </div>
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
      <div class="section-title">Mask read ${l.mask && MASK_LABEL[l.mask.mask] ? `· 🎭 ${MASK_LABEL[l.mask.mask]}` : ""}</div>
      ${l.mask ? `<div class="out small" style="white-space:pre-wrap;margin-bottom:8px">${esc(l.mask.summary || "")}${l.mask.affirmation ? `\n\nAffirm: ${esc(l.mask.affirmation)}` : ""}</div>` : `<p class="small muted" style="margin:0 0 8px">Paste a call transcript and Cadence pools them into their dominant need, then every follow-up affirms it automatically.</p>`}
      <button class="btn sm" id="d_mask">🎭 ${l.mask ? "Re-run mask read" : "Mask read (paste transcript)"}</button>
      <div class="modal-actions">
        <button class="btn primary sm" id="d_save">Save</button>
        <button class="btn sm" id="d_draft">Draft next ✦</button>
        <button class="btn sm" id="d_won">Won 🏆</button>
        <button class="btn sm" id="d_lost">Lost</button>
        <button class="btn sm danger" id="d_del">Delete</button>
      </div>
      <div class="section-title">Closing follow-up ${l.track === "closing" ? `· on track: ${esc(OBJECTIONS[l.objection] ? OBJECTIONS[l.objection].label : l.objection)}` : ""}</div>
      <p class="small muted" style="margin:0 0 8px">Had a closing call but they didn't buy? Tag the objection - the lead switches to a follow-up sequence built to dissolve that exact concern.</p>
      <div class="row">
        <div class="field"><label>Objection from the call</label>
          <select id="d_obj">${Object.entries(OBJECTIONS).map(([k, v]) => `<option value="${k}" ${l.objection === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
        <div class="field" style="display:flex;align-items:flex-end">
          <button class="btn sm" id="d_startclose" style="width:100%">${l.track === "closing" ? "Update objection track" : "Didn't close → start closing track"}</button>
        </div>
      </div>
      <div class="section-title">Customer success</div>
      <p class="small muted" style="margin:0 0 8px">Won the deal? Onboard them and Cadence runs the client journey - onboarding → results → renewal/upsell - and catches churn risk before it costs you the client.</p>
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
      ${(l.meds || []).length ? `<div class="section-title">Medications noted (${l.meds.length})</div>
        <p class="help" style="margin:-4px 0 8px">For your awareness and the health advisor. Not medical advice - the doctor is the authority.</p>
        ${l.meds.map((m) => {
          const name = typeof m === "string" ? m : (m.name || "");
          const uses = (typeof m === "object" && m.uses) || "";
          const se = (typeof m === "object" && m.sideEffects || []).join(", ");
          const rk = (typeof m === "object" && m.risks || []).join("; ");
          const cls = (typeof m === "object" && [m.generic && m.generic.toLowerCase() !== name.toLowerCase() ? m.generic : "", m.class].filter(Boolean).join(" · ")) || "";
          return `<div class="medcard"><div class="medcard-h">💊 ${esc(name)}${cls ? ` <span class="tiny muted">${esc(cls)}</span>` : ""}</div>${uses ? `<div class="small"><span class="medlabel medlabel-use">Used for</span> ${esc(uses)}</div>` : ""}${se ? `<div class="small"><span class="medlabel">Side effects</span> ${esc(se)}</div>` : ""}${rk ? `<div class="small"><span class="medlabel medlabel-risk">Risks</span> ${esc(rk)}</div>` : ""}</div>`;
        }).join("")}` : ""}
      <div class="section-title">Saved drafts &amp; plans (${(l.saved || []).length})</div>
      ${(l.saved || []).length ? (l.saved || []).map((s) => `
        <div class="card" style="margin:0 0 8px;padding:11px 13px">
          <div class="small" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${({ plan: "🧠 ", transcript: "📄 ", review: "🔍 " }[s.kind] || "✦ ")}${esc(s.label || s.kind)}</strong>
            <span class="muted tiny">${fmtDate(s.at)}</span>
          </div>
          <div class="out small" style="margin-top:6px;max-height:140px;overflow:auto;white-space:pre-wrap">${esc(s.text)}</div>
          <div class="modal-actions" style="margin-top:6px">
            <button class="btn sm" data-savedcopy="${s.id}">Copy</button>
            <button class="btn sm danger" data-saveddel="${s.id}">Delete</button>
          </div>
        </div>`).join("") : `<p class="small muted">Drafts and game plans you create will auto-save here.</p>`}
      <div class="section-title">Touch history (${(l.touches || []).length})</div>
      ${touches.length ? `<ul class="tight small">${touches.map((t) => `<li><span class="chip ${t.channel}">${CHANNEL_LABEL[t.channel] || t.channel}</span> <span class="muted">${fmtDate(t.at)}</span> - ${esc(t.summary || t.intent)}</li>`).join("")}</ul>` : `<p class="small muted">No touches logged yet.</p>`}
    </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-savedcopy]"), dl = e.target.closest("[data-saveddel]");
    if (cp) { const s = (l.saved || []).find((x) => x.id === cp.dataset.savedcopy); if (s) navigator.clipboard.writeText(s.text).then(() => toast("Copied")).catch(() => toast("Copy failed")); }
    else if (dl) { l.saved = (l.saved || []).filter((x) => x.id !== dl.dataset.saveddel); save(); close(); openDetail(id); toast("Deleted"); }
  });
  bg.querySelector("#d_save").onclick = () => {
    l.name = bg.querySelector("#d_name").value.trim();
    l.company = bg.querySelector("#d_company").value.trim();
    l.email = bg.querySelector("#d_email").value.trim();
    l.phone = bg.querySelector("#d_phone").value.trim();
    l.stage = bg.querySelector("#d_stage").value;
    l.temperature = bg.querySelector("#d_temp").value;
    l.offerInterest = bg.querySelector("#d_interest").value.trim();
    l.notes = bg.querySelector("#d_notes").value.trim();
    l.segment = bg.querySelector("#d_segment").value;
    l.assignedSetter = bg.querySelector("#d_setter").value;
    l.assignedCloser = bg.querySelector("#d_closer").value;
    l.assignedCSM = bg.querySelector("#d_csm").value;
    if (l.stage === "client" && l.track !== "success") startClient(l); else save();
    close(); rerender(); toast("Saved");
  };
  bg.querySelector("#d_setcall").onclick = () => {
    l.assignedSetter = bg.querySelector("#d_setter").value;
    l.assignedCloser = bg.querySelector("#d_closer").value;
    l.segment = "call"; l.stage = "booked"; l.status = "active";
    save(); close(); rerender();
    toast(l.assignedCloser ? `Call set - linked to ${l.assignedCloser}` : "Call set ▸ (assign a closer in the lead)");
  };
  bg.querySelector("#d_stage").onchange = (e) => { const seg = STAGE_SEGMENT[e.target.value]; if (seg) bg.querySelector("#d_segment").value = seg; };
  bg.querySelector("#d_draft").onclick = () => { close(); openDraft(l.id); };
  bg.querySelector("#d_mask").onclick = () => { close(); openMaskRead(l.id); };
  bg.querySelector("#d_won").onclick = () => {
    l.assignedCloser = bg.querySelector("#d_closer").value || l.assignedCloser;
    l.assignedCSM = bg.querySelector("#d_csm").value || l.assignedCSM || (db.team.csms || [])[0] || "";
    l.wonAt = new Date().toISOString();
    l.touches = l.touches || [];
    l.touches.push({ at: l.wonAt, channel: "call", direction: "out", valueAngle: "proof", intent: "Deal won 🏆", summary: "Deal won - handed to CSM, onboarding started" });
    startClient(l); // becomes an active client on the success lifecycle (onboarding due now)
    close(); rerender(); setView("today");
    toast(l.assignedCSM ? `Won 🏆 - onboarded to ${l.assignedCSM}` : "Won 🏆 - client journey started");
  };
  bg.querySelector("#d_lost").onclick = () => { l.status = "lost"; l.stage = "lost"; save(); close(); rerender(); toast("Marked lost"); };
  bg.querySelector("#d_startclose").onclick = () => { startClosing(l, bg.querySelector("#d_obj").value); close(); rerender(); setView("today"); toast("Closing track started ▸"); };
  bg.querySelector("#d_onboard").onclick = () => { startClient(l); close(); rerender(); setView("today"); toast(l.track === "success" ? "Client journey restarted 🔁" : "Onboarded - client journey started ▸"); };
  bg.querySelector("#d_winback").onclick = () => { startWinback(l); close(); rerender(); setView("today"); toast("Win-back started ▸"); };
  const flagBtn = bg.querySelector("#d_flag");
  if (flagBtn) flagBtn.onclick = () => { startSave(l, bg.querySelector("#d_sig").value); close(); rerender(); setView("today"); toast("Flagged at-risk - save-play started ⚠"); };
  const backBtn = bg.querySelector("#d_back");
  if (backBtn) backBtn.onclick = () => { backOnTrack(l); close(); rerender(); setView("today"); toast("Back on track ▸"); };
  bg.querySelector("#d_del").onclick = () => { if (confirm("Delete this lead? A backup is taken first (recoverable from Settings -> Data).")) { snapshotBackup("before delete lead"); db.leads = db.leads.filter((x) => x.id !== id); save(); close(); rerender(); toast("Deleted"); } };
}

// ---------------------------------------------------------------------------
// Mask Read modal
// ---------------------------------------------------------------------------
function openMaskRead(id) {
  const l = db.leads.find((x) => x.id === id);
  if (!l) return;
  const bg = document.createElement("div"); bg.className = "modal-bg open";
  bg.innerHTML = `
    <div class="modal">
      <button class="close-x">&times;</button>
      <h3>🎭 Mask read - ${esc(l.name) || "lead"}</h3>
      <p class="small muted" style="margin:0 0 10px">Paste a call transcript (Fathom, Zoom, Otter, Grain - any transcript text). Cadence pools them into their dominant social need and tells you exactly how to lead them.</p>
      <div class="field"><textarea id="mr_t" rows="8" placeholder="Paste the full transcript here…">${esc(l._lastTranscript || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn primary sm" id="mr_go">Analyze</button>
        <button class="btn sm ghost" id="mr_close2">Cancel</button>
      </div>
      <div id="mr_out" style="margin-top:12px"></div>
    </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.querySelector("#mr_close2").onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector("#mr_go").onclick = async () => {
    const transcript = bg.querySelector("#mr_t").value.trim();
    if (transcript.length < 80) { toast("Paste a fuller transcript"); return; }
    if (!db.settings.access) { toast("Set access code in Settings"); return; }
    const out = bg.querySelector("#mr_out");
    out.innerHTML = `<p class="small muted">Reading the room…</p>`;
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
        body: JSON.stringify({ transcript, contactName: l.name }),
      });
      const j = await r.json();
      if (!r.ok) { out.innerHTML = `<p class="small">⚠ ${esc(j.error || "Failed")}</p>`; return; }
      const a = j.analysis || {};
      out.innerHTML = `
        <div class="card" style="margin:0">
          <div class="name">🎭 ${esc(MASK_LABEL[a.mask] || a.mask || "-")}
            ${a.runnerUp && MASK_LABEL[a.runnerUp] ? `<span class="chip">+ ${esc(MASK_LABEL[a.runnerUp])}</span>` : ""}
            <span class="chip">${esc(a.confidence || "")} confidence</span></div>
          <p class="small" style="margin:8px 0">${esc(a.summary || "")}</p>
          ${a.affirmation ? `<div class="section-title">Affirm their need</div><div class="out small">${esc(a.affirmation)}</div>` : ""}
          ${(a.evidence || []).length ? `<div class="section-title">Evidence</div><ul class="tight small">${a.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
          ${(a.beliefs || []).length ? `<div class="section-title">Beliefs to dissolve (with a question)</div><ul class="tight small">${a.beliefs.map((b) => `<li><strong>${esc(b.belief)}</strong> → <em>${esc(b.question)}</em></li>`).join("")}</ul>` : ""}
          ${(a.mirror || []).length ? `<div class="section-title">Mirror their words</div><div class="small">${a.mirror.map((m) => `<span class="chip">${esc(m)}</span>`).join(" ")}</div>` : ""}
          <div class="modal-actions"><button class="btn primary sm" id="mr_save">Save to lead ▸</button></div>
        </div>`;
      out.querySelector("#mr_save").onclick = () => {
        l.mask = { ...a, at: new Date().toISOString() };
        l._lastTranscript = transcript.slice(0, 20000);
        l.touches = l.touches || [];
        l.touches.push({ at: new Date().toISOString(), channel: "call", direction: "out", valueAngle: "insight", intent: "Mask read", summary: `Mask: ${MASK_LABEL[a.mask] || a.mask}` });
        save(); close(); rerender(); toast(`Saved - every draft now affirms ${MASK_LABEL[a.mask] || "their need"}`);
      };
    } catch (e) { out.innerHTML = `<p class="small">⚠ Network error - try again.</p>`; }
  };
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
  $("modalTitle").textContent = `Draft - ${l.name || "lead"}`;
  const assetChip = asset ? `<span class="chip proof">✶ ${esc(asset.title || asset.person || asset.type)}</span>` : "";
  $("modalMeta").innerHTML = `<span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> <span class="chip ${step.valueAngle}">${ANGLE_LABEL[step.valueAngle]}</span> ${trackChip(l)} ${maskChip(l)} ${assetChip} ${esc(step.intent)}`;
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
        mask: l.mask || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) { $("modalOut").textContent = "⚠ " + (j.error || "Drafting failed."); return; }
    $("modalOut").textContent = j.text || "(empty)";
    // Remember which asset this draft used so it's locked in when you advance.
    l._pendingAsset = draftCtx.asset ? draftCtx.asset.id : null; save();
  } catch (e) {
    $("modalOut").textContent = "⚠ Network error - try again.";
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function setView(name) {
  ["today", "live", "pipeline", "add", "coach", "content", "products", "meds", "playbook", "assets", "settings"].forEach((v) => $("view-" + v).classList.toggle("hidden", v !== name));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "today") renderToday();
  if (name === "live") setupLive();
  if (name === "coach") setupCoach();
  if (name === "content") setupContent();
  if (name === "products") renderProducts();
  if (name === "meds") renderMedRefs();
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
  else if (t.dataset.savestage) {
    const id = t.dataset.savestage;
    const sel = document.querySelector(`select.stage[data-stage="${id}"]`);
    const l = db.leads.find((x) => x.id === id);
    if (l && sel) {
      l.stage = sel.value;
      if (l.stage === "won") l.status = "won"; else if (l.stage === "lost") l.status = "lost"; else l.status = "active";
      if (STAGE_SEGMENT[l.stage]) l.segment = STAGE_SEGMENT[l.stage];
      if (l.stage === "client" && l.track !== "success") startClient(l); else save();
      rerender(); toast(STAGE_SEGMENT[l.stage] ? `Saved - moved to ${SEGMENT_LABEL[l.segment]}` : "Saved");
    }
  }
  else if (t.dataset.aedit) { openAssetEdit(t.dataset.aedit); }
  else if (t.dataset.adel) { if (confirm("Delete this asset?")) { db.assets = (db.assets || []).filter((x) => x.id !== t.dataset.adel); save(); renderAssets(); toast("Deleted"); } }
  else if (t.dataset.gpcopy) { const s = (db.savedPlans || []).find((x) => x.id === t.dataset.gpcopy); if (s) navigator.clipboard.writeText(s.text).then(() => toast("Copied")).catch(() => toast("Copy failed")); }
  else if (t.dataset.gpdel) { db.savedPlans = (db.savedPlans || []).filter((x) => x.id !== t.dataset.gpdel); save(); renderSavedPlans(); toast("Deleted"); }
  else if (t.dataset.cocopy) { const s = (db.content || []).find((x) => x.id === t.dataset.cocopy); if (s) navigator.clipboard.writeText(s.text).then(() => toast("Copied")).catch(() => toast("Copy failed")); }
  else if (t.dataset.codel) { db.content = (db.content || []).filter((x) => x.id !== t.dataset.codel); save(); renderContentLib(); toast("Deleted"); }
  else if (t.dataset.leaddel) {
    const l = db.leads.find((x) => x.id === t.dataset.leaddel);
    if (l && confirm(`Delete ${l.name || "this lead"}? A backup is taken first (recoverable from Settings -> Data).`)) {
      snapshotBackup("before delete lead"); db.leads = db.leads.filter((x) => x.id !== t.dataset.leaddel); save(); rerender(); toast("Lead deleted");
    }
  }
  else if (t.dataset.predit) { openProductEdit(t.dataset.predit); }
  else if (t.dataset.prdel) { if (confirm("Delete this product?")) { db.products = (db.products || []).filter((x) => x.id !== t.dataset.prdel); save(); renderProducts(); toast("Deleted"); } }
  else if (t.dataset.writeidx) { writeFromPlan(parseInt(t.dataset.writeidx, 10)); }
  else if (t.dataset.restore) {
    const b = readBackups()[parseInt(t.dataset.restore, 10)];
    if (b && confirm(`Restore the backup from ${fmtDate(b.at)}? Your current data will be snapshotted first, then replaced.`)) {
      try { snapshotBackup("before restore"); db = ensureShape(JSON.parse(b.data)); save(); rerender(); loadSettingsForm(); toast("Restored"); } catch (e) { toast("Restore failed"); }
    }
  }
});
// Highlight the Save button while a stage dropdown has an unsaved change.
document.body.addEventListener("change", (e) => {
  if (e.target.dataset.stage) {
    const btn = document.querySelector(`button[data-savestage="${e.target.dataset.stage}"]`);
    if (btn) btn.classList.add("primary");
  }
});

// Draft modal controls
$("modalClose").onclick = () => $("modal").classList.remove("open");
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.remove("open"); });
$("regenBtn").onclick = () => { if (draftCtx) { draftCtx.variants = 1; runDraft(); } };
$("twoBtn").onclick = () => { if (draftCtx) { draftCtx.variants = 2; runDraft(); } };
function draftLabel() {
  const c = draftCtx || {};
  return `${CHANNEL_LABEL[c.channel] || "Draft"} - ${ANGLE_LABEL[c.valueAngle] || ""}`.trim();
}
function saveCurrentDraft(announce) {
  if (!draftCtx) return;
  const l = db.leads.find((x) => x.id === draftCtx.leadId);
  const txt = $("modalOut").textContent;
  if (l && txt && txt.length > 4 && !txt.startsWith("Drafting") && !txt.startsWith("⚠") && !txt.startsWith("🔒")) {
    const did = saveToLead(l, "draft", draftLabel(), txt);
    if (announce) toast(did ? "Saved to lead" : "Already saved");
  }
}
$("copyBtn").onclick = async () => { try { await navigator.clipboard.writeText($("modalOut").textContent); saveCurrentDraft(false); toast("Copied & saved"); } catch (e) { toast("Copy failed"); } };
$("saveDraftBtn").onclick = () => saveCurrentDraft(true);
$("logFromDraftBtn").onclick = () => {
  if (!draftCtx) return;
  const l = db.leads.find((x) => x.id === draftCtx.leadId);
  if (l) { saveCurrentDraft(false); advanceCadence(l, $("modalOut").textContent.slice(0, 200)); $("modal").classList.remove("open"); rerender(); toast("Saved, logged & advanced ▸"); }
};

// Add lead - parse
$("parseBtn").onclick = async () => {
  const text = $("pasteBox").value.trim();
  if (text.length < 8) { toast("Paste the lead first"); return; }
  if (!db.settings.access) { toast("Set access code in Settings"); setView("settings"); return; }
  $("parseBtn").disabled = true; $("parseBtn").textContent = "Parsing…";
  try {
    const r = await fetch("/api/parse", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ target: "intake", text }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Parse failed"); }
    else {
      const c = j.contact || {};
      $("f_name").value = c.name || ""; $("f_company").value = c.company || "";
      $("f_email").value = c.email || ""; $("f_phone").value = c.phone || "";
      $("f_offerInterest").value = c.offerInterest || ""; $("f_source").value = c.source || "";
      $("f_notes").value = c.notes || "";
      toast("Parsed - review & add");
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
  toast("Added - it's in Today now"); setView("today");
};

// Settings
function loadSettingsForm() {
  const s = db.settings;
  $("s_access").value = s.access || ""; $("s_coachName").value = s.coachName || "";
  $("s_offer").value = s.offer || ""; $("s_idealClient").value = s.idealClient || "";
  $("s_results").value = (s.results || []).join("\n");
  $("s_resources").value = (s.resources || []).map((r) => (r.url ? `${r.title} - ${r.url}` : r.title)).join("\n");
  $("s_tone").value = s.tone || "";
  $("s_deepgram").value = s.deepgram || "";
  $("s_setters").value = (db.team.setters || []).join(", ");
  $("s_closers").value = (db.team.closers || []).join(", ");
  $("s_csms").value = (db.team.csms || []).join(", ");
  $("s_sync").checked = !!db.settings.sync;
  $("s_lite").checked = !!db.settings.lite;
  updateSyncStatus(db.syncedAt ? "On. Last synced " + agoLabel(db.syncedAt) + "." : "On.");
  renderCadenceView();
  renderBackups();
}
$("s_lite").addEventListener("change", () => {
  db.settings.lite = $("s_lite").checked;
  save(); applyLite();
  toast(db.settings.lite ? "Lite mode on" : "Lite mode off");
});
$("s_sync").addEventListener("change", () => {
  db.settings.sync = $("s_sync").checked;
  // Persist the toggle WITHOUT bumping the data clock or pushing - turning sync
  // on must never overwrite the cloud before we have looked at it.
  persistLocal();
  if (db.settings.sync) { toast("Sync on"); syncPull(true); } else { updateSyncStatus(); toast("Sync off"); }
});
// Push: make the cloud match THIS device. Pull (force): make this device match the cloud.
$("s_syncNow").onclick = () => {
  if (!syncOn()) { toast("Turn sync on first"); return; }
  if (!confirm("Upload THIS device's data to the cloud, replacing what's there?\n\nOther devices will pull this copy.")) return;
  db.updatedAt = Date.now(); persistLocal(); syncPush();
};
$("s_syncPull").onclick = () => {
  if (!syncOn()) { toast("Turn sync on first"); return; }
  if (!confirm("Replace THIS device's data with the cloud copy?\n\nA backup is taken first (Settings -> Data -> Auto-backups).")) return;
  syncPull(true, true);
};
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
    const m = line.split(/\s+[--]\s+/);
    const url = (line.match(/https?:\/\/\S+/) || [""])[0];
    const title = url ? line.replace(url, "").replace(/[--]\s*$/, "").trim() : line.trim();
    return title || url ? { title: title || url, url } : null;
  }).filter(Boolean);
  save(); toast("Profile saved");
};
// Persist access code as you type so first AI call works without a save round-trip.
$("s_access").addEventListener("change", () => { db.settings.access = $("s_access").value.trim(); save(); });
$("s_deepgram").addEventListener("change", () => { db.settings.deepgram = $("s_deepgram").value.trim(); save(); });

// Playbook ------------------------------------------------------------------
function loadPlaybookForm() {
  const p = db.playbook || defaultPlaybook();
  const o = p.offer || {}, m = p.methodology || {}, t = p.tone || {};
  $("pb_name").value = o.name || ""; $("pb_price").value = o.price || "";
  $("pb_summary").value = o.summary || ""; $("pb_whoFor").value = o.whoFor || "";
  $("pb_transformation").value = o.transformation || ""; $("pb_deliverables").value = o.deliverables || "";
  $("pb_guarantee").value = o.guarantee || ""; $("pb_differentiators").value = o.differentiators || "";
  $("pb_objections").value = o.objections || ""; $("pb_faqs").value = o.faqs || "";
  $("pb_booking").value = o.booking || ""; $("pb_extra").value = o.extra || "";
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
// Fill the Playbook form from a parsed blob (only non-empty values; never wipes).
function fillPlaybookFromParsed(pb) {
  const o = pb.offer || {}, m = pb.methodology || {}, t = pb.tone || {};
  const set = (id, v) => { if (v && String(v).trim()) $(id).value = v; };
  set("pb_name", o.name); set("pb_price", o.price); set("pb_summary", o.summary); set("pb_whoFor", o.whoFor);
  set("pb_transformation", o.transformation); set("pb_deliverables", o.deliverables); set("pb_guarantee", o.guarantee);
  set("pb_differentiators", o.differentiators); set("pb_objections", o.objections); set("pb_faqs", o.faqs);
  set("pb_booking", o.booking); set("pb_extra", o.extra);
  set("pb_m_name", m.name); set("pb_m_principles", m.principles); set("pb_m_email", m.emailStructure);
  set("pb_m_call", m.callStructure); set("pb_m_message", m.messageStructure); set("pb_m_never", m.never);
  set("pb_t_formality", t.formality); set("pb_t_emoji", t.emoji); set("pb_t_sentence", t.sentenceLength);
  set("pb_t_energy", t.energy); set("pb_t_slang", t.slang); set("pb_t_signature", t.signature); set("pb_t_avoid", t.avoid);
  if (Array.isArray(t.samples) && t.samples.length) {
    const cur = $("pb_t_samples").value.trim();
    $("pb_t_samples").value = (cur ? cur + "\n---\n" : "") + t.samples.join("\n---\n");
  }
}
$("pb_parse_go").onclick = async () => {
  const text = $("pb_parse_text").value.trim();
  if (text.length < 20) { toast("Paste a bit more detail first"); return; }
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const section = $("pb_parse_section").value;
  $("pb_parse_go").disabled = true; $("pb_parse_go").textContent = "Parsing…"; $("pb_parse_status").textContent = "";
  try {
    const r = await fetch("/api/parse", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ target: "playbook", text, section }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Parse failed"); }
    else {
      fillPlaybookFromParsed(j.playbook || {});
      $("pb_parse_status").textContent = "Filled below - review, then hit Save Playbook";
      toast("Filled from paste - review & Save");
    }
  } catch (e) { toast("Network error"); }
  $("pb_parse_go").disabled = false; $("pb_parse_go").textContent = "Parse & fill ▸";
};
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
      faqs: $("pb_faqs").value.trim(), booking: $("pb_booking").value.trim(), extra: $("pb_extra").value.trim(),
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
  $("pb_status").textContent = "Saved ✓ - every draft now builds from your offer, method & voice";
};
function clearPlaybookSection(section, label) {
  if (!confirm(`Clear the ${label} section? A backup is taken first, so it's recoverable from Settings -> Data.`)) return;
  snapshotBackup("before clear " + section);
  db.playbook = db.playbook || defaultPlaybook();
  db.playbook[section] = defaultPlaybook()[section];
  save(); loadPlaybookForm(); toast(`${label} cleared - add a new one`);
}
$("pb_clear_offer").onclick = () => clearPlaybookSection("offer", "offer knowledge");
$("pb_clear_method").onclick = () => clearPlaybookSection("methodology", "sales methodology");
$("pb_clear_voice").onclick = () => clearPlaybookSection("tone", "voice");

// Assets library ------------------------------------------------------------
const ASSET_TYPE_LABEL = { testimonial: "Testimonial", "case-study": "Case study", story: "Story", stat: "Stat", resource: "Resource" };
function renderAssets() {
  const v = $("assetsView");
  v.innerHTML = `
    <div class="card">
      <h2>Proof &amp; asset library</h2>
      <p class="small muted">Testimonials, case studies, stats and resources on tap. When a touch calls for proof or a resource, the drafter auto-pulls the freshest one that fits - never the same one twice for a person (per-contact), rotated globally so nothing goes stale.</p>
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
        <div class="field"><label>Title (short label)</label><input id="as_title" placeholder="e.g. Hector - 4 models in 6 weeks" /></div>
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
// Deep-merge an imported playbook over the current one WITHOUT letting empty
// imported fields wipe existing values (prevents one starter pack erasing
// another's methodology/offer/tone).
function mergePlaybook(current, incoming) {
  const base = defaultPlaybook();
  const out = {
    offer: Object.assign({}, base.offer, (current || {}).offer),
    methodology: Object.assign({}, base.methodology, (current || {}).methodology),
    tone: Object.assign({}, base.tone, (current || {}).tone),
  };
  ["offer", "methodology", "tone"].forEach((sec) => {
    const inc = (incoming && incoming[sec]) || {};
    Object.keys(inc).forEach((k) => {
      const v = inc[k];
      const nonEmpty = Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== "");
      if (nonEmpty) out[sec][k] = v;
    });
  });
  return out;
}
function importStarter(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let n = 0;
      snapshotBackup("before pack import");
      if (data.playbook) db.playbook = mergePlaybook(db.playbook, data.playbook);
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
      snapshotBackup("before full import");
      db = ensureShape(data); save(); rerender(); loadSettingsForm(); toast("Imported");
    } catch (e) { toast("Invalid backup file"); }
  };
  reader.readAsText(file);
}
function renderBackups() {
  const el = $("backupsList"); if (!el) return;
  const arr = readBackups();
  el.innerHTML = `<div class="section-title">Auto-backups (${arr.length})</div>` +
    (arr.length ? arr.map((b, i) => `
      <div class="lead" style="margin-bottom:6px">
        <div><div class="small"><strong>${fmtDate(b.at)}</strong> <span class="chip">${esc(b.reason)}</span></div>
        <div class="tiny muted">${(b.data.length / 1024).toFixed(0)} KB</div></div>
        <div class="btns"><button class="btn sm" data-restore="${i}">Restore</button></div>
      </div>`).join("") : `<p class="small muted">Snapshots are taken automatically before imports/erase and once a day.</p>`);
}
$("exportBtn").onclick = doExport; $("exportBtn2").onclick = doExport;
$("importBtn").onclick = () => $("importFile").click();
$("importBtn2").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => { if (e.target.files[0]) doImport(e.target.files[0]); };
$("backupNow") && ($("backupNow").onclick = () => { snapshotBackup("manual"); renderBackups(); toast("Backup taken"); });
$("wipeBtn").onclick = () => { if (confirm("Erase ALL leads and settings on this device? A backup is taken first, and Export is recommended.")) { snapshotBackup("before erase"); localStorage.removeItem(KEY); db = ensureShape(load()); rerender(); loadSettingsForm(); toast("Wiped (recoverable from Auto-backups)"); } };
$("search").addEventListener("input", (e) => renderPipeline(e.target.value));
$("segNav").addEventListener("click", (e) => { const b = e.target.closest("button[data-seg]"); if (b) { pipelineSegment = b.dataset.seg; renderPipeline($("search").value); } });
$("assigneeFilter").addEventListener("change", (e) => { pipelineAssignee = e.target.value; renderPipeline($("search").value); });

// ---------------------------------------------------------------------------
// Live call copilot - listens via the browser mic, whispers cues from /api/cue.
// ---------------------------------------------------------------------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Live = { rec: null, running: false, transcript: "", interim: "", recentCues: [], lastCueLen: 0, timer: null, leadId: "", wakeLock: null, scriptBlocks: [], scriptIdx: -1, scriptManual: false, dg: null, meds: [], medInfo: {} };
function splitScript(text) { return String(text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean); }
function updateScriptControls() {
  $("sc_pos").textContent = Live.scriptBlocks.length ? `Section ${Math.max(1, Live.scriptIdx + 1)} / ${Live.scriptBlocks.length}` : "";
  const ab = $("sc_auto");
  ab.textContent = Live.scriptManual ? "Manual - resume auto" : "Auto: on";
  ab.classList.toggle("primary", !Live.scriptManual);
}
function nudgeScript(d) {
  if (!Live.scriptBlocks.length) return;
  Live.scriptManual = true;
  const base = Live.scriptIdx < 0 ? 0 : Live.scriptIdx;
  Live.scriptIdx = Math.max(0, Math.min(Live.scriptBlocks.length - 1, base + d));
  renderScriptLive(Live.scriptIdx);
}
$("sc_back").onclick = () => nudgeScript(-1);
$("sc_next").onclick = () => nudgeScript(1);
$("sc_auto").onclick = () => {
  Live.scriptManual = !Live.scriptManual; updateScriptControls();
  toast(Live.scriptManual ? "Manual mode" : "Auto tracking on");
  // Resuming auto: re-sync the highlight to the live conversation right now,
  // instead of waiting for the transcript to grow enough to trigger a cue.
  if (!Live.scriptManual && Live.running) maybeCue(true);
};
function populateScripts() {
  const sel = $("sc_select");
  sel.innerHTML = `<option value="">(none)</option>` +
    (db.scripts || []).map((s) => `<option value="${s.id}" ${s.id === db.liveScriptId ? "selected" : ""}>${esc(s.name || "Untitled")}</option>`).join("");
  const cur = (db.scripts || []).find((s) => s.id === db.liveScriptId);
  $("sc_text").value = cur ? cur.text : $("sc_text").value;
  $("sc_name").value = cur ? cur.name : $("sc_name").value;
}
function renderScriptLive(activeIdx) {
  const el = $("sc_live");
  if (!Live.scriptBlocks.length) { el.innerHTML = `<p class="small muted">No script loaded.</p>`; return; }
  el.innerHTML = Live.scriptBlocks.map((b, i) => `<div class="sblock ${i === activeIdx ? "active" : (activeIdx >= 0 && i < activeIdx ? "past" : "")}">${esc(b)}</div>`).join("");
  const act = el.querySelector(".sblock.active");
  if (act) act.scrollIntoView({ behavior: "smooth", block: "center" });
  updateScriptControls();
}
async function acquireWakeLock() {
  try { if ("wakeLock" in navigator) { Live.wakeLock = await navigator.wakeLock.request("screen"); } } catch (e) {}
}
function releaseWakeLock() {
  try { if (Live.wakeLock) { Live.wakeLock.release(); } } catch (e) {}
  Live.wakeLock = null;
}
// The OS releases the wake lock when the tab is hidden; re-acquire on return.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Live.running && !Live.wakeLock) acquireWakeLock();
});

function setupLive() {
  const sel = $("live_lead");
  const leads = db.leads.filter((l) => l.status === "active");
  sel.innerHTML = `<option value="">(no lead - general)</option>` +
    leads.map((l) => `<option value="${l.id}" ${l.id === Live.leadId ? "selected" : ""}>${esc(l.name || "Unnamed")}${l.company ? " - " + esc(l.company) : ""}</option>`).join("");
  populateScripts();
  if (!SR) {
    $("live_status").innerHTML = "⚠ This browser can't do in-browser speech recognition. Use Chrome (the Deepgram upgrade removes this limit).";
    $("live_start").disabled = true;
  }
}
$("sc_select").onchange = () => {
  db.liveScriptId = $("sc_select").value; save();
  const cur = (db.scripts || []).find((s) => s.id === db.liveScriptId);
  $("sc_text").value = cur ? cur.text : ""; $("sc_name").value = cur ? cur.name : "";
};
$("sc_save").onclick = () => {
  const text = $("sc_text").value.trim();
  const name = $("sc_name").value.trim() || "Untitled script";
  if (!text) { toast("Paste a script first"); return; }
  let cur = (db.scripts || []).find((s) => s.id === db.liveScriptId);
  if (cur) { cur.name = name; cur.text = text; }
  else { cur = { id: uid(), name, text }; db.scripts.push(cur); db.liveScriptId = cur.id; }
  save(); populateScripts(); toast("Script saved");
};
$("sc_upload").onclick = () => $("sc_file").click();
$("sc_file").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("sc_text").value = String(r.result || ""); toast("Loaded - name it and Save"); };
  r.readAsText(f);
};
$("sc_del").onclick = () => {
  if (!db.liveScriptId) { toast("No saved script selected"); return; }
  if (!confirm("Delete this script?")) return;
  db.scripts = (db.scripts || []).filter((s) => s.id !== db.liveScriptId);
  db.liveScriptId = ""; save(); $("sc_text").value = ""; $("sc_name").value = ""; populateScripts(); toast("Deleted");
};
$("sc_gen").onclick = async () => {
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const kind = $("sc_kind").value, notes = $("sc_focus").value.trim();
  $("sc_gen").disabled = true; $("sc_gen").textContent = "Writing…";
  try {
    const r = await fetch("/api/script", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ kind, notes, playbook: db.playbook, assets: (db.assets || []).map((a) => ({ title: a.title, result: a.result, bestFor: a.bestFor })) }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Failed"); }
    else {
      $("sc_text").value = j.text || "";
      if (!$("sc_name").value.trim()) $("sc_name").value = $("sc_kind").selectedOptions[0].textContent;
      db.liveScriptId = ""; populateScriptsKeepText();
      toast("Script built - name it and Save");
    }
  } catch (e) { toast("Network error"); }
  $("sc_gen").disabled = false; $("sc_gen").textContent = "Build from Playbook ▸";
};
// Refresh the saved-scripts dropdown without clobbering the textarea/name.
function populateScriptsKeepText() {
  const sel = $("sc_select");
  sel.innerHTML = `<option value="">(none)</option>` +
    (db.scripts || []).map((s) => `<option value="${s.id}" ${s.id === db.liveScriptId ? "selected" : ""}>${esc(s.name || "Untitled")}</option>`).join("");
}
function renderTranscript() {
  const el = $("live_transcript");
  el.textContent = (Live.transcript + Live.interim).slice(-4000) || "Listening…";
  el.scrollTop = el.scrollHeight;
}
// The full transcript to copy/save/review: this session's, else the selected
// lead's last saved one.
function currentTranscript() {
  const live = (Live.transcript || "").trim();
  if (live) return live;
  const id = $("live_lead").value;
  const l = id ? db.leads.find((x) => x.id === id) : null;
  return l && l._lastTranscript ? l._lastTranscript : "";
}
$("tr_copy").onclick = async () => {
  const t = currentTranscript();
  if (!t) { toast("No transcript yet"); return; }
  try { await navigator.clipboard.writeText(t); toast("Transcript copied"); } catch (e) { toast("Copy failed"); }
};
$("tr_save").onclick = () => {
  const t = currentTranscript();
  if (!t) { toast("No transcript yet"); return; }
  const id = $("live_lead").value;
  const l = id ? db.leads.find((x) => x.id === id) : null;
  if (!l) { toast("Pick the lead this call was with (top of page)"); return; }
  l._lastTranscript = t.slice(0, 20000);
  const ok = saveToLead(l, "transcript", "Call transcript " + fmtDate(new Date().toISOString()), t);
  toast(ok ? `Transcript saved to ${l.name || "lead"}` : "Already saved");
};

// Call review -------------------------------------------------------------
$("rv_go").onclick = runReview;
$("rv_copy").onclick = async () => {
  const txt = $("rv_out").dataset.plain || "";
  if (!txt) { toast("Run a review first"); return; }
  try { await navigator.clipboard.writeText(txt); toast("Review copied"); } catch (e) { toast("Copy failed"); }
};
async function runReview() {
  const pasted = ($("rv_paste").value || "").trim();
  const transcript = pasted || currentTranscript();
  if (transcript.length < 40) { toast("Paste a transcript, or run a call first"); return; }
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const id = $("live_lead").value;
  const l = id ? db.leads.find((x) => x.id === id) : null;
  const cards = (db.products || []).map((p) => ({ name: p.name, info: p.info, kind: p.kind }));
  $("rv_go").disabled = true; $("rv_go").textContent = "Reviewing…";
  $("rv_out").innerHTML = `<p class="small muted">Reviewing the call against your method, script and cards…</p>`;
  try {
    const r = await fetch("/api/review", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({
        transcript,
        playbook: db.playbook,
        script: $("sc_text").value || "",
        cards,
        cues: Live.recentCues.slice(-25),
        contact: l ? { name: l.name, offerInterest: l.offerInterest } : {},
        mask: l ? l.mask : null,
      }),
    });
    const j = await r.json();
    if (!r.ok) { $("rv_out").innerHTML = `<p class="small">⚠ ${esc(j.error || "Review failed")}</p>`; }
    else {
      renderReview(j.review || {});
      if (l) { saveToLead(l, "review", "Call review " + fmtDate(new Date().toISOString()), $("rv_out").dataset.plain || ""); toast(`Review saved to ${l.name || "lead"}`); }
    }
  } catch (e) { $("rv_out").innerHTML = `<p class="small">⚠ Network error - try again.</p>`; }
  $("rv_go").disabled = false; $("rv_go").textContent = "Review this call ▸";
}
function renderReview(rv) {
  const HAND = { well: "✓ handled well", partly: "~ partly handled", poorly: "✗ handled poorly", missed: "✗ missed" };
  const list = (arr) => `<ul class="rv-list">${(arr || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  let html = "";
  if (rv.score || rv.outcome) html += `<div class="rv-head"><span class="rv-score">${esc(rv.score || "")}</span><span>${esc(rv.outcome || "")}</span></div>`;
  if (rv.lostAt) html += `<div class="rv-sec rv-lost"><div class="rv-h">Where it was lost</div><div>${esc(rv.lostAt)}</div></div>`;
  if (rv.wentWell && rv.wentWell.length) html += `<div class="rv-sec"><div class="rv-h">What worked</div>${list(rv.wentWell)}</div>`;
  if (rv.objections && rv.objections.length) {
    html += `<div class="rv-sec"><div class="rv-h">Objections</div>` + rv.objections.map((o) =>
      `<div class="rv-obj"><strong>${esc(o.objection)}</strong> <span class="rv-tag rv-${esc(o.handling || "")}">${esc(HAND[o.handling] || o.handling || "")}</span><div class="small">Better: ${esc(o.better || "")}</div></div>`).join("") + `</div>`;
  }
  if (rv.missed && rv.missed.length) html += `<div class="rv-sec"><div class="rv-h">Missed</div>${list(rv.missed)}</div>`;
  if (rv.method) html += `<div class="rv-sec"><div class="rv-h">Method</div><div>${esc(rv.method)}</div></div>`;
  if (rv.improve && rv.improve.length) html += `<div class="rv-sec"><div class="rv-h">Do better next time</div>${list(rv.improve)}</div>`;
  if (rv.nextStep) html += `<div class="rv-sec rv-next"><div class="rv-h">Next step</div><div>${esc(rv.nextStep)}</div></div>`;
  $("rv_out").innerHTML = html || `<p class="small muted">No review returned - try again.</p>`;
  $("rv_out").dataset.plain = reviewToText(rv);
}
function reviewToText(rv) {
  const lines = [];
  lines.push("CALL REVIEW");
  if (rv.score) lines.push("Score: " + rv.score);
  if (rv.outcome) lines.push("Outcome: " + rv.outcome);
  if (rv.lostAt) lines.push("\nWHERE IT WAS LOST:\n" + rv.lostAt);
  if (rv.wentWell && rv.wentWell.length) lines.push("\nWHAT WORKED:\n- " + rv.wentWell.join("\n- "));
  if (rv.objections && rv.objections.length) lines.push("\nOBJECTIONS:\n" + rv.objections.map((o) => `- ${o.objection} [${o.handling}]\n  Better: ${o.better}`).join("\n"));
  if (rv.missed && rv.missed.length) lines.push("\nMISSED:\n- " + rv.missed.join("\n- "));
  if (rv.method) lines.push("\nMETHOD:\n" + rv.method);
  if (rv.improve && rv.improve.length) lines.push("\nDO BETTER NEXT TIME:\n- " + rv.improve.join("\n- "));
  if (rv.nextStep) lines.push("\nNEXT STEP:\n" + rv.nextStep);
  return lines.join("\n");
}
// Headset mode: capture the call audio (the prospect) via screen/tab share and
// transcribe it with Deepgram, alongside the mic (you) via Web Speech.
async function startProspectCapture() {
  const key = (db.settings.deepgram || "").trim();
  if (!key) { toast("Add your Deepgram API key in Settings for headset mode"); setView("settings"); return false; }
  let display;
  try { display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
  catch (e) { toast("Sharing cancelled - needed to hear the prospect on a headset"); return false; }
  const audioTracks = display.getAudioTracks();
  if (!audioTracks.length) { toast("No audio shared - tick 'Share tab audio' when you pick the call"); display.getTracks().forEach((t) => t.stop()); return false; }
  display.getVideoTracks().forEach((t) => t.stop());
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const source = ac.createMediaStreamSource(new MediaStream([audioTracks[0]]));
  const processor = ac.createScriptProcessor(4096, 1, 1);
  const sink = ac.createGain(); sink.gain.value = 0;
  source.connect(processor); processor.connect(sink); sink.connect(ac.destination);
  const url = `wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=${Math.round(ac.sampleRate)}&channels=1&interim_results=true&smart_format=true`;
  const ws = new WebSocket(url, ["token", key]);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => { $("live_status").innerHTML = `<span class="live-dot">●</span> Listening (headset - both sides)…`; };
  ws.onmessage = (m) => {
    try {
      const d = JSON.parse(m.data);
      const alt = d.channel && d.channel.alternatives && d.channel.alternatives[0];
      if (alt && alt.transcript && d.is_final) { Live.transcript += alt.transcript + " "; renderTranscript(); scanProducts(alt.transcript + " "); }
    } catch (e) {}
  };
  ws.onerror = () => { $("live_status").innerHTML += " (transcription error - check Deepgram key)"; };
  processor.onaudioprocess = (e) => {
    if (ws.readyState !== 1) return;
    const input = e.inputBuffer.getChannelData(0);
    const buf = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    ws.send(buf.buffer);
  };
  // If the user stops sharing from the browser bar, stop cleanly.
  audioTracks[0].addEventListener("ended", () => { if (Live.running) liveStop(); });
  Live.dg = { ws, ac, processor, source, sink, display };
  return true;
}
function stopProspectCapture() {
  const d = Live.dg; Live.dg = null; if (!d) return;
  try { if (d.ws && d.ws.readyState === 1) d.ws.send(JSON.stringify({ type: "CloseStream" })); } catch (e) {}
  try { d.ws && d.ws.close(); } catch (e) {}
  try { if (d.processor) { d.processor.onaudioprocess = null; d.processor.disconnect(); } } catch (e) {}
  try { d.source && d.source.disconnect(); } catch (e) {}
  try { d.sink && d.sink.disconnect(); } catch (e) {}
  try { d.ac && d.ac.close(); } catch (e) {}
  try { d.display && d.display.getTracks().forEach((t) => t.stop()); } catch (e) {}
}
async function liveStart() {
  if (!SR) return;
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  if ($("live_headset").checked) { const ok = await startProspectCapture(); if (!ok) return; }
  Live.leadId = $("live_lead").value;
  Live.transcript = ""; Live.interim = ""; Live.recentCues = []; Live.lastCueLen = 0; Live.meds = []; Live.medInfo = {};
  // Pre-load any medications noted on this lead before, so you can refer back.
  const seedLead = Live.leadId ? db.leads.find((x) => x.id === Live.leadId) : null;
  if (seedLead && Array.isArray(seedLead.meds)) {
    seedLead.meds.forEach((m) => {
      const name = typeof m === "string" ? m : (m && m.name);
      if (!name || Live.meds.some((x) => x.toLowerCase() === name.toLowerCase())) return;
      Live.meds.push(name);
      if (typeof m === "object") Live.medInfo[name.toLowerCase()] = { state: "ok", cued: true, recognized: true, generic: m.generic || "", class: m.class || "", uses: m.uses || "", sideEffects: m.sideEffects || [], risks: m.risks || [] };
    });
  }
  renderMeds();
  Live.scriptBlocks = splitScript($("sc_text").value); Live.scriptIdx = -1; Live.scriptManual = false;
  $("live_cues").innerHTML = "";
  if (Live.scriptBlocks.length) { $("sc_editor").style.display = "none"; $("sc_live").style.display = "block"; $("sc_controls").style.display = "flex"; renderScriptLive(-1); }
  const rec = new SR();
  rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || "en-US";
  rec.onresult = (e) => {
    let interim = "", finals = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { Live.transcript += r[0].transcript + " "; finals += r[0].transcript + " "; } else interim += r[0].transcript;
    }
    Live.interim = interim; renderTranscript();
    if (finals) scanProducts(finals);
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { $("live_status").textContent = "⚠ Mic blocked. Allow microphone access, then Start again."; liveStop(); }
  };
  rec.onend = () => { if (Live.running) { try { rec.start(); } catch (e) {} } };
  Live.rec = rec; Live.running = true;
  try { rec.start(); } catch (e) {}
  $("live_start").disabled = true; $("live_stop").disabled = false;
  $("live_status").innerHTML = `<span class="live-dot">●</span> Listening… cues appear as the prospect talks.`;
  renderTranscript();
  acquireWakeLock();
  Live.timer = setInterval(() => maybeCue(false), 10000);
}
function liveStop() {
  Live.running = false;
  if (Live.rec) { try { Live.rec.stop(); } catch (e) {} }
  stopProspectCapture();
  clearInterval(Live.timer); Live.timer = null;
  releaseWakeLock();
  $("sc_editor").style.display = ""; $("sc_live").style.display = "none"; $("sc_controls").style.display = "none"; $("sc_note").textContent = "";
  $("live_start").disabled = false; $("live_stop").disabled = true;
  $("live_status").textContent = "Stopped.";
  const full = Live.transcript.trim();
  if (full && Live.leadId) {
    const l = db.leads.find((x) => x.id === Live.leadId);
    if (l) {
      l._lastTranscript = full.slice(0, 20000);
      if (Live.meds.length) l.meds = Live.meds.map((m) => {
        const info = Live.medInfo[m.toLowerCase()] || {};
        return { name: m, generic: info.generic || "", class: info.class || "", uses: info.uses || "", sideEffects: info.sideEffects || [], risks: info.risks || [] };
      });
      l.touches = l.touches || [];
      const medsNote = Live.meds.length ? " Meds noted: " + Live.meds.join(", ") + "." : "";
      l.touches.push({ at: new Date().toISOString(), channel: "call", direction: "out", valueAngle: "insight", intent: "Live call", summary: "Live call - transcript saved (" + full.length + " chars)." + medsNote });
      save();
      $("live_status").innerHTML = `Stopped. Transcript saved to ${esc(l.name || "lead")}. <a href="#" id="live_mask">Run Mask Read ▸</a>`;
      const ml = $("live_mask");
      if (ml) ml.onclick = (ev) => { ev.preventDefault(); openMaskRead(l.id); };
    }
  }
}
async function maybeCue(force) {
  if (!Live.running && !force) return;
  const t = Live.transcript.trim();
  if (!force && t.length - Live.lastCueLen < 140) return;
  if (t.length < 20 || !db.settings.access) return;
  Live.lastCueLen = t.length;
  const l = Live.leadId ? db.leads.find((x) => x.id === Live.leadId) : null;
  const assets = (db.assets || []).map((a) => ({ title: a.title, result: a.result, bestFor: a.bestFor }));
  try {
    const r = await fetch("/api/cue", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({
        transcript: t.slice(-4000),
        contact: l ? { name: l.name, offerInterest: l.offerInterest, notes: l.notes } : {},
        mask: l ? l.mask : null,
        playbook: db.playbook,
        assets,
        recentCues: Live.recentCues.slice(-10),
        scriptBlocks: Live.scriptBlocks,
        cards: (db.products || []).filter((p) => normKind(p.kind) !== "product").slice(0, 40).map((p) => ({ kind: normKind(p.kind), name: p.name, info: p.info })),
      }),
    });
    const j = await r.json();
    if (j.cues && j.cues.length) renderCues(j.cues);
    if (Array.isArray(j.meds) && j.meds.length) addMeds(j.meds);
    if (!Live.scriptManual && Live.scriptBlocks.length && typeof j.scriptIndex === "number" && j.scriptIndex >= 0 && j.scriptIndex < Live.scriptBlocks.length) {
      Live.scriptIdx = j.scriptIndex; renderScriptLive(Live.scriptIdx);
    }
    if (Live.scriptBlocks.length) $("sc_note").textContent = j.scriptNote ? "- " + j.scriptNote : "";
  } catch (e) {}
}
function renderCues(cues) {
  const box = $("live_cues");
  if (box.querySelector(".empty")) box.innerHTML = "";
  cues.forEach((c) => {
    Live.recentCues.push(c.text);
    const div = document.createElement("div");
    div.className = "cue " + (["ask", "objection", "mask", "value", "nudge", "tone", "book", "med"].includes(c.type) ? c.type : "ask");
    div.innerHTML = `<span class="cue-type">${esc(c.type || "ask")}</span>${esc(c.text)}`;
    box.prepend(div);
  });
  while (box.children.length > 12) box.removeChild(box.lastChild);
  if (Live.recentCues.length > 30) Live.recentCues = Live.recentCues.slice(-20);
}
// Medications the prospect mentions, accumulated across the call (deduped).
function addMeds(names) {
  let changed = false;
  names.forEach((n) => {
    const name = String(n || "").trim();
    if (name && !Live.meds.some((m) => m.toLowerCase() === name.toLowerCase())) { Live.meds.push(name); changed = true; showMedCue(name); lookupMed(name); }
  });
  if (changed) renderMeds();
}
// Look up a newly mentioned medication's side effects + risks once, then cache.
async function lookupMed(name) {
  const key = name.toLowerCase();
  if (Live.medInfo[key]) return;
  if (!db.settings.access) { Live.medInfo[key] = { state: "noaccess" }; renderMeds(); showMedCue(name); return; }
  Live.medInfo[key] = { state: "loading" }; renderMeds();
  try {
    const r = await fetch("/api/med", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ name }),
    });
    const j = await r.json();
    Live.medInfo[key] = r.ok ? { state: "ok", ...j } : { state: "error" };
    // Quietly build the Med reference library from meds heard on calls.
    if (r.ok && j.recognized !== false && !(db.medRefs || []).some((x) => (x.name || "").toLowerCase() === (j.name || name).toLowerCase())) {
      db.medRefs = db.medRefs || [];
      db.medRefs.unshift({ id: uid(), name: j.name || name, generic: j.generic || "", class: j.class || "", uses: j.uses || "", sideEffects: j.sideEffects || [], risks: j.risks || [], at: new Date().toISOString() });
      if (db.medRefs.length > 200) db.medRefs = db.medRefs.slice(0, 200);
      save();
    }
  } catch (e) { Live.medInfo[key] = { state: "error" }; }
  renderMeds();
  showMedCue(name); // enrich the instant cue in place with the details
}
// The whisper line for a medication, given whatever we know so far.
function medCueText(name, info) {
  let text = `💊 ${name}`;
  const st = info && info.state;
  if (st === "ok" && info.recognized !== false) {
    if (info.uses) text += ` (${info.uses})`;
    const se = (info.sideEffects || []).slice(0, 3).join(", ");
    const rk = (info.risks || []).slice(0, 3).join("; ");
    if (se) text += ` - side effects: ${se}`;
    if (rk) text += `. Risks: ${rk}`;
  } else if (info && info.recognized === false) {
    text += " - mentioned (not a recognised medication)";
  } else if (st === "error" || st === "noaccess") {
    text += " - mentioned";
  } else {
    text += " - looking up side effects…";
  }
  return text;
}
// Pop a medication into Whispers instantly, and update that same cue in place
// once the lookup returns (no waiting, no duplicate).
function showMedCue(name) {
  const box = $("live_cues"); if (!box) return;
  if (box.querySelector(".empty")) box.innerHTML = "";
  const key = name.toLowerCase();
  const html = `<span class="cue-type">med</span>${esc(medCueText(name, Live.medInfo[key]))}`;
  let el = [...box.querySelectorAll(".cue.med")].find((e) => e.dataset.med === key);
  if (el) { el.innerHTML = html; return; }
  el = document.createElement("div");
  el.className = "cue med"; el.dataset.med = key; el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > 12) box.removeChild(box.lastChild);
}
function renderMeds() {
  const el = $("live_meds"); if (!el) return;
  if (!Live.meds.length) {
    el.innerHTML = `<span class="small muted">Medications the prospect mentions will be noted here, with their common side effects and risks, for your awareness. Not medical advice - the doctor owns all medication decisions.</span>`;
    return;
  }
  el.innerHTML = `<p class="help" style="margin:0 0 8px">For your awareness only. Not medical advice, and never use this to alarm the prospect - their doctor is the authority.</p>` +
    Live.meds.map((m) => {
      const info = Live.medInfo[m.toLowerCase()] || { state: "loading" };
      const sub = (info.state === "ok" && (info.generic || info.class))
        ? ` <span class="tiny muted">${esc([info.generic && info.generic.toLowerCase() !== m.toLowerCase() ? info.generic : "", info.class].filter(Boolean).join(" · "))}</span>` : "";
      let body = "";
      if (info.state === "loading") body = `<div class="small muted">Looking up side effects and risks…</div>`;
      else if (info.state === "noaccess") body = `<div class="small muted">Set your access code in Settings to auto-look-up.</div>`;
      else if (info.state === "error") body = `<div class="small muted">Could not look this up.</div>`;
      else if (info.recognized === false) body = `<div class="small muted">Not recognised as a medication - noted anyway.</div>`;
      else body =
        (info.uses ? `<div class="small"><span class="medlabel medlabel-use">Used for</span> ${esc(info.uses)}</div>` : "") +
        (info.sideEffects && info.sideEffects.length ? `<div class="small"><span class="medlabel">Side effects</span> ${esc(info.sideEffects.join(", "))}</div>` : "") +
        (info.risks && info.risks.length ? `<div class="small"><span class="medlabel medlabel-risk">Risks</span> ${esc(info.risks.join("; "))}</div>` : "");
      return `<div class="medcard"><div class="medcard-h">💊 ${esc(m)}${sub}</div>${body}</div>`;
    }).join("");
}

// Med reference tab: look up any medication on demand and build a library.
function medRefCardHTML(m, delAttr) {
  const cls = [m.generic && m.generic.toLowerCase() !== (m.name || "").toLowerCase() ? m.generic : "", m.class].filter(Boolean).join(" · ");
  const del = delAttr ? ` <button class="btn sm danger" ${delAttr}="${m.id}" style="float:right">Remove</button>` : "";
  return `<div class="medcard"><div class="medcard-h">💊 ${esc(m.name)}${cls ? ` <span class="tiny muted">${esc(cls)}</span>` : ""}${del}</div>` +
    (m.uses ? `<div class="small"><span class="medlabel medlabel-use">Used for</span> ${esc(m.uses)}</div>` : "") +
    (m.sideEffects && m.sideEffects.length ? `<div class="small"><span class="medlabel">Side effects</span> ${esc(m.sideEffects.join(", "))}</div>` : "") +
    (m.risks && m.risks.length ? `<div class="small"><span class="medlabel medlabel-risk">Risks</span> ${esc(m.risks.join("; "))}</div>` : "") + `</div>`;
}
function renderMedRefs() {
  const el = $("mr_list"); if (!el) return;
  const list = db.medRefs || [];
  $("mr_count").textContent = list.length ? `${list.length} saved` : "";
  el.innerHTML = list.length ? list.map((m) => medRefCardHTML(m, "data-mrdel")).join("") : `<p class="small muted">No references saved yet. Look one up above.</p>`;
}
async function medLookup() {
  const name = $("mr_input").value.trim();
  if (name.length < 2) { toast("Type a medication name"); return; }
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  $("mr_go").disabled = true; $("mr_go").textContent = "Looking up…";
  $("mr_out").innerHTML = `<p class="small muted" style="margin-top:10px">Looking up ${esc(name)}…</p>`;
  try {
    const r = await fetch("/api/med", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ name }),
    });
    const j = await r.json();
    if (!r.ok) { $("mr_out").innerHTML = `<p class="small" style="margin-top:10px">⚠ ${esc(j.error || "Lookup failed")}</p>`; }
    else if (j.recognized === false) { $("mr_out").innerHTML = `<p class="small muted" style="margin-top:10px">"${esc(name)}" was not recognised as a medication.</p>`; }
    else {
      const entry = { id: uid(), name: j.name || name, generic: j.generic || "", class: j.class || "", uses: j.uses || "", sideEffects: j.sideEffects || [], risks: j.risks || [], at: new Date().toISOString() };
      $("mr_out").innerHTML = `<div style="margin-top:12px">${medRefCardHTML(entry)}</div>`;
      // Save to the reference library, replacing any existing entry with the same name.
      db.medRefs = (db.medRefs || []).filter((x) => (x.name || "").toLowerCase() !== entry.name.toLowerCase());
      db.medRefs.unshift(entry); if (db.medRefs.length > 200) db.medRefs = db.medRefs.slice(0, 200);
      save(); renderMedRefs();
      $("mr_input").value = "";
    }
  } catch (e) { $("mr_out").innerHTML = `<p class="small" style="margin-top:10px">⚠ Network error - try again.</p>`; }
  $("mr_go").disabled = false; $("mr_go").textContent = "Look up ▸";
}
$("mr_go").onclick = medLookup;
$("mr_input").addEventListener("keydown", (e) => { if (e.key === "Enter") medLookup(); });
$("mr_list").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mrdel]"); if (!b) return;
  db.medRefs = (db.medRefs || []).filter((x) => x.id !== b.dataset.mrdel); save(); renderMedRefs(); toast("Removed");
});
$("live_start").onclick = liveStart;
$("live_stop").onclick = liveStop;
$("live_cuenow").onclick = () => maybeCue(true);
$("live_clear").onclick = () => { $("live_cues").innerHTML = `<div class="empty small">Cues appear here as the call unfolds.</div>`; };
$("pk_clear").onclick = () => {
  $("pk_panel").innerHTML = `<p class="small muted">Cards pop up here when you say their keyword. Manage them in the Knowledge tab.</p>`;
  // Reset the per-keyword cooldown so a product can pop again if you say it.
  Object.keys(triggerLastShown).forEach((k) => delete triggerLastShown[k]);
};

// ---------------------------------------------------------------------------
// Product knowledge - keyword-triggered cards during the call + management.
// ---------------------------------------------------------------------------
// Knowledge card kinds. Everything the whisper can use on a call.
const CARD_KINDS = ["product", "objection", "qa", "knowledge"];
const KIND_META = {
  product:   { label: "Product",   sec: "Products",             cls: "",    badge: "" },
  objection: { label: "Objection", sec: "Objections",           cls: "obj", badge: "⚠ Objection",  color: "var(--red)",       border: "#4a2a24" },
  qa:        { label: "Q&A",       sec: "Q&A",                  cls: "qa",  badge: "Q&A",          color: "var(--blue)",      border: "#24384a" },
  knowledge: { label: "Knowledge", sec: "Additional knowledge", cls: "kno", badge: "Knowledge",    color: "var(--gold-soft)", border: "#4a3f24" },
};
function normKind(k) { return CARD_KINDS.includes(k) ? k : "product"; }
function kindBadge(k) { const m = KIND_META[k]; return m && m.badge ? ` <span class="chip" style="color:${m.color};border-color:${m.border}">${m.badge}</span>` : ""; }
function kindOptions(sel) { return CARD_KINDS.map((k) => `<option value="${k}"${k === sel ? " selected" : ""}>${KIND_META[k].label}${k === "product" ? " / topic" : k === "objection" ? " + response" : k === "knowledge" ? " / info" : ""}</option>`).join(""); }

function productCardHTML(p, active) {
  const k = normKind(p.kind);
  const cls = KIND_META[k].cls ? KIND_META[k].cls + " " : "";
  return `<div class="sblock ${cls}${active ? "active" : ""}"><strong>${esc(p.name || KIND_META[k].label)}</strong>${kindBadge(k)}${(p.keywords && p.keywords.length) ? ` <span class="tiny muted">(${esc(p.keywords.join(", "))})</span>` : ""}<div style="margin-top:4px">${esc(p.info || "")}</div></div>`;
}
// Show ALL products tagged with a spoken keyword, grouped under that keyword.
function showProductGroup(kw, products) {
  const panel = $("pk_panel");
  if (panel.querySelector("p")) panel.innerHTML = "";
  const wrap = document.createElement("div");
  const kinds = new Set(products.map((p) => normKind(p.kind)));
  const oneKind = kinds.size === 1 ? [...kinds][0] : null;
  const noun = oneKind && oneKind !== "product" ? KIND_META[oneKind].label : "card";
  const icon = oneKind === "objection" ? "⚠" : "🔔";
  wrap.innerHTML = `<div class="section-title" style="margin:6px 0 4px">${icon} ${esc(kw)} - ${products.length} ${noun}${products.length > 1 ? "s" : ""}</div>` +
    products.map((p) => productCardHTML(p, true)).join("");
  panel.prepend(wrap);
  while (panel.children.length > 8) panel.removeChild(panel.lastChild);
}
// Scan a chunk of fresh transcript; for each keyword spoken, pop every product
// tagged with it (de-duped per keyword for 25s).
const triggerLastShown = {};
function scanProducts(textChunk) {
  if (!textChunk) return;
  const hay = textChunk.toLowerCase();
  const present = new Set();
  (db.products || []).forEach((p) => (p.keywords || []).forEach((k) => { if (k && hay.includes(k.toLowerCase())) present.add(k.toLowerCase()); }));
  present.forEach((kw) => {
    if (Date.now() - (triggerLastShown[kw] || 0) < 25000) return;
    triggerLastShown[kw] = Date.now();
    const matches = (db.products || []).filter((p) => (p.keywords || []).some((k) => k.toLowerCase() === kw));
    if (matches.length) showProductGroup(kw, matches);
  });
}
$("pk_search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const panel = $("pk_panel");
  if (!q) { panel.innerHTML = `<p class="small muted">Cards pop up here when you say their keyword.</p>`; return; }
  const hits = (db.products || []).filter((p) => (p.name || "").toLowerCase().includes(q) || (p.keywords || []).some((k) => k.includes(q)) || (p.info || "").toLowerCase().includes(q)).slice(0, 8);
  panel.innerHTML = hits.length ? hits.map((p) => productCardHTML(p, false)).join("") : `<p class="small muted">No card matches "${esc(q)}".</p>`;
});

function renderProducts() {
  const el = $("pr_list");
  const list = db.products || [];
  const cardHTML = (p) => {
    const k = normKind(p.kind);
    return `
    <div class="card" style="margin:0 0 8px;padding:11px 13px">
      <div class="small" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>${esc(p.name || KIND_META[k].label)}</strong>${kindBadge(k)}
        <span style="margin-left:auto"><button class="btn sm" data-predit="${p.id}">Edit</button> <button class="btn sm danger" data-prdel="${p.id}">Delete</button></span></div>
      ${(p.keywords && p.keywords.length) ? `<div class="action small">${p.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join(" ")}</div>` : ""}
      <div class="out small" style="margin-top:6px;max-height:120px;overflow:auto;white-space:pre-wrap">${esc(p.info || "")}</div>
    </div>`;
  };
  let html = "";
  CARD_KINDS.forEach((k, i) => {
    const items = list.filter((p) => normKind(p.kind) === k);
    html += `<div class="section-title"${i ? ' style="margin-top:14px"' : ""}>${KIND_META[k].sec} (${items.length})</div>` +
      (items.length ? items.map(cardHTML).join("") : `<p class="small muted">No ${KIND_META[k].sec.toLowerCase()} yet. Set the type when adding or parsing.</p>`);
  });
  el.innerHTML = html;
}
$("pr_add").onclick = () => {
  const name = $("pr_name").value.trim();
  const keywords = $("pr_keywords").value.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const info = $("pr_info").value.trim();
  const kind = normKind($("pr_kind").value);
  if (!name && !info) { toast("Add a name or info"); return; }
  db.products.push({ id: uid(), name, keywords, info, kind }); save();
  $("pr_name").value = ""; $("pr_keywords").value = ""; $("pr_info").value = "";
  renderProducts(); toast(KIND_META[kind].label + " added");
};
$("pr_parse_go").onclick = async () => {
  const text = $("pr_parse_text").value.trim();
  if (text.length < 20) { toast("Paste the info first"); return; }
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const kind = normKind($("pr_parse_kind").value);
  $("pr_parse_go").disabled = true; $("pr_parse_go").textContent = "Parsing…"; $("pr_parse_status").textContent = "";
  try {
    const r = await fetch("/api/parse", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ target: "products", text, kind }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Failed"); $("pr_parse_status").textContent = j.error || "Failed - try again"; }
    else {
      const added = (j.products || []).map((p) => ({ id: uid(), name: p.name || "", keywords: p.keywords || [], info: p.info || "", kind }));
      db.products.push(...added); save(); renderProducts();
      const noun = KIND_META[kind].sec.toLowerCase();
      $("pr_parse_text").value = ""; $("pr_parse_status").textContent = `Added ${added.length} to ${noun} - review below`;
      toast(`Added ${added.length} cards`);
    }
  } catch (e) { toast("Network error"); }
  $("pr_parse_go").disabled = false; $("pr_parse_go").textContent = "Parse into cards ▸";
};
function openProductEdit(id) {
  const p = (db.products || []).find((x) => x.id === id); if (!p) return;
  const bg = document.createElement("div"); bg.className = "modal-bg open";
  bg.innerHTML = `<div class="modal"><button class="close-x">&times;</button><h3>Edit card</h3>
    <div class="field"><label>Type</label><select id="pe_kind">${kindOptions(normKind(p.kind))}</select></div>
    <div class="field"><label>Name</label><input id="pe_name" value="${esc(p.name)}" /></div>
    <div class="field"><label>Trigger keywords (comma separated)</label><input id="pe_keywords" value="${esc((p.keywords || []).join(", "))}" /></div>
    <div class="field"><label>Info / response</label><textarea id="pe_info" rows="5">${esc(p.info)}</textarea></div>
    <div class="modal-actions"><button class="btn primary sm" id="pe_save">Save</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector("#pe_save").onclick = () => {
    p.name = bg.querySelector("#pe_name").value.trim();
    p.keywords = bg.querySelector("#pe_keywords").value.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    p.info = bg.querySelector("#pe_info").value.trim();
    p.kind = normKind(bg.querySelector("#pe_kind").value);
    save(); close(); renderProducts(); toast("Saved");
  };
}

// Quick objection handler - drops method-true lines into the whispers panel.
async function handleObjection(label) {
  if (!label) return;
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const lid = $("live_lead").value;
  const l = lid ? db.leads.find((x) => x.id === lid) : null;
  const box = $("live_cues"); if (box.querySelector(".empty")) box.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "cue objection"; loading.innerHTML = `<span class="cue-type">objection</span>Handling "${esc(label)}"…`;
  box.prepend(loading);
  try {
    const r = await fetch("/api/objection", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({
        objection: label,
        contact: l ? { name: l.name, offerInterest: l.offerInterest, notes: l.notes } : {},
        mask: l ? l.mask : null,
        playbook: db.playbook,
        assets: (db.assets || []).map((a) => ({ title: a.title, result: a.result, bestFor: a.bestFor })),
        transcript: (Live.transcript || "").slice(-2000),
      }),
    });
    const j = await r.json();
    loading.remove();
    if (r.ok && j.lines && j.lines.length) renderCues(j.lines.map((t) => ({ type: "objection", text: t })));
    else toast(j.error || "No suggestion");
  } catch (e) { loading.remove(); toast("Network error"); }
}
$("obj_buttons").addEventListener("click", (e) => { const b = e.target.closest("button[data-lbl]"); if (b) handleObjection(b.dataset.lbl); });
$("obj_go").onclick = () => { const t = $("obj_text").value.trim(); if (t) { handleObjection(t); $("obj_text").value = ""; } };
$("obj_text").addEventListener("keydown", (e) => { if (e.key === "Enter") $("obj_go").click(); });

// ---------------------------------------------------------------------------
// Scenario coach - method-true game plan for a described situation.
// ---------------------------------------------------------------------------
function setupCoach() {
  const sel = $("coach_lead");
  const leads = db.leads.filter((l) => l.status === "active");
  const cur = sel.value;
  sel.innerHTML = `<option value="">(no lead - general)</option>` +
    leads.map((l) => `<option value="${l.id}" ${l.id === cur ? "selected" : ""}>${esc(l.name || "Unnamed")}${l.company ? " - " + esc(l.company) : ""}</option>`).join("");
  renderSavedPlans();
}
function savedItemCard(s, copyAttr, delAttr) {
  return `<div class="card" style="margin:0 0 8px;padding:11px 13px">
    <div class="small" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>${esc(s.label || "Saved")}</strong><span class="muted tiny">${fmtDate(s.at)}</span></div>
    <div class="out small" style="margin-top:6px;max-height:160px;overflow:auto;white-space:pre-wrap">${esc(s.text)}</div>
    <div class="modal-actions" style="margin-top:6px"><button class="btn sm" data-${copyAttr}="${s.id}">Copy</button><button class="btn sm danger" data-${delAttr}="${s.id}">Delete</button></div>
  </div>`;
}
function renderSavedPlans() {
  const el = $("coach_saved"); if (!el) return;
  el.innerHTML = (db.savedPlans || []).length ? db.savedPlans.map((s) => savedItemCard(s, "gpcopy", "gpdel")).join("") : `<p class="small muted">No general plans saved yet.</p>`;
}
function saveGeneral(arr, label, text) {
  if (!text || !text.trim()) return false;
  if (arr.some((s) => s.text === text)) return false;
  arr.unshift({ id: uid(), at: new Date().toISOString(), label, text: String(text).slice(0, 9000) });
  if (arr.length > 120) arr.length = 120;
  save(); return true;
}
$("coach_go").onclick = async () => {
  const scenario = $("coach_scenario").value.trim();
  if (scenario.length < 15) { toast("Describe the situation in a bit more detail"); return; }
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const l = $("coach_lead").value ? db.leads.find((x) => x.id === $("coach_lead").value) : null;
  const includePb = $("coach_pb").checked;
  const assets = (db.assets || []).map((a) => ({ title: a.title, result: a.result, bestFor: a.bestFor }));
  $("coach_go").disabled = true; $("coach_go").textContent = "Thinking…";
  $("coach_out").textContent = "Working out the play…";
  try {
    const r = await fetch("/api/coach", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({
        scenario,
        contact: l ? { name: l.name, offerInterest: l.offerInterest, notes: l.notes } : {},
        mask: l ? l.mask : null,
        playbook: includePb ? db.playbook : { methodology: (db.playbook || {}).methodology },
        assets: includePb ? assets : [],
      }),
    });
    const j = await r.json();
    $("coach_out").textContent = r.ok ? (j.text || "(empty)") : ("⚠ " + (j.error || "Failed"));
    if (r.ok && j.text && l) { saveToLead(l, "plan", "Game plan", j.text); $("coach_out").textContent = j.text + "\n\n(Auto-saved to " + (l.name || "lead") + ")"; }
    else if (r.ok && j.text) { saveGeneral(db.savedPlans, "Game plan", j.text); renderSavedPlans(); $("coach_out").textContent = j.text + "\n\n(Auto-saved to general plans)"; }
  } catch (e) { $("coach_out").textContent = "⚠ Network error - try again."; }
  $("coach_go").disabled = false; $("coach_go").textContent = "Get the game plan";
};
$("coach_copy").onclick = async () => { try { await navigator.clipboard.writeText($("coach_out").textContent); toast("Copied"); } catch (e) { toast("Copy failed"); } };
$("coach_save").onclick = () => {
  const l = $("coach_lead").value ? db.leads.find((x) => x.id === $("coach_lead").value) : null;
  const txt = $("coach_out").textContent.replace(/\n\n\(Auto-saved.*\)$/, "");
  if (txt.length < 20 || txt.startsWith("Describe") || txt.startsWith("Working")) { toast("Generate a game plan first"); return; }
  if (l) { toast(saveToLead(l, "plan", "Game plan", txt) ? `Saved to ${l.name || "lead"}` : "Already saved"); }
  else { const did = saveGeneral(db.savedPlans, "Game plan", txt); renderSavedPlans(); toast(did ? "Saved to general plans" : "Already saved"); }
};

// ---------------------------------------------------------------------------
// Content studio - short-form content from the methodology.
// ---------------------------------------------------------------------------
function setupContent() { loadCreatorForm(); renderContentLib(); renderPlan(); }
function loadCreatorForm() {
  const c = db.creator || {};
  $("cr_niche").value = c.niche || ""; $("cr_audience").value = c.audience || "";
  $("cr_pillars").value = c.pillars || ""; $("cr_platforms").value = c.platforms || "";
  $("cr_cadence").value = c.cadence || ""; $("cr_goal").value = c.goal || "";
}
$("cr_save").onclick = () => {
  db.creator = {
    niche: $("cr_niche").value.trim(), audience: $("cr_audience").value.trim(),
    pillars: $("cr_pillars").value.trim(), platforms: $("cr_platforms").value.trim(),
    cadence: $("cr_cadence").value.trim(), goal: $("cr_goal").value.trim(),
  };
  save(); toast("Creator profile saved");
};
function renderPlan() {
  const el = $("cr_planout"); if (!el) return;
  const plan = db.contentPlan || [];
  if (!plan.length) { el.innerHTML = `<p class="small muted">Generate a plan and each idea gets a one-click "Write".</p>`; return; }
  el.innerHTML = `<div class="small muted" style="margin-bottom:8px">${plan.length} posts saved. <a href="#" id="cr_clear">Clear plan</a></div>` + plan.map((p, i) => `
    <div class="lead" style="margin-bottom:8px">
      <div>
        <div class="small"><strong>${esc(p.day)}</strong> <span class="chip">${esc(p.platform)}</span> <span class="chip role">${esc(p.pillar)}</span> ${p.done ? `<span class="chip" style="color:var(--green)">done</span>` : ""}</div>
        <div class="action small">${esc(p.hook)}</div>
      </div>
      <div class="btns"><button class="btn sm primary" data-writeidx="${i}">Write ▸</button></div>
    </div>`).join("");
  const c = $("cr_clear");
  if (c) c.onclick = (e) => { e.preventDefault(); if (confirm("Clear the saved content calendar?")) { db.contentPlan = []; save(); renderPlan(); } };
}
$("cr_plan").onclick = async () => {
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const days = parseInt($("cr_days").value, 10) || 7;
  $("cr_plan").disabled = true; $("cr_plan").textContent = "Planning…";
  try {
    const r = await fetch("/api/content", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ mode: "calendar", days, creator: db.creator, playbook: db.playbook }),
    });
    const j = await r.json();
    if (!r.ok) { toast(j.error || "Failed"); }
    else { db.contentPlan = j.plan || []; save(); renderPlan(); toast(`Planned & saved ${db.contentPlan.length} posts`); }
  } catch (e) { toast("Network error"); }
  $("cr_plan").disabled = false; $("cr_plan").textContent = "Plan my content";
};
function writeFromPlan(i) {
  const p = (db.contentPlan || [])[i]; if (!p) return;
  p.done = true; save(); renderPlan();
  setView("content");
  const opt = [...$("ct_platform").options].find((o) => p.platform && o.value.toLowerCase().includes(p.platform.toLowerCase().split(" ")[0]));
  if (opt) $("ct_platform").value = opt.value;
  $("ct_topic").value = p.hook;
  $("ct_out").scrollIntoView({ behavior: "smooth", block: "center" });
  runContent("script");
}
function renderContentLib() {
  const el = $("ct_lib"); if (!el) return;
  el.innerHTML = (db.content || []).length ? db.content.map((s) => savedItemCard(s, "cocopy", "codel")).join("") : `<p class="small muted">Saved content appears here.</p>`;
}
async function runContent(mode) {
  if (!db.settings.access) { toast("Set your access code in Settings first"); setView("settings"); return; }
  const platform = $("ct_platform").value;
  const topic = $("ct_topic").value.trim();
  const includeOffer = $("ct_pb").checked;
  const btn = mode === "ideas" ? $("ct_ideas") : $("ct_script");
  const label0 = btn.textContent;
  btn.disabled = true; btn.textContent = "Writing…";
  $("ct_out").textContent = mode === "ideas" ? "Brainstorming 10 ideas…" : "Writing your script…";
  try {
    const r = await fetch("/api/content", {
      method: "POST", headers: { "Content-Type": "application/json", "x-access-code": db.settings.access },
      body: JSON.stringify({ mode, platform, topic, includeOffer, playbook: db.playbook, creator: db.creator }),
    });
    const j = await r.json();
    if (!r.ok) { $("ct_out").textContent = "⚠ " + (j.error || "Failed"); }
    else {
      const text = j.text || "(empty)";
      const label = `${platform} - ${mode === "ideas" ? "10 ideas" : (topic || "script")}`;
      saveGeneral(db.content, label, text); renderContentLib();
      $("ct_out").textContent = text + "\n\n(Auto-saved to library)";
    }
  } catch (e) { $("ct_out").textContent = "⚠ Network error - try again."; }
  btn.disabled = false; btn.textContent = label0;
}
$("ct_script").onclick = () => runContent("script");
$("ct_ideas").onclick = () => runContent("ideas");
$("ct_copy").onclick = async () => { try { await navigator.clipboard.writeText($("ct_out").textContent); toast("Copied"); } catch (e) { toast("Copy failed"); } };
$("ct_save").onclick = () => {
  const txt = $("ct_out").textContent.replace(/\n\n\(Auto-saved to library\)$/, "");
  if (txt.length < 20 || txt.startsWith("Pick a platform") || txt.startsWith("Writing") || txt.startsWith("Brainstorming")) { toast("Generate something first"); return; }
  const label = `${$("ct_platform").value} - ${$("ct_topic").value.trim() || "saved"}`;
  toast(saveGeneral(db.content, label, txt) ? "Saved to library" : "Already saved"); renderContentLib();
};

// Lite mode: hide the CRM/content tabs for a focused, call-first setup.
const LITE_TABS = ["pipeline", "add", "coach", "content"];
function applyLite() {
  const lite = !!db.settings.lite;
  LITE_TABS.forEach((v) => {
    const b = document.querySelector(`#tabs button[data-view="${v}"]`);
    if (b) b.classList.toggle("hidden", lite);
  });
  // If we're sitting on a now-hidden tab, fall back to Today.
  if (lite) {
    const active = document.querySelector("#tabs button.active");
    if (active && LITE_TABS.includes(active.dataset.view)) setView("today");
  }
}

// Go
renderToday();
applyLite();

// Cross-device sync: pull the latest on load, and again whenever the tab regains
// focus (so switching back from your other device shows its changes).
if (syncOn()) syncPull();
let lastFocusPull = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !syncOn()) return;
  if (Date.now() - lastFocusPull < 8000) return; // avoid hammering on quick flips
  lastFocusPull = Date.now();
  syncPull();
});
