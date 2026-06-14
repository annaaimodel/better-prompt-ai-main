// Runs in the page to extract the job. Self-contained (no outer references) so
// it can be injected via chrome.scripting.executeScript.
function scrapeJob() {
  const meta = p => {
    const m = document.querySelector(`meta[property="${p}"],meta[name="${p}"]`);
    return m ? m.content : "";
  };
  const out = { title: "", company: "", location: "", comp: "" };
  // Best source: schema.org JobPosting JSON-LD (LinkedIn, Indeed, many ATS use it)
  try {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(s.textContent); } catch (e) { continue; }
      const arr = Array.isArray(data) ? data : (data["@graph"] || [data]);
      for (const node of arr) {
        const t = node && node["@type"];
        const isJob = t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
        if (!isJob) continue;
        out.title = node.title || out.title;
        const org = node.hiringOrganization;
        out.company = (org && (org.name || (typeof org === "string" ? org : ""))) || out.company;
        const loc = Array.isArray(node.jobLocation) ? node.jobLocation[0] : node.jobLocation;
        const ad = loc && loc.address;
        if (ad) {
          out.location = [ad.addressLocality, ad.addressRegion, ad.addressCountry]
            .filter(Boolean).join(", ") || out.location;
        }
        if (node.jobLocationType === "TELECOMMUTE" && !out.location) out.location = "Remote";
        const sal = node.baseSalary;
        const v = sal && (sal.value || sal);
        const mn = v && (v.minValue || v.value);
        const mx = v && v.maxValue;
        if (mn) out.comp = `${sal.currency || ""} ${mn}${mx ? "-" + mx : ""}`.trim();
      }
    }
  } catch (e) { /* ignore */ }
  if (!out.title) out.title = meta("og:title") ||
    (document.querySelector("h1") && document.querySelector("h1").innerText) || document.title || "";
  if (!out.company) out.company = meta("og:site_name") || "";
  for (const k of Object.keys(out)) out[k] = (out[k] || "").toString().trim().slice(0, 200);
  return out;
}

const $ = id => document.getElementById(id);
const escapeHtml = s => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const status = t => { $("status").textContent = t; };

async function getSaved() { return (await chrome.storage.local.get("saved")).saved || []; }

async function refresh() {
  const saved = await getSaved();
  $("count").textContent = saved.length;
  $("list").innerHTML = saved.slice(0, 8).map((j, i) =>
    `<div class="row"><span>${escapeHtml(j.title || "(no title)")}<br><small>${escapeHtml(j.company || "")}</small></span>` +
    `<button class="del" data-i="${i}" title="Remove">✕</button></div>`).join("") ||
    '<div class="muted">No saved jobs yet.</div>';
  document.querySelectorAll(".del").forEach(b => b.onclick = async () => {
    const s = await getSaved(); s.splice(+b.dataset.i, 1);
    await chrome.storage.local.set({ saved: s }); refresh();
  });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  $("link").value = tab?.url || "";
  $("source").value = hostOf(tab?.url) || "Extension";
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeJob });
    if (result) {
      $("title").value = result.title || "";
      $("company").value = result.company || "";
      $("location").value = result.location || "";
      $("comp").value = result.comp || "";
    }
  } catch (e) { /* restricted page (chrome://, store) — fill manually */ }
  refresh();
}

async function save() {
  const job = {
    title: $("title").value.trim(), company: $("company").value.trim(),
    comp: $("comp").value.trim(), location: $("location").value.trim(),
    link: $("link").value.trim(), source: $("source").value.trim(),
    notes: $("notes").value.trim(), savedAt: new Date().toISOString()
  };
  if (!job.title && !job.link) { status("Add a title or link first."); return; }
  const saved = await getSaved(); saved.unshift(job);
  await chrome.storage.local.set({ saved });
  const { syncUrl } = await chrome.storage.local.get("syncUrl");
  if (syncUrl) {
    try {
      await fetch(syncUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(job) });
      status("Saved ✓ and pushed to your board.");
    } catch (e) { status("Saved locally ✓ (sync failed — check the Options URL)."); }
  } else {
    status("Saved locally ✓. Add a sync URL in ⚙ Options to push to the board.");
  }
  refresh();
}

function toCSV(rows) {
  const cols = ["title", "company", "comp", "location", "link", "source", "notes"];
  const esc = v => `"${String(v || "").replace(/"/g, '""')}"`;
  return [cols.join(",")].concat(rows.map(r => cols.map(c => esc(r[c])).join(","))).join("\n");
}

async function exportCsv() {
  const saved = await getSaved();
  if (!saved.length) { status("Nothing to export yet."); return; }
  const blob = new Blob([toCSV(saved)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "inbox-jobs.csv"; a.click();
  URL.revokeObjectURL(url);
}

$("save").onclick = save;
$("export").onclick = exportCsv;
$("opts").onclick = () => chrome.runtime.openOptionsPage();
init();
