# Agent Call Desk — deploying it

`index.html` is the whole app: one self-contained page, no build step, no server.
It is generated, so change the source and regenerate rather than editing it here.

It holds direct dials and email addresses for named people at estate agencies.
**Do not serve it without access control**, and do not fold it into the AURUM
project — the root `.vercelignore` keeps both `crm.html` and this folder out of
that deployment on purpose.

## One-time Vercel setup

1. vercel.com → **Add New… → Project** → import `annaaimodel/better-prompt-ai-main`.
2. Under **Root Directory**, click *Edit* and choose **`deploy`**. This matters:
   it keeps the AURUM `middleware.js` (which returns 503 for every path) out of
   this project, and limits the deployment to this folder.
3. Framework Preset: **Other**. No build command, no output directory.
4. **Deploy**. You get `https://<project-name>.vercel.app`.
5. **Immediately** open Project **Settings → Deployment Protection → Vercel
   Authentication**, set it to **All Deployments**, and save. Until this is on,
   anyone with the URL can read every contact.
6. Load the URL in a private window to confirm you get a Vercel login wall
   rather than the call desk.

After that, every push to the default branch redeploys automatically.

## Notes

- Statuses, comments and edits are stored per browser, per origin. They do not
  transfer between the local file, the claude.ai artifact and this URL — move
  them with **Export my notes** / **Import notes**.
- `robots.txt` and the `X-Robots-Tag` header in `vercel.json` ask crawlers to
  stay away. That is a request, not protection; step 5 is the protection.
