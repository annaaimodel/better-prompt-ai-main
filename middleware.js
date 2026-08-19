// AURUM taken OFFLINE on 2026-08-19.
//
// This Vercel Edge Middleware runs before every request and returns HTTP 503
// for ALL paths (pages and /api), so the deployed site serves nothing but the
// offline notice below — regardless of what static files or functions exist.
//
// TO BRING THE SITE BACK ONLINE: delete this file (or `git revert` the offline
// commit) and redeploy. See docs/REACTIVATE.md.

export const config = { matcher: "/:path*" };

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>AURUM — offline</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0a0a0b;color:#f3efe6;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       text-align:center;padding:24px;line-height:1.5}
  .wrap{max-width:440px}
  .wm{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:34px;
      letter-spacing:.2em;color:#d9b24c;margin:0 0 18px}
  h1{font-size:20px;font-weight:600;margin:0 0 10px}
  p{color:#9a948a;font-size:15px;margin:0}
</style></head>
<body><div class="wrap">
  <div class="wm">AURUM</div>
  <h1>We're temporarily offline</h1>
  <p>This site is paused right now. Please check back later.</p>
</div></body></html>`;

export default function middleware() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": "86400",
      "cache-control": "no-store, max-age=0",
    },
  });
}
