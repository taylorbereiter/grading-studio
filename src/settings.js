/* ---------------- Settings: one page per subject, each with its own address (#/settings/<key>) ---------------- */
// The list on the left is SET_SECS (app.js). The cards on the right carry data-sec; only the chosen subject's cards show.
// Most of what is here opens the same box as the button elsewhere in the app, so there is one place each thing is changed.
let setSecWas = '';
const setHash = k => '#/settings' + (k && k !== 'saving' ? '/' + k : '');
function setRender() {
  if (!shellReady) return;
  const r = routeNow(); if (r.v !== 'settings' || batch) { setSecWas = ''; return; }
  if (r.sec !== setSecWas) { setSecWas = r.sec; if (r.sec === 'grading') setBankCount(); if (r.sec === 'timetable') planRefresh(); if (r.sec === 'history') gbOpen(); }
  const nav = SET_SECS.map(([k, t, s]) => '<a class="setlink' + (k === r.sec ? ' on' : '') + '" href="' + setHash(k) + '" data-set="' + k + '"' + (k === r.sec ? ' aria-current="page"' : '') + '><b>' + t + '</b><span>' + s + '</span></a>').join('');
  const box = $('#setNav'); if (box.dataset.h !== nav) { box.dataset.h = nav; box.innerHTML = nav; }
  for (const el of document.querySelectorAll('#setPane [data-sec]')) el.hidden = el.dataset.sec !== r.sec;
  const put = (id, h) => { const el = $(id); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
  meSetRender(r.sec); attSetRender(r.sec);
  if (r.sec === 'history') gbRender();
  if (r.sec === 'about') updRender();
  if (r.sec === 'classes') {
    const row = (c, ci) => '<div class="setrow"><span class="rdot" style="background:' + classColor(c) + '"></span><span class="nt"><b>' + esc(c.name) + '</b><span class="ns">' + (c.names.length ? c.names.length + (c.names.length === 1 ? ' student' : ' students') : 'No roster yet') + ' · ' + (mbOf(c) ? esc(sysLink()) + ' link saved' : 'No ' + esc(sysLink()) + ' link') + '</span></span>' +
      '<a class="btn sm" href="' + classHash(c) + '">Open</a><button class="btn sm" data-setcls="' + ci + '">Name and roster</button><button class="btn sm" data-setmb="' + ci + '">' + esc(sysLink()) + ' link</button></div>';
    put('#setClasses', '<div class="lhead"><h2>Classes and rosters</h2><span class="muted">A class has its roster, its units and its ' + (sysName() ? esc(sysName()) + ' page' : 'link to your school’s system') + '.</span><span class="sp"></span><button class="btn sm primary" data-setadd>Add a class</button></div>' +
      (lib.classes.length ? '<div class="setrows">' + lib.classes.map(row).join('') + '</div>' : '<p class="muted setp">No classes yet. A class holds a roster, so papers match to students and the gradebook has rows.</p>'));
  }
  if (r.sec === 'terms') {
    const conf = bkConf(), has = lib.classes.some(c => c.names.length);
    const terms = conf.terms.length ? conf.terms.map(t => '<div class="setrow"><span class="nt"><b>' + esc(t.name || 'Term') + '</b><span class="ns">' + (t.start && t.end ? bkDay(t.start) + ' to ' + bkDay(t.end) : 'No dates yet') + '</span></span></div>').join('') : '<div class="setrow"><span class="nt"><span class="ns">No terms yet: the gradebook treats the whole year as one.</span></span></div>';
    put('#setTerms', '<div class="lhead"><h2>Terms and weights</h2><span class="muted">For all your classes. An assignment counts toward the term its due date falls in.</span><span class="sp"></span><button class="btn sm primary" data-setterms' + (has ? '' : ' disabled title="Add a class with a roster first"') + '>Term setup</button></div>' +
      '<div class="setrows">' + terms + '</div>' +
      '<p class="setp"><b>How each type counts:</b> ' + BK_TYPES.map(([t, l]) => esc(l.replace(/y$/, 'ie') + 's') + ' ' + (+conf.w[t] || 0) + '%').join(' · ') + '. ' + (conf.empty === 'zero' ? 'A type with nothing in it yet counts as 0.' : 'When a type has nothing in it yet, the other types are used.') + '</p>' +
      '<p class="setp"><b>Extra credit:</b> new entries add to ' + bkXcWhere(conf.xcTo) + ', one point for one percentage point. ' + (conf.xcCap ? 'Grades stay at 100% at most.' : 'A grade can go over 100%.') + '</p>');
  }
  if (r.sec === 'grading') {
    const n = gBankSeen;
    put('#setGrading', '<div class="lhead"><h2>Grading scale and rubrics</h2><span class="muted">Saved once, picked on any assignment.</span><span class="sp"></span><a class="btn sm" href="' + esc(planUrl('#rubrics')) + '">Open the rubric bank</a></div>' +
      '<p class="setp">' + (n ? 'You have ' + n.r + (n.r === 1 ? ' saved rubric' : ' saved rubrics') + ' and ' + n.s + (n.s === 1 ? ' saved grading scale' : ' saved grading scales') + '.' : 'Looking for your saved rubrics…') + ' They are kept in the rubric bank, sorted by unit, and hold only a rubric’s wording and a scale’s percents.</p>' +
      '<p class="muted setp">To use one, open an assignment and choose Setup, then Rubric setup. A rubric or scale you make there can be saved to the bank from the same box.</p>');
  }
  if (r.sec === 'timetable') {
    const p = plan, day = s => s ? new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    put('#setTimetable', '<div class="lhead"><h2>Timetable and calendar</h2><span class="muted">When each class meets, the semester’s dates and the days off. It lives in the Planner.</span><span class="sp"></span><a class="btn sm primary" href="' + esc(planUrl('#timetable')) + '">' + (p ? 'Open the timetable' : 'Set up the timetable') + '</a></div>' +
      (p ? '<div class="setrows">' + p.classes.map(c => '<div class="setrow"><span class="rdot" style="background:' + c.color + '"></span><span class="nt"><b>' + esc(c.name) + '</b><span class="ns">' + (c.meets.length ? c.meets.length + (c.meets.length === 1 ? ' meeting' : ' meetings') + ' a week' : 'No meeting times yet') + '</span></span></div>').join('') + '</div>' +
        '<p class="muted setp">' + (p.semStart && p.semEnd ? 'Semester: ' + day(p.semStart) + ' to ' + day(p.semEnd) + '. ' : '') + (p.daysOff.length ? p.daysOff.length + (p.daysOff.length === 1 ? ' day off' : ' days off') : 'No days off') + ' on the calendar. Home shows today’s classes from this.</p>'
        : '<p class="muted setp">No timetable in this browser yet. Once the Planner knows when your classes meet, Today shows the day’s classes and the lesson planned for each.</p>'));
  }
}
// The rubric bank is the Planner's; grading reads it one way (rubrics.js). Counted when the page is opened, not kept.
let gBankSeen = null;
async function setBankCount() {
  let b = null; const db = await planDb(false);
  if (db) { try { b = await idbP(db.transaction('kv').objectStore('kv').get('bank')); } catch {} db.close(); }
  b = tidyBank(b);
  const mine = savedRubrics().filter(r => !b.rubrics.some(x => x.id === r.id) && !(b.gone[r.id] >= (r.at || 0))).length;   // saved here, not in the bank yet
  gBankSeen = { r: b.rubrics.length + mine, s: b.scales.length };
  setRender();
}
$('#setPane').addEventListener('click', async e => {
  if (e.target.closest('[data-setadd]')) return editClass(-1);
  const c = e.target.closest('[data-setcls]'); if (c) return editClass(+c.dataset.setcls);
  const m = e.target.closest('[data-setmb]'); if (m) { await askMb(+m.dataset.setmb); return setRender(); }
  if (e.target.closest('[data-setterms]')) { const k = lib.classes.find(c => c.names.length); if (!k) return; await openBook(k.id); if ($('#bkBody')) bkSetupView(); }
});
// A box that was opened from here may have changed what a card says: draw again when it closes.
new MutationObserver(() => { if ($('#dlg').hidden) setRender(); }).observe($('#dlg'), { attributes: true, attributeFilter: ['hidden'] });

// Settings, Display, Language (lang.js keeps the choice and draws the page again).
$('#setLangBox').innerHTML = langPick('setLangPick');
