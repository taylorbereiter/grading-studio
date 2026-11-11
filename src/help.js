/* ---------------- Help: short answers on a page of their own (#/help), and in Find anything ---------------- */
// The answers are in helpdata.js, which the Planner builds in too. Nothing here is saved: which answers are open lasts for the visit.
const helpOpen = new Set();
let helpWas = null, helpQ = '';
// **word** is bold; everything else is plain text.
const helpText = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function helpBody(t) {
  let h = '', steps = [];
  const flush = () => { if (steps.length) { h += '<ol>' + steps.map(s => '<li>' + helpText(s) + '</li>').join('') + '</ol>'; steps = []; } };
  for (const p of t.a) { const m = /^\d+\.\s+(.*)$/.exec(p); if (m) steps.push(m[1]); else { flush(); h += '<p>' + helpText(p) + '</p>'; } }
  flush();
  if (t.where === 'p') h += '<p class="hlpgo"><a class="btn sm" href="' + esc($('#lessonsBtn').getAttribute('href')) + '">Open the Planner</a></p>';
  else if (t.go) h += '<p class="hlpgo"><a class="btn sm" href="' + t.go[1] + '">' + esc(t.go[0]) + '</a></p>';
  return h;
}
const helpItem = t => { const on = helpOpen.has(t.id); return '<div class="hlpq' + (on ? ' on' : '') + '" id="hlp-' + t.id + '"><h3><button class="hlph" data-hlp="' + t.id + '" aria-expanded="' + on + '" aria-controls="hlpa-' + t.id + '"><span>' + esc(t.q) + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></h3>' +
  '<div class="hlpa" id="hlpa-' + t.id + '"' + (on ? '' : ' hidden') + '>' + (on ? helpBody(t) : '') + '</div></div>'; };
// Every word typed has to be in the question, the answer or its other words.
function helpHits(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return HELP.filter(t => { const all = (t.q + ' ' + t.a.join(' ') + ' ' + (t.words || '')).toLowerCase(); return words.every(w => all.includes(w)); });
}
function helpRender() {
  if (!shellReady) return;
  const r = routeNow(); if (r.v !== 'help' || batch) { helpWas = null; return; }
  // Arriving at one answer's address opens it and brings it into view, once.
  const came = r.topic || '', fresh = helpWas !== came;
  if (fresh && came) { helpOpen.add(came); if (helpQ) { helpQ = ''; $('#hlpIn').value = ''; } }
  helpWas = came;
  const q = helpQ.trim();
  let h;
  if (q) { const hits = helpHits(q); h = hits.length ? '<section class="hlpsec"><h2>' + hits.length + (hits.length === 1 ? ' answer' : ' answers') + '</h2><div class="hlpcard">' + hits.map(helpItem).join('') + '</div></section>' : '<p class="muted hlpnone">No answer matches “' + esc(q) + '”. Try one word, like “roster” or “export”.</p>'; }
  else h = HELP_SECS.map(([k, name]) => '<section class="hlpsec"><h2>' + esc(name) + '</h2><div class="hlpcard">' + HELP.filter(t => t.sec === k).map(helpItem).join('') + '</div></section>').join('');
  const box = $('#hlpList'); if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
  if (fresh && came) { const el = document.getElementById('hlp-' + came); if (el) { el.scrollIntoView({ block: 'center' }); el.querySelector('.hlph').focus({ preventScroll: true }); } }
}
$('#hlpList').addEventListener('click', e => {
  const b = e.target.closest('[data-hlp]'); if (!b) return;
  const id = b.dataset.hlp; if (helpOpen.has(id)) helpOpen.delete(id); else helpOpen.add(id);
  helpRender();
  const again = document.querySelector('[data-hlp="' + id + '"]'); if (again) again.focus({ preventScroll: true });
});
$('#hlpIn').addEventListener('input', e => { helpQ = e.target.value; helpRender(); });
$('#hlpIn').addEventListener('keydown', e => { if (e.key === 'Escape' && helpQ) { e.preventDefault(); e.target.value = ''; helpQ = ''; helpRender(); } });
// Find anything lists every answer by its question.
const helpFindRows = () => HELP.map(t => ({ group: 'Help', label: t.q, sub: helpGist(t), key: '', words: t.words || '', run: () => go('#/help/' + t.id) }));
Object.assign(window.__gs, { routeOf, helpTopics: () => HELP.map(t => ({ id: t.id, sec: t.sec, q: t.q, a: t.a, go: t.go || null, where: t.where || '' })) });
