/* ---------------- the side pane (11/13): two things side by side on the marking screen ----------------
   The paper area can show a second column: a video beside the notes page, the rubric's words beside an essay, one file beside another.
   The pane lives inside #paper (held in place while the papers scroll), so everything that listens on the paper works in it too.
   Each of a student's files is tagged as it is drawn (spTake); the one the pane is showing is moved into the pane, and moved back
   when another is picked, without being drawn again, so a video keeps playing. Tabs that are not a file (the rubric) are in SP_TOOLS.
   gs.sp, in this browser: { on: she opened it, so it stays for every student; noVid: she closed it on a video, so a video doesn't open it;
   tab: the kind of thing it last showed; at: 'right' | 'left' | 'top'; w, h: its share of the width or height }. */
const SP_TOOLS = [];
const SP_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/></svg>';
const SP_SIDE_MIN = 260, SP_MAIN_MIN = 300, SP_TOP_MIN = 150;
let spNow = { st: null, tabs: [], key: '', shown: false, seq: 0 };
const spConf = () => { const c = store.get('gs.sp', null); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; };
function spConfSet(o) {
  const c = { ...spConf(), ...o };
  for (const k of Object.keys(c)) if (c[k] == null || c[k] === false) delete c[k];
  if (Object.keys(c).length) store.set('gs.sp', c); else store.del('gs.sp');
}
const spDocKey = d => 'doc:' + (d.file || d.name);
// The pane's scrolling part when this page is in it, else null.
const spBodyOf = pg => (pg && pg.wrap && pg.wrap.closest('.spb')) || null;

// What can go in the pane for this student. A file is only offered when something else is left for the main column.
function spTabs(st) {
  const out = [], seq = fileSeq(st), vids = st.files.filter(f => f.kind === 'link' || f.kind === 'media');
  if (vids.length + seq.length > 1) {
    for (const f of vids) out.push({ key: 'file:' + f.path, kind: 'video', label: f.kind === 'link' ? linkTitle(f) : f.name });
    for (const it of seq) {
      if (it.f) { out.push({ key: 'file:' + it.f.path, kind: 'f:' + it.f.name, label: it.f.name }); continue; }
      const f = it.d.file && fileByPath(st, it.d.file);
      out.push({ key: spDocKey(it.d), kind: f && !f.virtual && isNotes(f.data) ? 'notes' : 'f:' + it.d.name, label: it.d.name });
    }
  }
  for (const t of SP_TOOLS) if (t.ok(st)) out.push({ key: t.key, kind: t.key, label: t.label, tool: t });
  return out;
}
const spHasVideo = tabs => tabs.some(t => t.kind === 'video') && tabs.some(t => t.kind !== 'video' && !t.tool);
function spWanted(tabs) {
  const c = spConf();
  if (!tabs.length) return false;
  return !!c.on || (!c.noVid && spHasVideo(tabs));
}
function spChoose(tabs) {
  const c = spConf();
  return tabs.find(t => t.kind === c.tab) || tabs.find(t => t.kind === 'video') || tabs.find(t => t.tool) || tabs[0];
}

