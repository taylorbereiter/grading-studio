/* ---------------- calculator: a small floating calculator with grade helpers; it opens from the top bar or the = key ---------------- */
// Reads + − × ÷ ^ ( ) and %, plus sum(), avg(), min(), max(), round(), sqrt(). No eval: a small parser.
function calcEval(src) {
  const s = String(src).replace(/[×xX*]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/,(?=\d{3}\b)/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i], eat = c => { if (s[i] === c) { i++; return true; } return false; };
  const FN = { sum: a => a.reduce((x, y) => x + y, 0), avg: a => a.reduce((x, y) => x + y, 0) / a.length, min: a => Math.min(...a), max: a => Math.max(...a), round: a => a.length > 1 ? Math.round(a[0] * 10 ** a[1]) / 10 ** a[1] : Math.round(a[0]), sqrt: a => Math.sqrt(a[0]) };
  function atom() {
    if (eat('(')) { const v = add(); if (!eat(')')) throw 0; return v; }
    if (eat('-')) return -power();
    if (eat('+')) return power();
    const m = /^[a-z]+/i.exec(s.slice(i));
    if (m) {
      const f = FN[m[0].toLowerCase()]; if (!f) throw 0; i += m[0].length;
      if (!eat('(')) throw 0; const args = [add()]; while (eat(',') || eat(';')) args.push(add()); if (!eat(')')) throw 0;
      return f(args);
    }
    const n = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!n) throw 0; i += n[0].length;
    return +n[0];
  }
  function post() { let v = atom(); while (eat('%')) v /= 100; return v; }
  function power() { const v = post(); return eat('^') ? v ** power() : v; }
  function mul() { let v = power(); for (;;) { if (eat('*')) v *= power(); else if (eat('/')) v /= power(); else if (peek() === '(') v *= power(); else return v; } }
  function add() { let v = mul(); for (;;) { if (eat('+')) v += mul(); else if (eat('-')) v -= mul(); else return v; } }
  if (!s) return null;
  const v = add(); if (i < s.length || !isFinite(v)) throw 0;
  return v;
}
const calcFmt = v => v == null ? '' : String(+(+v).toFixed(4));
// What a key press means in the calculator: '=' for the answer, '+' for the =/+ key without Shift, the character to
// type for other calculator keys, 'Escape', or null to let the key do its usual thing.
function calcKeyOf(e) {
  if (e.key === 'Enter' || e.code === 'NumpadEnter' || e.code === 'NumpadEqual') return '=';
  if (e.key === 'Escape') return 'Escape';
  if (e.code === 'Equal' || e.key === '=') return e.shiftKey ? '=' : '+';
  if (e.key.length === 1 && /[\d.+\-*/()^%x×÷]/.test(e.key)) return e.key;
  return null;
}
function openCalc() {
  const old = $('#calcPanel'); if (old) { old.remove(); return; }
  const p = document.createElement('div'); p.id = 'calcPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Calculator'); document.body.appendChild(p);
  const pos = store.get('gs.calcpos', null); if (pos) { p.style.left = pos.x + 'px'; p.style.top = pos.y + 'px'; p.style.right = 'auto'; }
  let hist = store.get('gs.calchist', []), last = null;
  const max = maxPoints();
  const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
  p.innerHTML = '<div class="cph"><b>Calculator</b><span style="flex:1"></span><button class="icon" data-cx aria-label="Close">✕</button></div>' +
    '<input id="calcIn" autocomplete="off" spellcheck="false" placeholder="Type or tap, e.g. 3.5+4+3" aria-label="Calculation">' +
    '<div id="calcOut" aria-live="polite"></div><div id="calcStick" class="muted"></div>' +
    '<div class="cpk">' + keys.map(k => '<button data-ck="' + k + '"' + (k === '=' ? ' class="eq"' : /[÷×−+]/.test(k) ? ' class="op"' : '') + '>' + k + '</button>').join('') + '</div>' +
    '<div class="cpsec"><div class="dl">Score to percent</div>' +
      '<div class="cprow"><input id="calcPts" type="number" step="0.5" min="0" placeholder="Score"><span>out of</span><input id="calcMax" type="number" step="0.5" min="0" value="' + (max || '') + '"></div>' +
      '<div id="calcPct" class="muted"></div></div>' +
    '<div class="cpsec"><div class="dl">Average</div><input id="calcAvg" placeholder="Numbers with spaces, e.g. 4 3.5 3" autocomplete="off"><div id="calcAvgOut" class="muted"></div></div>' +
    '<div class="cpsec"><div class="dl">History</div><div id="calcHist"></div></div>';
  const inp = $('#calcIn'), out = $('#calcOut');
  const show = () => {
    let v = null, bad = false; try { v = calcEval(inp.value); } catch { bad = !!inp.value.trim(); }
    last = v;
    out.innerHTML = bad ? '<span class="muted">…</span>' : v == null ? '<span class="muted">0</span>' : '= <b>' + calcFmt(v) + '</b>' +
      ($('#ptsIn') ? ' <button class="link" data-cuse title="Put this number in the open student’s score box">Use as score</button>' : '') +
      (pages.length ? ' <button class="link" data-cstick title="' + ($('#ptsIn') ? 'Use it as the score, then click' : 'Click') + ' where it goes on the paper">Score sticker</button>' : '');
    const lab = v == null ? null : stickerText(v);
    $('#calcStick').textContent = lab && pages.length ? 'Sticker: ' + lab.replace('/', ' / ').replace(' = ', ' · ') : '';
  };
  const drawHist = () => { $('#calcHist').innerHTML = hist.length ? hist.map((h, k) => '<button class="cphi" data-ch="' + k + '"><span>' + esc(h.e) + '</span><b>' + esc(h.v) + '</b></button>').join('') + '<button class="link" data-chclear style="font-size:12px">Clear history</button>' : '<span class="muted" style="font-size:12px">Your answers show here. Click one to use it again.</span>'; };
  const done = () => {
    if (last == null) return;
    const e = inp.value.trim(), v = calcFmt(last);
    if (e !== v) { hist.unshift({ e, v }); hist = hist.slice(0, 12); store.set('gs.calchist', hist); drawHist(); }
    inp.value = v; show(); inp.select();
  };
  const pct = () => {
    const t = $('#calcPts').value, m = +$('#calcMax').value;
    if (t === '' || !m) { $('#calcPct').textContent = 'Type a score to see its percent.'; return; }
    const straight = +t / m * 100, onScale = m === max ? percentFor(+t) : null;
    $('#calcPct').innerHTML = onScale != null ? '<b>' + onScale + '%</b> on your grading scale · ' + calcFmt(straight) + '% straight' : '<b>' + roundPct(straight) + '%</b> (' + calcFmt(straight) + '%)';
  };
  const avg = () => {
    const ns = ($('#calcAvg').value.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    $('#calcAvgOut').innerHTML = ns.length ? 'Average <b>' + calcFmt(ns.reduce((a, b) => a + b, 0) / ns.length) + '</b> · Total ' + calcFmt(ns.reduce((a, b) => a + b, 0)) + ' · ' + ns.length + (ns.length === 1 ? ' number' : ' numbers') : '';
  };
  inp.oninput = show;
  // Keys: the =/+ key on its own adds (it's the one she reaches for most); Shift with it, or Enter, gives the answer.
  // Right after an answer, + − × ÷ carry on from it; a number starts over.
  inp.onkeydown = e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = calcKeyOf(e);
    if (k === '=') { e.preventDefault(); done(); }
    else if (k === 'Escape') { e.preventDefault(); p.remove(); }
    else if (k) { e.preventDefault(); typeIn(k); }
  };
  const typeIn = c => {
    const all = inp.value && inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
    if (all && /^[+\-*/^%)]$/.test(c)) inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.setRangeText(c, inp.selectionStart, inp.selectionEnd, 'end'); show();
  };
  p.typeIn = c => { inp.focus(); if (c === '=') return done(); if (document.activeElement !== inp || inp.selectionStart == null) inp.setSelectionRange(inp.value.length, inp.value.length); typeIn(c); };
  p.oninput = e => { if (e.target.id === 'calcPts' || e.target.id === 'calcMax') pct(); if (e.target.id === 'calcAvg') avg(); };
  p.onclick = e => {
    if (e.target.closest('[data-cx]')) return p.remove();
    const k = e.target.closest('[data-ck]');
    if (k) {
      const c = k.dataset.ck;
      if (c === 'C') inp.value = '';
      else if (c === '⌫') inp.value = inp.value.slice(0, -1);
      else if (c === '=') return done();
      else inp.value += c;
      show(); inp.focus(); return;
    }
    const useIt = () => { const box = $('#ptsIn'); if (!box) return false; box.value = calcFmt(last); box.dispatchEvent(new Event('input', { bubbles: true })); box.dispatchEvent(new Event('change', { bubbles: true })); return true; };
    if (e.target.closest('[data-cuse]')) {
      if (last == null || !useIt()) return;
      return toast('Score set to ' + calcFmt(last));
    }
    if (e.target.closest('[data-cstick]')) {
      if (last == null) return;
      done();
      useIt(); return startScorePlace(stickerText(last));
    }
    const h = e.target.closest('[data-ch]'); if (h) { inp.value = hist[+h.dataset.ch].v; show(); inp.focus(); return; }
    if (e.target.closest('[data-chclear]')) { hist = []; store.set('gs.calchist', hist); drawHist(); }
  };
  // Drag the title bar to move it out of the way; it stays there next time.
  p.querySelector('.cph').onpointerdown = e => {
    if (e.target.closest('button')) return;
    const r = p.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { p.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)) + 'px'; p.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; p.style.right = 'auto'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); store.set('gs.calcpos', { x: parseInt(p.style.left), y: parseInt(p.style.top) }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  show(); pct(); drawHist(); inp.focus();
}

