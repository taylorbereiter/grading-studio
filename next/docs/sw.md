# The new app and the service worker

Decided in stage 0 (2026-11-17).

**Today.** The current app's service worker is `sw.js` at the site root, registered by src/safe.js with the root as its scope. Its
fetch handler answers only the pages it keeps (`''`, `index.html`, `planner.html`), the icons and install card, `lang/*.js`, and
`gs-drive/<id>` (Drive videos). Every other address, `next/` included, goes to the network as if the worker weren't there. Its
`tell()` messages (`gs-state`) reach every window at the address, `next/` pages too; the new app ignores them.

**Stage 0.** The new app registers no service worker. It is only a placeholder and the saved-work proof, both fetched from the
network. Nothing it does can touch the caches `gs-app-1`, `gs-next-1` or `gs-kept-1`, which hold the current app's pages (not
work).

**Later stages, while both versions live side by side.** `next/sw.js` registered with scope `/next/` (a narrower scope wins for
its own pages, so the root worker keeps answering the current app). Its caches are named `gsn-*` and it never opens, deletes or
renames a `gs-*` cache. It keeps a version whole the same way the root worker does (a version file with a hash per file, the
pages checked against it, written last) and holds an update back until the teacher says so, with the same Update now / update
by itself choice, stored apart from the current app's (`gsn-kept`).

**At the switch.** The root `sw.js` is replaced by the new app's worker at root scope, which takes over the root pages; the
`/next/` worker unregisters itself and deletes its `gsn-*` caches. The root worker's `gs-drive/<id>` streaming of Drive videos
must be in the new worker before that day. The old caches go only after the new version has been taken whole.

**Remote code.** Transcription loads `@huggingface/transformers` from cdn.jsdelivr.net at run time (src/app/readings.js). A new
worker must let that through (or the model loader moves into the app) and must not cache it as part of a version.