// Called as a student's paper starts to be drawn: the button in the student's bar, and the pane if it is wanted.
function spReset(st) {
  spNow = { st, tabs: spTabs(st), key: '', shown: false, seq: 0 };
  const rb = $('#paper #readBtn');
  if (rb && spNow.tabs.length) rb.insertAdjacentHTML('beforebegin', '<button class="btn sm spbtn" id="spBtn" aria-pressed="false" title="Side by side: keep a video, the rubric or another file beside the paper ( B )">' + SP_ICON + '<span>Side by side</span></button>');
  if (spWanted(spNow.tabs)) { spNow.shown = true; spNow.key = spChoose(spNow.tabs).key; spBuild(); spPaint(); }
  spLay();
}
function spBuild() {
  if ($('#pane2')) return;
  $('#paper').insertAdjacentHTML('afterbegin', '<div class="spanchor" id="spAnchor"><aside class="sp2" id="pane2" aria-label="Side pane">' +
    '<div class="spgrip" id="spGrip" role="separator" tabindex="0" aria-label="Side pane size" title="Drag to make the side pane bigger or smaller. Double-click for the usual size."><i></i></div>' +
    '<div class="sph"><div class="sptabs" id="spTabs" role="tablist" aria-label="Shown beside the paper"></div>' +
    kmWrap('⋯', 'class="icon kdots" id="spMore" aria-label="Where the side pane sits" title="Where the side pane sits"',
      '<button class="mitem" data-spat="right">On the right</button><button class="mitem" data-spat="left">On the left</button><button class="mitem" data-spat="top">Across the top</button>', 'right') +
    '<button class="icon" data-spclose aria-label="Close the side pane" title="Close the side pane ( B )">✕</button></div>' +
    '<div class="spb" id="spBody"></div></aside></div>');
  spGripWire($('#spGrip'));
}
// The tabs, and the words of a tab that is not a file.
function spPaint() {
  const tabs = $('#spTabs'), body = $('#spBody'); if (!tabs) return;
  tabs.innerHTML = spNow.tabs.map(t => '<button class="sptab" role="tab" aria-selected="' + (t.key === spNow.key) + '" data-sptab="' + esc(t.key) + '"' + (t.tool ? '' : ' data-raw') + '>' + esc(t.tool ? t.label : fileShown(spNow.st, t.label).replace(/\.(pdf|docx?|docm|txt|rtf|jpe?g|png|heic|mp4|mov|m4a|mp3|webm)$/i, '')) + '</button>').join('');
  const t = spNow.tabs.find(x => x.key === spNow.key);
  let host = body.querySelector(':scope > .sptool');
  if (t && t.tool) {
    if (!host) { host = document.createElement('div'); host.className = 'sptool'; body.appendChild(host); }
    if (host.dataset.tool !== t.key) { host.dataset.tool = t.key; host.innerHTML = ''; }
    t.tool.draw(host, spNow.st);
  } else if (host) host.remove();
  const b = $('#spBtn'); if (b) b.setAttribute('aria-pressed', String(spNow.shown));
}
// A node moved without being taken off the page where the browser can do that, so a video in it keeps playing.
function spMove(host, n, ref) {
  if (host.moveBefore) { try { host.moveBefore(n, ref || null); return; } catch { } }
  host.insertBefore(n, ref || null);
}
function spHome(n) {
  const paper = $('#paper'), o = +n.dataset.spo; let ref = null;
  for (const c of paper.children) if ((c.dataset.spo && +c.dataset.spo > o) || c.classList.contains('gonelist')) { ref = c; break; }
  spMove(paper, n, ref);
}
// Each part of a file as it is drawn: its bar, its card, each of its pages.
function spTake(key, ...nodes) {
  const can = spNow.tabs.some(t => t.key === key), body = spNow.shown && key === spNow.key ? $('#spBody') : null;
  for (const n of nodes) {
    if (!n) continue;
    n.dataset.spk = key; n.dataset.spo = ++spNow.seq;
    const menu = can && (n.classList.contains('fhead') ? n : n.querySelector(':scope > .fhead')), km = menu && menu.querySelector('.km');
    if (km && !km.querySelector('[data-spshow]')) (km.firstElementChild || km).insertAdjacentHTML(km.firstElementChild ? 'afterend' : 'afterbegin', '<button class="link" data-spshow="' + esc(key) + '" title="Keeps this in a pane of its own beside the rest of the paper">Show beside</button>');
    if (body) body.appendChild(n);
  }
}
function spDone() { if (spNow.shown) spPaint(); }
// A card swapped for another once it is ready (a kept video, while it is read from the browser) keeps its place in all this.
new MutationObserver(recs => {
  for (const r of recs) {
    if (r.removedNodes.length !== 1 || r.addedNodes.length !== 1) continue;
    const was = r.removedNodes[0], now = r.addedNodes[0];
    if (was.dataset && was.dataset.spk && !was.isConnected && now.dataset && !now.dataset.spk) { now.dataset.spk = was.dataset.spk; now.dataset.spo = was.dataset.spo; }
  }
}).observe($('#paper'), { childList: true, subtree: true });
// Shows one tab. keep false: it isn't remembered as her choice.
function spPick(key, keep) {
  const body = $('#spBody'), paper = $('#paper'), t = spNow.tabs.find(x => x.key === key); if (!body || !t) return;
  commitEditors();
  for (const n of [...body.children]) if (n.dataset.spk && n.dataset.spk !== key) spHome(n);
  spNow.key = key;
  if (!t.tool) for (const n of [...paper.children]) if (n.dataset.spk === key) spMove(body, n, null);
  if (keep !== false) spConfSet({ tab: t.kind });
  body.scrollTop = 0;
  spPaint(); spSized();
}
function spOpen(key) {
  if (!batch || !spNow.st) return;
  if (!spNow.tabs.length) return toast('There is nothing to show beside this paper yet. Add a video, a notes page or a rubric first.');
  spConfSet({ on: true, noVid: null });
  spNow.shown = true; spBuild();
  spPick(key && spNow.tabs.some(t => t.key === key) ? key : (spNow.tabs.find(t => t.key === spNow.key) || spChoose(spNow.tabs)).key, !!key);
  spLay();
}
function spClose() {
  const body = $('#spBody'); if (!body) return;
  commitEditors();
  for (const n of [...body.children]) if (n.dataset.spk) spHome(n);
  $('#spAnchor').remove();
  spNow.shown = false;
  spConfSet({ on: null, noVid: spHasVideo(spNow.tabs) ? true : spConf().noVid });
  const b = $('#spBtn'); if (b) b.setAttribute('aria-pressed', 'false');
  spLay(); spSized();
}
const spToggle = () => (spNow.shown ? spClose() : spOpen());

