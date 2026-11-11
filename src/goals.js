/* ---------------- learning goals: tag rubric rows and quiz questions, then see a class and a student by goal ---------------- */
// Optional, and each teacher's own. lib.goals: [{ id, name, at }] is the list she typed (a skill, a standard's code, anything she
// reteaches by); lib.goalsGone: { id: time } remembers one she removed, so an older copy of her work doesn't bring it back.
// A tag is a goal's id, in three places:
//   setup.goals[row]  a rubric row (beside setup.criteria, like setup.levels)
//   q.goal            a Quick mark question (batch.quiz.qs)
//   batch.goal        the whole score of an assignment scored with just a total; a question with no goal of its own uses it too
// Nothing here changes a score or a grade. A paper's percent on a goal is its share of the points tagged with that goal, read
// through the assignment's own grading scale: a row scored 3 of 4 on a three-row rubric reads as 9 of 12 does. So a goal's
// percents sit beside the gradebook's. Across assignments each assignment counts the same, as it does within a type in the gradebook.
// Until she adds a first goal there is no Goals tab and no picker: only one quiet link in Rubric setup and a card in Settings.
function goalList() { return Array.isArray(lib.goals) ? lib.goals.filter(g => g && g.id && String(g.name || '').trim()) : []; }
function goalById(id) { return id ? goalList().find(g => g.id === id) || null : null; }
const goalName = id => { const g = goalById(id); return g ? g.name : ''; };
// A rubric's tags as Save keeps them: one per row, or nothing at all when no row is tagged, so an old setup stays as it was.
function goalsTidy(d) {
  const a = (d.criteria || []).map((_, i) => (d.goals && d.goals[i]) || null);
  return a.some(Boolean) ? a : undefined;
}
// The picker beside a row, a question or a whole score. The last choice opens her list with a new line ready.
function goalPick(attrs, sel, label) {
  const list = goalList(), known = !sel || list.some(g => g.id === sel);
  return '<select class="goalsel" ' + attrs + ' aria-label="' + esc(label || 'Learning goal') + '" title="' + esc(label || 'Learning goal') + '"><option value="">No goal</option>' +
    list.map(g => '<option value="' + esc(g.id) + '"' + (g.id === sel ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') +
    (known ? '' : '<option value="' + esc(sel) + '" selected>A goal you removed</option>') + '<option value="+">New goal…</option></select>';
}
// In Rubric setup, under the rows or the total. With no goals yet it is one link; with some, the rows carry pickers and this edits the list.
function goalsSetupHtml(d) {
  const has = goalList().length > 0;
  if (!has) return '<p class="goalline"><button class="link" data-goalsedit>Tag ' + (d.mode === 'rubric' ? 'rows' : 'this score') + ' with learning goals…</button> <span class="muted">Optional: see each class and student by goal.</span></p>';
  const whole = d.mode !== 'rubric' && batch ? '<label class="goalwhole">Learning goal for the whole score ' + goalPick('data-gall', rubDlg && rubDlg.draft === d ? rubDlg.goalAll : batch.goal || '', 'Learning goal for the whole score') + '</label>' +
    (quizOn() ? '<span class="muted goalnote">A Quick mark question with a goal of its own in Quiz boxes uses that one.</span>' : '') : '';
  return '<div class="goalline">' + whole + '<button class="link" data-goalsedit>Edit goals…</button></div>';
}
const goalRowHtml = (d, i) => goalList().length ? goalPick('data-gi="' + i + '"', (d.goals && d.goals[i]) || '', 'Learning goal for this row') : '';
function goalsRowGone(d, i) { if (d.goals) d.goals.splice(i, 1); }

/* Her list, on the layer over whatever is open. Resolves { changed, added: the id of a goal just made }. */
function goalsDlg(opts = {}) {
  const run = () => new Promise(done => {
    const back = document.activeElement, el = document.createElement('div'), was = goalList();
    let rows = was.map(g => ({ id: g.id, name: g.name }));
    if (opts.add || !rows.length) rows.push({ id: '', name: '' });
    el.className = 'dlg askdlg'; el.id = 'askDlg';
    el.innerHTML = '<div class="box narrow goalbox" role="dialog" aria-modal="true" aria-labelledby="goalsH" tabindex="-1"><div class="bh"><h2 id="goalsH">Learning goals</h2></div><div class="bb">' +
      '<p class="muted goalsay">Your own list: a skill, a standard, anything you want to see scores by. Tag rubric rows in Rubric setup and questions in Quiz boxes.</p>' +
      '<div id="goalRows"></div><div><button class="btn sm" data-gadd>+ Add a goal</button></div>' +
      '<p class="muted goalsay" id="goalGoneSay" hidden>A goal you remove comes off whatever was tagged with it. No score changes.</p></div>' +
      '<div class="bf"><button class="btn" data-no>Cancel</button><button class="btn primary" data-ok>Done</button></div></div>';
    const box = el.firstChild, list = el.querySelector('#goalRows');
    const draw = focus => {
      list.innerHTML = rows.map((r, i) => '<div class="goalrow"><input type="text" data-gn="' + i + '" maxlength="80" autocomplete="off" placeholder="A goal, in your words" aria-label="Goal ' + (i + 1) + '" value="' + esc(r.name) + '"><button class="icon" data-gx="' + i + '" aria-label="Remove this goal" title="Remove">✕</button></div>').join('');
      el.querySelector('#goalGoneSay').hidden = !was.some(g => !rows.some(r => r.id === g.id));
      if (focus != null) { const inp = list.querySelector('[data-gn="' + focus + '"]'); if (inp) inp.focus(); }
    };
    const finish = yes => {
      document.removeEventListener('keydown', keys, true);
      el.remove();
      if (back && back.isConnected) back.focus({ preventScroll: true });
      if (!yes) return done({ changed: false, added: null });
      const now = Date.now(), seen = new Set(), next = []; let added = null;
      for (const r of rows) {
        const name = r.name.trim().replace(/\s+/g, ' '); if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const old = r.id ? was.find(g => g.id === r.id) : null;
        if (old) next.push(old.name === name ? old : { ...old, name, at: now });
        else { const g = { id: uid(), name, at: now }; next.push(g); added = g.id; }
      }
      const changed = JSON.stringify(next) !== JSON.stringify(was);
      if (changed) {
        const gone = { ...(lib.goalsGone || {}) };
        for (const g of was) if (!next.some(x => x.id === g.id)) gone[g.id] = now;
        if (next.length) lib.goals = next; else delete lib.goals;
        if (Object.keys(gone).length) lib.goalsGone = gone;
        saveLib(); goalsChanged();
      }
      done({ changed, added });
    };
    const keys = e => {
      e.stopPropagation();
      if (e.key === 'Tab') trapTab(e, box);
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.gn != null) {   // Enter on the last line starts the next; anywhere else it is Done
        e.preventDefault();
        if (+e.target.dataset.gn === rows.length - 1 && e.target.value.trim()) { rows.push({ id: '', name: '' }); draw(rows.length - 1); } else finish(true);
      }
    };
    el.addEventListener('input', e => { const i = e.target.dataset.gn; if (i != null) rows[+i].name = e.target.value; });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-ok]')) return finish(true);
      if (e.target.closest('[data-no]')) return finish(false);
      if (e.target.closest('[data-gadd]')) { rows.push({ id: '', name: '' }); return draw(rows.length - 1); }
      const x = e.target.closest('[data-gx]'); if (x) { rows.splice(+x.dataset.gx, 1); if (!rows.length) rows.push({ id: '', name: '' }); draw(Math.min(+x.dataset.gx, rows.length - 1)); }
    });
    el.addEventListener('pointerdown', e => { if (e.target === el) finish(false); });
    document.addEventListener('keydown', keys, true); document.body.appendChild(el);
    draw(opts.add || !was.length ? rows.length - 1 : 0);
  });
  const p = askQ.then(run); askQ = p; return p;
}
// The list changed: whatever is on screen that shows it is drawn again.
function goalsChanged() {
  const r = routeNow();
  if (r.v === 'class' && !batch) { renderLib(); if ($('#classPanel')) classPanelDraw(true); }
  else if ($('#bkBody') && bk.cols) bkDraw();
  if (r.v === 'settings') setRender();
}
// Settings, Grading: the list, and the one button that edits it.
function goalsSetHtml() {
  const list = goalList();
  return '<div class="lhead goalset"><h2>Learning goals</h2><span class="muted">Optional. See each class and each student by goal.</span><span class="sp"></span><button class="btn sm" data-goalsedit>' + (list.length ? 'Edit goals' : 'Add goals') + '</button></div>' +
    (list.length ? '<div class="setrows" id="setGoals">' + list.map(g => '<div class="setrow"><span class="nt"><b>' + esc(g.name) + '</b></span></div>').join('') + '</div>' +
      '<p class="muted setp">Tag rubric rows in Rubric setup and quiz questions in Quiz boxes. Each class page then has a Goals tab.</p>'
      : '<p class="muted setp">A goal is anything you want to see scores by: a skill like “Uses evidence”, or a standard from your school. Tag rubric rows and quiz questions with a goal, and each class gets a Goals tab that shows what to reteach.</p>');
}
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('[data-goalsedit]')) return;
  goalsDlg().then(() => { if (rubDlg && $('#setupBody')) rubDlg.re(); });
});
// A picker in Rubric setup: a row's goal, or the whole score's. (Quiz boxes keeps its own pickers: its draft is its own.)
document.addEventListener('change', e => {
  const t = e.target; if (!t.classList || !t.classList.contains('goalsel') || !rubDlg || !t.closest('#setupBody')) return;
  const d = rubDlg.draft, set = v => { if (t.dataset.gi != null) { d.goals ||= []; d.goals[+t.dataset.gi] = v || null; } else rubDlg.goalAll = v || ''; };
  if (t.value !== '+') return set(t.value);
  goalsDlg({ add: true }).then(r => { if (r.added) set(r.added); if (rubDlg && $('#setupBody')) rubDlg.re(); });
});