// The words on a score sticker: "12.5/15 = 83%" with the percent from her grading scale, or just the number with no total set.
function stickerText(v) {
  const max = maxPoints(), pct = max ? percentFor(v) : null;
  return calcFmt(v) + (max ? '/' + calcFmt(max) : '') + (pct != null ? ' = ' + pct + '%' : '');
}
// Placing a score sticker: it follows the pointer over the paper until she clicks; Esc or a click off the paper lets go.
let scorePlacing = null;
function startScorePlace(text) {
  stopScorePlace();
  const gh = document.createElement('canvas'); gh.id = 'scoreGhost'; gh.hidden = true;
  const bar = document.createElement('div'); bar.className = 'toast'; bar.id = 'scoreBar'; bar.textContent = 'Click where the score goes · Esc to cancel';
  document.body.append(gh, bar);
  const panel = $('#calcPanel'); if (panel) panel.classList.add('placing');
  const move = e => {
    const pg = pages.find(q => q.canvas === e.target);
    if (!pg) { gh.hidden = true; return; }
    const m = { t: 'stamp', k: 'score', x: 0, y: 0, size: newStampSize('score'), color: totalInk(), text }, b = stampBox(m), dpr = window.devicePixelRatio || 1, k = pg.s;
    gh.width = Math.ceil(b.w * k * dpr) + 2; gh.height = Math.ceil(b.h * k * dpr) + 2;
    gh.style.width = gh.width / dpr + 'px'; gh.style.height = gh.height / dpr + 'px';
    gh.style.left = (e.clientX - gh.width / dpr / 2) + 'px'; gh.style.top = (e.clientY - gh.height / dpr / 2) + 'px';
    const ctx = gh.getContext('2d'); ctx.setTransform(k * dpr, 0, 0, k * dpr, gh.width / 2, gh.height / 2); drawStamp(ctx, m);
    gh.hidden = false;
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopScorePlace(); } };
  const away = e => { if (!pages.some(q => q.canvas === e.target)) stopScorePlace(); };
  document.addEventListener('pointermove', move, true); document.addEventListener('keydown', key, true); document.addEventListener('pointerdown', away, true);
  scorePlacing = { text, stop: () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', away, true); gh.remove(); bar.remove(); if (panel) panel.classList.remove('placing'); } };
}
function stopScorePlace() { if (scorePlacing) { scorePlacing.stop(); scorePlacing = null; } }
function placeScore(pg, x, y) {
  const text = scorePlacing.text; stopScorePlace();
  const m = { t: 'stamp', k: 'score', x: r1(x), y: r1(y), size: newStampSize('score'), color: totalInk(), text };
  const bb = stampBox(m);   // keep it on the page
  m.x = r1(m.x + Math.max(0, -bb.x) - Math.max(0, bb.x + bb.w - pg.W)); m.y = r1(m.y + Math.max(0, -bb.y) - Math.max(0, bb.y + bb.h - pg.H));
  snap(pg); pg.marks().push(m); selected = { page: pg, mark: m, fresh: true }; changed(pg); redrawAll();
  return m;
}