/* ---------- where it sits and how big it is ---------- */
// The pages are drawn again at their new width a moment after the pane moves or changes size.
function spSized() { clearTimeout(resizeT); resizeT = setTimeout(() => { pages.forEach(renderPage); if (typeof vidHApply === 'function') vidHApply(store.get('gs.vidH', 0)); }, 60); }
let spAtNow = '';
function spLay() {
  const paper = $('#paper'), main = paper.parentNode, on = spNow.shown && !!$('#pane2'), c = spConf();
  const uz = parseFloat(getComputedStyle(paper).getPropertyValue('--uz')) || 1, padL = 24 + 44 * uz, W = paper.clientWidth, H = paper.clientHeight;
  let at = on ? (c.at === 'left' || c.at === 'top' ? c.at : 'right') : '';
  if (at && at !== 'top' && W - padL - 16 < SP_SIDE_MIN + SP_MAIN_MIN) at = 'top';   // a narrow window: one above the other
  let px = 0;
  if (at === 'top') px = Math.round(clamp((c.h || 0.44) * H, SP_TOP_MIN, Math.max(SP_TOP_MIN, H - 180)));
  else if (at) px = Math.round(clamp((c.w || 0.46) * (W - padL), SP_SIDE_MIN, W - padL - 16 - SP_MAIN_MIN));
  for (const k of ['right', 'left', 'top']) main.classList.toggle('sp-' + k, at === k);
  main.classList.toggle('sp-on', !!at);
  if (at) { main.style.setProperty('--sp-px', px + 'px'); main.style.setProperty('--sp-h', H + 'px'); main.style.setProperty('--sp-w', W + 'px'); }
  else for (const k of ['--sp-px', '--sp-h', '--sp-w']) main.style.removeProperty(k);
  const g = $('#spGrip'); if (g) g.setAttribute('aria-orientation', at === 'top' ? 'horizontal' : 'vertical');
  for (const b of document.querySelectorAll('#pane2 [data-spat]')) b.setAttribute('aria-checked', String(b.dataset.spat === at));
  if (at !== spAtNow) { spAtNow = at; spSized(); }
}
new ResizeObserver(() => { if (batch && spNow.shown) { spLay(); spSized(); } }).observe($('#paper'));
function spGripWire(g) {
  const size = (x, y, keep) => {
    const paper = $('#paper'), r = paper.getBoundingClientRect(), uz = parseFloat(getComputedStyle(paper).getPropertyValue('--uz')) || 1, padL = 24 + 44 * uz;
    if (spAtNow === 'top') spConfSet({ h: clamp((y - r.top) / Math.max(1, paper.clientHeight), 0.15, 0.85) });
    else { const px = spAtNow === 'left' ? x - r.left : r.left + paper.clientWidth - x; spConfSet({ w: clamp(px / Math.max(1, paper.clientWidth - padL), 0.15, 0.85) }); }
    spLay(); if (keep) spSized();
  };
  let tapped = 0;
  g.onpointerdown = e => {
    e.preventDefault();
    if (Date.now() - tapped < 400) { tapped = 0; spConfSet({ w: null, h: null }); spLay(); spSized(); return; }   // a double click: the usual size
    g.setPointerCapture(e.pointerId); g.classList.add('on');
    const x0 = e.clientX, y0 = e.clientY, sh = document.createElement('div'); sh.className = 'vgripshield'; sh.style.cursor = spAtNow === 'top' ? 'row-resize' : 'col-resize'; document.body.appendChild(sh);   // a site's player would catch the pointer
    g.onpointermove = ev => size(ev.clientX, ev.clientY);
    g.onpointerup = g.onpointercancel = ev => { g.onpointermove = g.onpointerup = g.onpointercancel = null; g.classList.remove('on'); sh.remove(); if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) tapped = Date.now(); else size(ev.clientX, ev.clientY, true); };
  };
  g.onkeydown = e => {
    const top = spAtNow === 'top', d = (top ? { ArrowDown: 1, ArrowUp: -1 } : spAtNow === 'left' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowLeft: 1, ArrowRight: -1 })[e.key]; if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const c = spConf(); spConfSet(top ? { h: clamp((c.h || 0.44) + d * 0.04, 0.15, 0.85) } : { w: clamp((c.w || 0.46) + d * 0.04, 0.15, 0.85) }); spLay(); spSized();
  };
}

