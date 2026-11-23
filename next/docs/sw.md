# The new app and the service worker

Decided in stage 0 (2026-11-17).

**Today.** The current app's service worker is `sw.js` at the site root, registered by src/safe.js with the root as its scope. Its
fetch handler answers only the pages it keeps (`''`, `index.html`, `planner.html`), the icons and install card, `lang/*.js`, and
`gs-drive/<id>` (Drive videos). Every other address, `next/` included, goes to the network as if the worker weren't there. Its
`tell()` messages (`gs-state`) reach every window at the address, `next/` pages too; the new app ignores them.

**Stage 0.** The new app registers no service worker. It is only a placeholder and the saved-work proof, both fetched from the
network. Nothing it does can touch the caches `gs-app-1`, `gs-next-1` or `gs-kept-1`, which hold the current app's pages (not
work).

**Stage 2 (built).** next/sw.js is registered by the shell (next/src/app/update.js) with the scope next/. It answers only
next/index.html and next/dist/*; the gallery and the proof page always come from the web. Each open asks it for a check, and a
newer version waits in `gsn-next-1` until Update now (the sidebar's foot, Settings > About, or More on a phone), or until the app
is next opened if the teacher chose to update by itself. next/version.json is made by next/build.js. next/test/browser/shell.test.js
checks that the current app's worker keeps its scope and its `gs-*` caches untouched beside it, and the whole update on a phone.

**Check for an update (fixed 23 Nov 2026).** A version is fetched six files at a time, each tried three times, and each file is
kept in the staging cache as soon as it is checked (a `building` mark names the build), so a check the browser stopped part way
goes on from there; a file the version in use already has with the same SHA-256 is copied from it. The worker tells the page how
far it has got (`progress`) and how every check ended (`checked`: `ok`, `offline` for no connection, `site` for a version that
didn't arrive whole). Before, the whole version was fetched one file at a time and nothing was said until the last one: at 633
files that was a minute or more of silence on a slow network, and one failed file threw everything away. The page
(app/update.js) says Checking… at once, asks the browser for the newest sw.js (`registration.update()`), and, because a worker
kept from an older version answers only when its whole download is done, looks at the site's version.json itself after 10 s; it
gives up with a plain reason after 6 minutes, or after a minute without progress. next/test/browser/update-check.test.js. Since
the switch the root worker (next/src/sw.js) does the same; a page of the previous version still open at the root hears `offline`
for a version that didn't arrive whole, the one failure it knows.

**While both versions live side by side.** `next/sw.js` registered with scope `/next/` (a narrower scope wins for
its own pages, so the root worker keeps answering the current app). Its caches are named `gsn-*` and it never opens, deletes or
renames a `gs-*` cache. It keeps a version whole the same way the root worker does (a version file with a hash per file, the
pages checked against it, written last) and holds an update back until the teacher says so, with the same Update now / update
by itself choice, stored apart from the current app's (`gsn-kept`).

**At the switch (built, version 2.0.0).** `next/build.js` writes the new app at the root and copies `next/src/sw.js` to the root
`sw.js`; `build.js` writes the previous version to `classic/`. Cache names belong to the whole site, so each worker has its own:

- The root worker (`next/src/sw.js`) uses `gs-app-2`, `gs-next-2` and `gs-kept-2`, and streams `gs-drive/<id>` (also from
  `classic/gs-drive/<id>`, asking a window of its own area for the token first). It never answers `classic/` or `next/`.
- While `gs-app-1` holds a whole version, the root worker goes on serving the previous version's pages from it and answering their
  messages (`gs-state`, `gs-check`, `gs-apply`, `gs-mode`), so a page left open sees **Update ready** as on any other day. The new
  app is fetched whole into `gs-next-2`. **Update now** (or update by itself, on the next open) makes it `gs-app-2`; only then are
  `gs-app-1`, `gs-next-1` and `gs-kept-1` deleted, and her choice in `gs-kept-1` is carried into `gs-kept-2`.
- `classic/sw.js` (the previous version's `src/sw.js`) uses `gsc-*` caches and talks only to windows under `classic/`. `classic/`
  has no install card: the installed app (start_url and scope `./`) is the new version.
- `next/sw.js` now retires: it deletes the `gsn-*` caches, sends its windows to the root (same search and hash), and unregisters.
  `next/index.html` does the same for a page opened without it.
- Google's sign-in returns only to the root. The previous version leaves `gs.gBack` = `classic:<state>` in the tab's sessionStorage
  before it goes; the root page sees it with the token and the same state in the address and sends the address on to `classic/`
  before anything else runs. Until Update now the root still shows the previous version's page (from `gs-app-1`), which takes the
  key itself: the teacher is signed in there, at the root, and not sent on to `classic/`.

`test/tools/rehearsal.js` (CI's rehearsal job) carries work made on the version before through all of this in a real Chrome.

**Remote code.** Transcription loads `@huggingface/transformers` from cdn.jsdelivr.net at run time (src/app/readings.js). A new
worker must let that through (or the model loader moves into the app) and must not cache it as part of a version.
