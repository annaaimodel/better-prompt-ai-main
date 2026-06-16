/**
 * AURUM — listing email notifier (standalone Google Apps Script).
 *
 * Purpose: email you the moment a free/paid job listing is submitted at /hiring.
 * This is DELIBERATELY separate from your main Sheet sync script so it can't
 * affect email signups, saved jobs, or inbox sync. It only sends an email.
 *
 * Setup (one time):
 *   1. Go to https://script.google.com  ->  New project.
 *   2. Delete the default code, paste THIS file in, and set NOTIFY_EMAIL below.
 *   3. Deploy -> New deployment -> type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Click Deploy, authorise when prompted, and COPY the /exec Web app URL.
 *   4. In Vercel (project Settings -> Environment Variables) add:
 *        LISTING_NOTIFY_URL = <the /exec URL you copied>
 *      then redeploy the site (or it applies on next deploy).
 *
 * The Vercel /api/listing endpoint POSTs the listing JSON here after it saves
 * the row, and this script emails you a formatted alert. If you ever change the
 * email body, just edit + redeploy this script — nothing else changes.
 */

// >>> CHANGE THIS to where you want the alerts sent <<<
var NOTIFY_EMAIL = "annajtelfer@gmail.com";

function doPost(e) {
  try {
    var d = {};
    if (e && e.postData && e.postData.contents) {
      d = JSON.parse(e.postData.contents);
    }

    var title = d.title || "(no title)";
    var company = d.company ? (" @ " + d.company) : "";
    var subject = "New AURUM job listing: " + title + company;

    var rows = [
      ["Title",    d.title],
      ["Company",  d.company],
      ["Role",     d.role],
      ["Comp",     d.comp],
      ["Location", d.location],
      ["Tier",     d.tier],
      ["Link",     d.link],
      ["Contact",  (d.name ? d.name + " " : "") + "<" + (d.email || "") + ">"],
      ["Source",   d.source],
      ["Submitted", d.savedAt]
    ];

    var lines = ["A new role was submitted on AURUM /hiring:", ""];
    rows.forEach(function (r) {
      lines.push(r[0] + ": " + (r[1] || "—"));
    });
    if (d.details) {
      lines.push("", "Details:", d.details);
    }

    MailApp.sendEmail(NOTIFY_EMAIL, subject, lines.join("\n"));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