/* ---------- what one saved paper says about each goal ---------- */
// d: the saved download, g: one student's grade in it, p: that grade worked out (pastScore). Null when nothing of theirs is tagged.
// { goal id: { pct, got, of, parts: [what was tagged] } }. Missing, excused and left-out papers say nothing; a partly scored
// paper's scored rows and marked questions are real scores, so they count, as they do in the rubric row charts.
function goalCell(d, g, p) {
  if (!g || !p || p.status === 'missing' || p.status === 'excused' || g.outAvg) return null;
  const s = { ...DEFAULT_SETUP, ...(d.setup || {}) }, rub = s.mode === 'rubric', out = {};
  const max = rub ? s.criteria.length * 4 : +s.outOf || 0;
  const put = (id, got, of, part) => { if (!id || !(of > 0) || got == null || isNaN(+got)) return; const e = out[id] ||= { got: 0, of: 0, parts: [] }; e.got += +got; e.of += of; if (!e.parts.includes(part)) e.parts.push(part); };
  const qs = !rub && d.quiz && Array.isArray(d.quiz.qs) ? d.quiz.qs : [], q = g.q || {};
  if (rub) s.criteria.forEach((c, i) => put(s.goals && s.goals[i], (g.rubric || [])[i], 4, String(c)));
  else if (qs.some(x => q[x.id] != null)) qs.forEach((x, i) => put(x.goal || d.goal, q[x.id], +x.pts || 0, 'Question ' + ((x.lab || '').trim() || String(i + 1))));
  else if (d.goal && p.pct != null && !p.partial) out[d.goal] = { got: p.total != null ? p.total : p.pct, of: p.total != null && p.max ? p.max : 100, pct: p.pct, parts: ['The whole score'] };
  for (const e of Object.values(out)) if (e.pct == null) { const share = Math.max(0, Math.min(1, e.got / e.of)), v = max ? percentWith(share * max, max, s.scale) : null; e.pct = v == null ? share * 100 : Math.max(0, v); }
  return Object.keys(out).length ? out : null;
}
// A class's columns by goal, for the goals she still has, in her order. Formatives have no scores, and extra credit isn't one.
// per: each student's papers on the goal; stu: each student's average over those; avg: the class's, without anyone she's left out.
const GOAL_LOW = 70;
function goalData(c, cols) {
  const use = cols.filter(x => x.type !== 'fm' && x.type !== 'xc');
  return goalList().map(g => {
    const per = new Map(), from = [];
    for (const col of use) {
      const parts = []; let n = 0;
      for (const nm of c.names) {
        const cell = col.cells.get(nm), e = cell && cell.goals && cell.goals[g.id]; if (!e) continue;
        n++; for (const p of e.parts) if (!parts.includes(p)) parts.push(p);
        if (!per.has(nm)) per.set(nm, []); per.get(nm).push({ col, pct: e.pct, got: e.got, of: e.of });
      }
      if (n) from.push({ col, parts, n });
    }
    const stu = new Map(); for (const [nm, list] of per) stu.set(nm, bkMean(list.map(x => x.pct)));
    const inAvg = c.names.filter(nm => stu.has(nm) && bkIn(nm)), low = inAvg.filter(nm => roundPct(stu.get(nm)) < GOAL_LOW);
    return { g, per, stu, from, avg: inAvg.length ? bkMean(inAvg.map(nm => stu.get(nm))) : null, n: inAvg.length, low };
  }).filter(x => x.from.length);
}
const goalPapers = list => list.map(x => x.col.name + ' ' + roundPct(x.pct) + '% (' + fmtNum(Math.round(x.got * 10) / 10) + ' of ' + fmtNum(x.of) + ')').join(' · ');