$('#paper').addEventListener('click', e => {
  if (e.target.closest('#spBtn')) return spToggle();
  if (e.target.closest('[data-spclose]')) return spClose();
  const tab = e.target.closest('[data-sptab]'); if (tab) return spPick(tab.dataset.sptab);
  const sh = e.target.closest('[data-spshow]'); if (sh) { kmClose(); return spOpen(sh.dataset.spshow); }
  const at = e.target.closest('[data-spat]'); if (at) { kmClose(); spConfSet({ at: at.dataset.spat === 'right' ? null : at.dataset.spat }); spLay(); spSized(); return; }
  const lv = e.target.closest('[data-sprow]');
  if (lv) {   // a box of the rubric: that score for that row, as in the score panel
    const st = batch.students[cur], i = +lv.dataset.sprow, v = +lv.dataset.spv;
    gradeSnap(st);
    st.grade.rubric[i] = st.grade.rubric[i] === v ? null : v;
    scoreTouched(st, i); rowOn = lvAt = i; rowKeyed = -1;
    renderGrade(); renderList(); saveSoon(); return;
  }
  if (e.target.closest('[data-spedit]')) return openSetup();
});

/* ---------- the rubric, in full: every row with what each score means, and a click gives the score ---------- */
function spRubricDraw(host, st) {
  const g = st.grade.rubric, any = setup.criteria.some((_, i) => rowHasLevels(i));
  host.innerHTML = '<div class="sprub">' + (any ? '' : '<p class="muted sprubnone">Nothing is written yet for what each score means. <button class="link" data-spedit>Edit rubric</button></p>') +
    setup.criteria.map((c, i) => { const v = g[i], near = v == null ? [] : [Math.ceil(v), Math.floor(v)];
      return '<section class="sprow"><h4><span data-raw>' + esc(c) + '</span><em>' + critScore(v, i) + '</em></h4><div class="splv' + (rowHasLevels(i) ? '' : ' bare') + '">' +
        rowLevels(setup, i).filter(w => w > 0 || levelOf(i, w)).map(w => '<button class="splvb' + (near.includes(w) ? (v % 1 ? ' on half' : ' on') : '') + '" data-sprow="' + i + '" data-spv="' + w + '" aria-pressed="' + (v === w) + '"><b>' + w + '</b>' + (levelOf(i, w) ? '<span data-raw>' + esc(levelOf(i, w)) + '</span>' : '') + '</button>').join('') + '</div></section>'; }).join('') + '</div>';
}
SP_TOOLS.push({ key: 'rubric', label: 'Rubric', ok: () => setup.mode === 'rubric' && setup.criteria.length > 0, draw: spRubricDraw });
// The score panel changed (a score, a slider, another student's rubric): the pane's copy follows.
{
  let t = 0;
  new MutationObserver(() => { if (t || !spNow.shown || !batch) return; t = setTimeout(() => { t = 0; const tab = spNow.shown && spNow.tabs.find(x => x.key === spNow.key), host = $('#spBody > .sptool'); if (tab && tab.tool && host && batch) tab.tool.draw(host, batch.students[cur]); }, 40); })
    .observe($('#grade'), { childList: true, subtree: true });
}
Object.assign(window.__gs, { spOpen, spClose, spPick, spConf, spState: () => ({ shown: spNow.shown, key: spNow.key, at: spAtNow, tabs: spNow.tabs.map(t => ({ key: t.key, kind: t.kind, label: t.label })) }) });
