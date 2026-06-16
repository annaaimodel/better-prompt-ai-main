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

const STAGES = ["new", "contacted", "engaged", "booked", "post-call", "won", "lost", "nurture"];
const ANGLE_LABEL = { insight: "Insight", proof: "Proof", resource: "Resource", intro: "Intro/Opp" };
const CHANNEL_LABEL = { text: "Text", email: "Email", call: "Call" };
const TEMP_ORDER = { hot: 0, warm: 1, cold: 2 };

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const KEY = "cadence.v1";
const HOUR = 3600 * 1000;
let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    version: 1,
    settings: { access: "", coachName: "", offer: "", idealClient: "", results: [], resources: [], tone: "" },
    leads: [],
  };
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now() { return Date.now(); }

// ---------------------------------------------------------------------------
// Cadence helpers
// ---------------------------------------------------------------------------
function currentStep(lead) {
  if (lead.cadenceStep < CAD.length) {
    return { ...CAD[lead.cadenceStep], nurture: false };
  }
  const i = (lead.cadenceStep - CAD.length) % NURTURE_ROT.length;
  return { ...NURTURE_ROT[i], gapHours: NURTURE_GAP_HOURS, nurture: true };
}
function gapForStep(stepIndex) {
  if (stepIndex < CAD.length) return CAD[stepIndex].gapHours;
  return NURTURE_GAP_HOURS;
}
function advanceCadence(lead, summary) {
  const step = currentStep(lead);
  lead.touches = lead.touches || [];
  lead.touches.push({
    at: new Date().toISOString(),
    channel: step.channel, direction: "out",
    valueAngle: step.valueAngle, intent: step.intent,
    summary: (summary || "").slice(0, 280),
  });
  // Light auto-stage progression.
  if (lead.stage === "new") lead.stage = "contacted";
  lead.cadenceStep += 1;
  if (lead.cadenceStep >= CAD.length) lead.stage = lead.stage === "won" || lead.stage === "lost" ? lead.stage : "nurture";
  lead.nextActionAt = new Date(now() + gapForStep(lead.cadenceStep) * HOUR).toISOString();
  save();
}

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

function renderPipeline(filter) {
  const q = (filter || "").trim().toLowerCase();
  const match = (l) => !q || [l.name, l.company, l.offerInterest, l.source].some((v) => (v || "").toLowerCase().includes(q));
  const el = $("pipelineList");
  const active = db.leads.filter((l) => l.status === "active" && match(l));
  const closed = db.leads.filter((l) => l.status !== "active" && match(l));
  if (!db.leads.length) {
    el.innerHTML = `<div class="empty"><p>No leads yet.</p><p class="small">Head to <strong>Add lead</strong> to drop in your first inbound.</p></div>`;
    return;
  }
  let html = "";
  const order = ["new", "contacted", "engaged", "booked", "post-call", "nurture"];
  order.forEach((stage) => {
    const group = active.filter((l) => l.stage === stage);
    if (!group.length) return;
    html += `<div class="section-title">${stage} · ${group.length}</div>`;
    html += group.map(leadRow).join("");
  });
  if (closed.length) {
    html += `<div class="section-title">closed · ${closed.length}</div>`;
    html += closed.map(leadRow).join("");
  }
  el.innerHTML = html || `<div class="empty">No matches.</div>`;
}

function leadRow(l) {
  const step = currentStep(l);
  const closed = l.status !== "active";
  return `
  <div class="lead">
    <div>
      <div class="name"><a href="#" data-open="${l.id}">${esc(l.name) || "Unnamed lead"}</a>
        <span class="chip ${l.temperature}">${esc(l.temperature || "warm")}</span>
        ${closed ? `<span class="chip">${esc(l.status)}</span>` : ""}</div>
      <div class="meta">${esc(l.company || "")}${l.company && l.offerInterest ? " · " : ""}${esc(l.offerInterest || "")}</div>
      ${closed ? "" : `<div class="action small muted">Next: <span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> ${esc(step.intent)} — <strong>${fmtDate(l.nextActionAt)}</strong></div>`}
    </div>
    <div class="btns">
      <select class="stage" data-stage="${l.id}">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select>
      ${closed ? `<button class="btn sm" data-reopen="${l.id}">Reopen</button>` : `<button class="btn primary sm" data-draft="${l.id}">Draft ✦</button>`}
    </div>
  </div>`;
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
  el.innerHTML = rows + `<div class="action small muted" style="padding:8px 0">…then long-term nurture: a value drop every 14 days, rotating angle &amp; channel.</div>`;
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
      <div class="modal-actions">
        <button class="btn primary sm" id="d_save">Save</button>
        <button class="btn sm" id="d_draft">Draft next ✦</button>
        <button class="btn sm" id="d_won">Won 🏆</button>
        <button class="btn sm" id="d_lost">Lost</button>
        <button class="btn sm danger" id="d_del">Delete</button>
      </div>
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
    save(); close(); rerender(); toast("Saved");
  };
  bg.querySelector("#d_draft").onclick = () => { close(); openDraft(l.id); };
  bg.querySelector("#d_won").onclick = () => { l.status = "won"; l.stage = "won"; save(); close(); rerender(); toast("Marked won 🏆"); };
  bg.querySelector("#d_lost").onclick = () => { l.status = "lost"; l.stage = "lost"; save(); close(); rerender(); toast("Marked lost"); };
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
  draftCtx = { leadId: id, channel: step.channel, valueAngle: step.valueAngle, intent: step.intent, variants: 1 };
  $("modalTitle").textContent = `Draft — ${l.name || "lead"}`;
  $("modalMeta").innerHTML = `<span class="chip ${step.channel}">${CHANNEL_LABEL[step.channel]}</span> <span class="chip ${step.valueAngle}">${ANGLE_LABEL[step.valueAngle]}</span> ${esc(step.intent)}`;
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
        contact: { name: l.name, offerInterest: l.offerInterest, stage: l.stage, temperature: l.temperature, notes: l.notes },
        history,
        profile: db.settings,
      }),
    });
    const j = await r.json();
    if (!r.ok) { $("modalOut").textContent = "⚠ " + (j.error || "Drafting failed."); return; }
    $("modalOut").textContent = j.text || "(empty)";
  } catch (e) {
    $("modalOut").textContent = "⚠ Network error — try again.";
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function setView(name) {
  ["today", "pipeline", "add", "settings"].forEach((v) => $("view-" + v).classList.toggle("hidden", v !== name));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "today") renderToday();
  if (name === "pipeline") renderPipeline($("search").value);
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
    stage: "new", status: "active",
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
  renderCadenceView();
}
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

// Go
renderToday();