/* ---------- a class page's Goals tab ---------- */
function goalsView(c, cols, all) {
  if (bk.term === '*') cols = all;
  const edit = '<button class="btn sm" data-goalsedit>Edit goals</button>';
  if (!goalList().length) return '<div class="bkpad" id="glView"><p class="muted">You have no learning goals yet. A goal is anything you want to see scores by: a skill, or a standard from your school.</p><p><button class="btn sm primary" data-goalsedit>Add goals</button></p></div>';
  const data = goalData(c, cols);
  if (!data.length) return '<div class="bkpad" id="glView"><div class="glhead"><p class="muted">Nothing ' + (bk.term === '*' || !bkConf().terms.length ? 'this year' : 'in this term') + ' has a score on a goal yet. In an assignment, choose Setup, then Rubric setup, and pick a goal beside each row. For a paper quiz, pick one beside each question in Quiz boxes.</p><span class="sp"></span>' + edit + '</div></div>';
  const who = nm => bkWho(nm, c.names.indexOf(nm));
  // lowest first: what to reteach
  const order = data.filter(x => x.avg != null).sort((a, b) => a.avg - b.avg), least = order.length > 1 && roundPct(order[0].avg) !== roundPct(order[order.length - 1].avg) ? order[0] : null;
  const bars = order.map(x => {
    const sub = people(x.n, 'student') + ' · ' + (x.low.length ? x.low.length + ' under ' + GOAL_LOW + '%' : 'no one under ' + GOAL_LOW + '%');
    return '<div class="glbar' + (x === least ? ' lo' : '') + '" tabindex="0"' + chTip(pctAvgText(x.avg) + ' class average', x.g.name, x.low.length ? 'Under ' + GOAL_LOW + '%: ' + x.low.slice(0, 12).map(who).join(', ') + (x.low.length > 12 ? ' and ' + (x.low.length - 12) + ' more' : '') : people(x.from.length, 'assignment')) + ' aria-label="' + esc(x.g.name + ': ' + pctAvgText(x.avg) + ' class average. ' + sub) + '">' +
      '<span class="gln" data-raw><span>' + esc(x.g.name) + '</span>' + (x === least ? ' <span class="stag">lowest</span>' : '') + '</span><div class="bkcmpt"><i style="width:' + Math.min(100, x.avg) + '%"></i><em class="glcut" style="left:' + GOAL_LOW + '%"></em></div><b>' + pctAvgText(x.avg) + '</b><small>' + sub + '</small></div>';
  }).join('');
  // every student, every goal
  const sort = bk.gsort && (bk.gsort.k === 'name' || data.some(x => x.g.id === bk.gsort.k)) ? bk.gsort : { k: 'name', dir: 1 }, sg = data.find(x => x.g.id === sort.k);
  const rows = c.names.map((n, i) => ({ n, i, shown: bkWho(n, i) })), val = r => sort.k === 'name' ? r.i : sg.stu.has(r.n) ? sg.stu.get(r.n) : null;
  rows.sort((a, b) => { const x = val(a), y = val(b); return x == null || y == null ? (x == null ? 1 : 0) - (y == null ? 1 : 0) || a.i - b.i : (x - y) * sort.dir || a.i - b.i; });
  const head = (k, inner, cls, label) => '<th class="' + cls + '"' + (sort.k === k ? ' aria-sort="' + (sort.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button data-glsort="' + esc(k) + '" title="Sort by ' + esc(label) + '">' + inner + (sort.k === k ? '<span class="charr" aria-hidden="true">' + (sort.dir < 0 ? '▾' : '▴') + '</span>' : '') + '</button></th>';
  const page = bkPage(), name = r => page ? '<a class="bklink" href="' + classHash(c, 'students', r.i) + '">' + esc(r.shown) + '</a>' : '<button class="link" data-bkgo="' + r.i + '">' + esc(r.shown) + '</button>';
  const cell = (x, r) => {
    if (!x.stu.has(r.n)) return '<span class="chc none"' + chTip('No score on this goal yet', r.shown, x.g.name) + '></span>';
    const v = x.stu.get(r.n);
    return '<span class="chc b' + chBand(v) + (bkIn(r.n) ? '' : ' glout') + '"' + chTip(roundPct(v) + '%', r.shown + ' · ' + x.g.name, goalPapers(x.per.get(r.n))) + '>' + roundPct(v) + '</span>';
  };
  const heat = '<div class="chwrap"><table class="chtab gltab" id="glHeat"><thead><tr>' + head('name', 'Student', 'chn', 'roster order') + data.map(x => head(x.g.id, '<span data-raw>' + esc(x.g.name) + '</span>', 'chh', x.g.name)).join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr><th class="chn" scope="row">' + name(r) + '</th>' + data.map(x => '<td>' + cell(x, r) + '</td>').join('') + '</tr>').join('') +
    '<tr class="chfoot"><th class="chn" scope="row">Class average</th>' + data.map(x => '<td>' + (x.avg != null ? roundPct(x.avg) + '%' : '–') + '</td>').join('') + '</tr></tbody></table></div>' +
    '<div class="bkleg chleg">' + chBandLegend().join('') + '</div>';
  const fromRows = data.flatMap(x => x.from.map((f, k) => '<tr><td>' + (k ? '' : esc(x.g.name)) + '</td><td>' + esc(f.col.name) + (f.col.due ? ' <span class="muted">' + esc(bkDay(f.col.due)) + '</span>' : '') + '</td><td>' + esc(f.parts.join(', ')) + '</td><td>' + f.n + '</td></tr>')).join('');
  const unused = goalList().filter(g => !data.some(x => x.g.id === g.id));
  return '<div class="bkpad" id="glView"><div class="glhead"><p class="muted">Each goal’s percent comes from the rubric rows and quiz questions you tagged with it. Every assignment counts the same.</p><span class="sp"></span>' + edit + '</div>' +
    chSec('What to reteach', '<div class="glbars" id="glBars">' + bars + '</div>', 'The class average on each goal, lowest first. The dashed line is ' + GOAL_LOW + '%.') +
    chSec('Every student, every goal', heat, 'The stronger the blue, the higher the score. Click a heading to sort by it. An empty box is a student with no score on that goal yet.') +
    '<section><details class="ovtbl" id="glFrom"><summary>Where each goal’s scores come from</summary><table class="ovtab"><thead><tr><th>Goal</th><th>Assignment</th><th>Tagged with it</th><th>Papers</th></tr></thead><tbody>' + fromRows + '</tbody></table>' +
    (unused.length ? '<p class="muted ovcap2">No scores here yet: ' + esc(unused.map(g => g.name).join(', ')) + '.</p>' : '') + '</details></section></div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-glsort]'); if (!b || !$('#bkBody')) return;
  const k = b.dataset.glsort, was = bk.gsort && bk.gsort.k === k ? bk.gsort.dir : 0;
  bk.gsort = { k, dir: was ? -was : k === 'name' ? 1 : -1 }; bkDraw();
  const again = $('#glHeat [data-glsort="' + CSS.escape(k) + '"]'); if (again) again.focus({ preventScroll: true });
});

