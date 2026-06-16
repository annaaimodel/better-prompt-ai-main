/**
 * Google Apps Script for the "High-Ticket Job Saver" Chrome extension.
 *
 * It receives a saved job from the extension and appends it as a row to your
 * Google Sheet. The sheet is then published as CSV and read by the jobs
 * pipeline (via the INBOX_CSV_URL repo variable), so saved jobs appear on the
 * board automatically.
 *
 * SETUP
 * 1. Create a Google Sheet. In row 1 add these headers (exact, lowercase):
 *      title | company | comp | location | link | source | notes
 * 2. In the sheet: Extensions -> Apps Script. Delete any code, paste this file.
 * 3. Deploy -> New deployment -> type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Authorise when prompted, then copy the Web app URL ending in /exec.
 * 4. Put that /exec URL into the extension (popup -> gear -> Options).
 * 5. Publish the sheet as CSV: File -> Share -> Publish to web -> (this sheet) ->
 *    CSV -> Publish, and copy the URL.
 * 6. In GitHub: repo Settings -> Secrets and variables -> Actions -> Variables ->
 *    New variable named INBOX_CSV_URL, value = that published CSV URL.
 */
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var j = JSON.parse(e.postData.contents);

    // --- Email signups from the AURUM landing page -> "Subscribers" tab ----
    if (j.type === 'subscribe') {
      var subs = ss.getSheetByName('Subscribers') || ss.insertSheet('Subscribers');
      if (subs.getLastRow() === 0) {
        subs.appendRow(['email', 'savedAt', 'source']);
      }
      subs.appendRow([j.email || '', j.savedAt || new Date().toISOString(), j.source || '']);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- Saved jobs (extension / Quick Add) -> first sheet -----------------
    var sheet = ss.getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['title', 'company', 'comp', 'location', 'link', 'source', 'notes', 'savedAt']);
    }
    sheet.appendRow([
      j.title || '', j.company || '', j.comp || '', j.location || '',
      j.link || '', j.source || '', j.notes || '', j.savedAt || new Date().toISOString()
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('Job Saver endpoint is live.');
}