/* ---------- one student's goals, on their own page ---------- */
// Nothing at all unless this student has a score on a goal.
function goalsStu(c, cols, n) {
  const data = goalData(c, cols).filter(x => x.stu.has(n)); if (!data.length) return '';
  return chSec('Learning goals', '<div id="glStu">' + data.map(x => { const v = x.stu.get(n), list = x.per.get(n);
    return '<div class="bkcmp chrow glstu" tabindex="0"' + chTip(roundPct(v) + '%', x.g.name, goalPapers(list) + (x.avg != null ? ' · class average ' + pctAvgText(x.avg) : '')) + '><span title="' + esc(x.g.name) + '" data-raw>' + esc(x.g.name) + '</span><div class="bkcmpt"><i style="width:' + Math.min(100, v) + '%"></i>' + (x.avg != null ? '<em style="left:' + Math.min(100, x.avg) + '%"></em>' : '') + '</div><b>' + roundPct(v) + '%</b><small>' + (x.avg != null ? 'class ' + pctAvgText(x.avg) : '') + '</small></div>'; }).join('') + '</div>',
    'Their average on each goal, from the rubric rows and quiz questions tagged with it. The dashed line is the class average.');
}
Object.assign(window.__gs, { goalList, goalCell, goalData, goalsDlg });
