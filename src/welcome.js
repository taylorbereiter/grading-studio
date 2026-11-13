/* ---------------- any teacher: the welcome, a sample class, and the words that follow a teacher's own school (stage 3) ---------------- */
// A brand-new browser has nothing in it, so it opens on three questions: your classes, how you grade, where work is kept.
// The answers are lib.me and the classes themselves (library.js). A browser that already has work is never asked: it has no
// lib.me, reads as it always did, and nothing is written for it until its teacher changes one of these in Settings.

/* the words on Home that name the school's system */
function sysWords() {
  const s = sysName(), put = (sel, t) => { for (const el of document.querySelectorAll(sel)) if (el.textContent !== t) el.textContent = t; };
  put('#dropSay', 'A ZIP from ' + (s || 'your school’s system') + ', a folder, a scan of the whole class, or photos.');
  put('.sysWord', s || 'your gradebook');
  put('.sysZip', s ? 'a ' + s + ' ZIP' : 'a ZIP');
  put('.aiWord', aiSay());
  besidePaint();
  put('#shareBtn', 'Share with ' + aiSay()); put('#backBtn', 'Bring back from ' + aiSay());   // the whole label, since Find anything lists these buttons by their words
}

/* the welcome */
const WL_ICON = {
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
  folder: IC_FOLDER,
};
const wl = { on: false, step: 0, classes: ['', '', ''], sys: '', sysOther: '', way: 'rubric', busy: false };
const wlShown = () => wl.on;
function wlOpen() {
  Object.assign(wl, { on: true, step: 0, busy: false, way: (meGrade() || { way: 'rubric' }).way, sys: SYS_LIST.includes(sysName()) ? sysName() : sysName() ? 'other' : '', sysOther: SYS_LIST.includes(sysName()) ? '' : sysName() });
  const mine = lib.classes.filter(c => !c.sample).map(c => c.name);
  wl.classes = mine.concat(['', '', '']).slice(0, Math.max(3, mine.length + 1));
  wl.had = mine.length;   // classes that are already there are shown, and stay as they are
  wlRender(); $('#welcome').hidden = false; document.documentElement.classList.add('welcoming');
  const f = $('#welcome input:not([disabled])'); if (f) f.focus();
}
function wlClose() { wl.on = false; $('#welcome').hidden = true; document.documentElement.classList.remove('welcoming'); }
const WL_STEPS = ['Your classes', 'How you grade', 'Where work is kept'];
function wlRender() {
  const steps = WL_STEPS.map((t, i) => (i ? '<hr>' : '') + '<span class="' + (i === wl.step ? 'on' : i < wl.step ? 'done' : '') + '"' + (i === wl.step ? ' aria-current="step"' : '') + '><b>' + (i + 1) + '</b>' + t + '</span>').join('');
  let body = '';
  if (wl.step === 0) {
    body = '<label class="wlq" for="wlC0">What do you teach?</label><div class="wlfields" id="wlClasses">' +
      wl.classes.map((c, i) => '<input type="text" id="wlC' + i + '" data-wlc="' + i + '" value="' + esc(c) + '" maxlength="60" autocomplete="off"' + (i < wl.had ? ' disabled' : '') + ' placeholder="' + (i ? 'Add another class' : 'A class, like Period 2 Biology') + '"' + (i ? ' aria-label="Another class"' : '') + '>').join('') + '</div>' +
      '<p class="wlhint">Student names are optional and come later: paste a class list on a class’s page, or skip it.</p>' +
      '<label class="wlq" for="wlSys">Where do students hand in work?</label><div class="wlfields"><select id="wlSys"><option value="">On paper, or I’d rather not say</option>' +
      SYS_LIST.map(s => '<option' + (wl.sys === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '<option value="other"' + (wl.sys === 'other' ? ' selected' : '') + '>Somewhere else…</option></select>' +
      (wl.sys === 'other' ? '<input type="text" id="wlSysOther" value="' + esc(wl.sysOther) + '" maxlength="40" placeholder="Its name" aria-label="The name of your school’s system">' : '') + '</div>' +
      '<p class="wlhint">Only so the app can use its name. Nothing is connected to it, and nothing is sent.</p>';
  } else if (wl.step === 1) {
    body = '<div class="wlq" id="wlWayQ">How do you usually grade?</div><div class="wlways" role="radiogroup" aria-labelledby="wlWayQ">' +
      GRADE_WAYS.map(([k, t, s]) => '<button class="wlway' + (wl.way === k ? ' on' : '') + '" role="radio" aria-checked="' + (wl.way === k) + '" data-wlway="' + k + '"><b>' + t + '</b><span>' + s + '</span></button>').join('') + '</div>' +
      '<p class="wlhint">This is only what a new assignment starts with. Any assignment can be scored another way.</p>';
  } else {
    const linked = fld.state !== 'none' && fld.name;
    body = '<div class="wlq">Where should your work be kept?</div>' +
      (linked ? '<p class="wlsafe"><span class="wlok">✓</span> Saving to the folder “' + esc(fld.name) + '” as well as this browser.</p>'
        : canPickFolder() ? '<p class="wlsay">Your classes, papers, marks and scores are kept in this browser. Choose a folder on this computer and every save goes there too, with a copy of each day to go back to. Nothing is uploaded.</p>' +
          '<p class="wlrow"><button class="btn" data-wlfolder>' + IC_FOLDER + 'Choose a folder…</button><span class="muted">You can also do this later, from the sidebar.</span></p>'
          : '<p class="wlsay">Your classes, papers, marks and scores are kept in this browser. This browser can’t save to a folder by itself (Chrome or Edge on a computer can), so make a take-home file now and then, in Settings. The sidebar reminds you.</p>');
  }
  const last = wl.step === WL_STEPS.length - 1;
  $('#welcome').innerHTML = '<div class="wlsheet" role="dialog" aria-modal="true" aria-labelledby="wlH"><div class="wll">' +
    '<div class="wlbrand"><span>Grading <i>Studio</i></span>' + langPick('wlLang') + '</div>' +
    '<h1 id="wlH">Mark papers, plan lessons,<br>hand work back.</h1>' +
    '<p class="wllead">Three quick questions and you’re marking. You can change every answer later.</p>' +
    '<div class="wlsteps" aria-label="Step ' + (wl.step + 1) + ' of 3">' + steps + '</div>' +
    '<div class="wlbody">' + body + '</div>' +
    '<div class="wlact">' + (wl.step ? '<button class="btn" data-wlback>Back</button>' : '') + '<button class="btn primary" data-wlnext>' + (last ? 'Start' : 'Continue') + '</button>' +
    '<button class="link" data-wlsample>Look around with a sample class first</button>' + '</div>' +
    (wl.step === 0 && !lib.classes.length ? '<p class="wlfoot">Already use Grading Studio on another computer? <button class="link" data-wlbring>Bring your work in</button></p><p class="wlfoot wlfoot2">Have an AI assistant that knows how you teach? <button class="link" data-wlai>Let it set this up</button></p>' : '') +
    '</div><div class="wlr">' +
    [['lock', 'Private', 'Student work never leaves this computer. No account, nothing uploaded.'],
      ['drop', 'Works with what you have', 'Google Classroom, ManageBac, Canvas, Teams, a folder of files, or a scan of the whole class.'],
      ['folder', 'Safe', 'Saved as you go to a folder you choose, with a copy of every day to go back to.']]
      .map(([i, t, s]) => '<div class="wlpr"><div class="wlic">' + WL_ICON[i] + '</div><div><b>' + t + '</b><span>' + s + '</span></div></div>').join('') +
    '</div></div>';
}
// What she has typed so far, read off the screen before it is drawn again.
function wlRead() {
  for (const el of document.querySelectorAll('#welcome [data-wlc]')) wl.classes[+el.dataset.wlc] = el.value;
  const s = $('#wlSys'); if (s) wl.sys = s.value;
  const o = $('#wlSysOther'); if (o) wl.sysOther = o.value;
}
const wlSysSaid = () => (wl.sys === 'other' ? wl.sysOther : wl.sys).trim().slice(0, 40);
// The answers become her classes and lib.me. Classes she already has stay; a name typed twice is one class.
function wlSave() {
  const seen = new Set(lib.classes.map(c => normName(c.name)));
  for (const raw of wl.classes.slice(wl.had)) {
    const name = raw.trim().replace(/\s+/g, ' '); if (!name || seen.has(normName(name))) continue;
    seen.add(normName(name)); lib.classes.push({ id: uid(), name, names: [], units: [], ...(wl.way === 'myp' ? { way: 'myp' } : {}) });   // a teacher who grades with MYP criteria starts with MYP classes (ib.js)
  }
  const way = gradeWay(wl.way) || GRADE_WAYS[0];
  // Work that came in while she was being asked (her own folder, from another computer) keeps the words and defaults it had there.
  if (!lib.me && lib.classes.some(c => c.names.length || c.units.some(u => u.items.length))) saveLib();
  else {
    store.del('gs.setup');   // nothing scored yet in this browser: her answer is what the next assignment starts with
    meSet({ sys: wlSysSaid(), unit: me().unit || '', grade: { way: way[0], setup: JSON.parse(JSON.stringify(way[3])), ...(way[4] ? { bands: way[4].map(b => b.slice()) } : {}) }, hi: Date.now() });
  }
  sysWords();
}
async function wlNext() {
  wlRead();
  if (wl.step < WL_STEPS.length - 1) { wl.step++; wlRender(); const f = $('#welcome .wlbody button, #welcome .wlbody input'); if (f) f.focus(); return; }
  wlSave(); wlClose();
  renderLib(); railRender(); renderNeeds(); sampleNoteRender();
  go('#/', true);
  const n = lib.classes.filter(c => !c.sample).length;
  toast(n ? 'You’re set up. Open a class’s papers here, or click a class in the sidebar to add its students.' : 'You’re set up. Open some papers here, or add a class in the sidebar.', 7000);
}
$('#welcome').addEventListener('click', async e => {
  if (wl.busy) return;
  const w = e.target.closest('[data-wlway]'); if (w) { wl.way = w.dataset.wlway; wlRender(); const b = $('#welcome [data-wlway="' + wl.way + '"]'); if (b) b.focus(); return; }
  if (e.target.closest('[data-wlback]')) { wlRead(); wl.step--; return wlRender(); }
  if (e.target.closest('[data-wlnext]')) return wlNext();
  if (e.target.closest('[data-wlfolder]')) { wl.busy = true; try { await folderPick(); } finally { wl.busy = false; } if (wl.on) wlRender(); return; }
  if (e.target.closest('[data-wlsample]')) return sampleEnter();
  if (e.target.closest('[data-wlai]')) { wlClose(); return go('#/settings/setup'); }
  if (e.target.closest('[data-wlbring]')) { wlClose(); go('#/settings'); toast('Choose your Grading Studio folder, or bring in a take-home file. Your classes and work come with it.', 8000); }
});
$('#welcome').addEventListener('input', e => {
  if (e.target.dataset.wlc == null) return;
  wlRead();
  // a new empty line appears once the last one has something in it
  if (wl.classes.length < 12 && wl.classes[wl.classes.length - 1].trim()) {
    wl.classes.push(''); const i = wl.classes.length - 1, el = document.createElement('input');
    Object.assign(el, { type: 'text', id: 'wlC' + i, value: '', maxLength: 60, autocomplete: 'off', placeholder: 'Add another class' }); el.dataset.wlc = i; el.setAttribute('aria-label', 'Another class');
    $('#wlClasses').appendChild(el);
  }
});
$('#welcome').addEventListener('change', e => { if (e.target.id === 'wlSys') { wlRead(); wlRender(); const o = $('#wlSysOther'); (o || $('#wlSys')).focus(); } });
$('#welcome').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); wlNext(); }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.matches('[data-wlway]')) {
    e.preventDefault(); const i = GRADE_WAYS.findIndex(w => w[0] === wl.way), d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    wl.way = GRADE_WAYS[(i + d + GRADE_WAYS.length) % GRADE_WAYS.length][0]; wlRender(); $('#welcome [data-wlway="' + wl.way + '"]').focus();
  }
  if (e.key === 'Tab') {   // the questions keep the keyboard until they are answered or left
    const all = [...document.querySelectorAll('#welcome button:not([disabled]), #welcome input:not([disabled]), #welcome select')].filter(el => el.tabIndex >= 0 && (!el.matches('[data-wlway]') || el.classList.contains('on')));
    const first = all[0], lastEl = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); } else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }
});

/* the sample */
// "Look around with a sample class first" opens the sample (src/sample.js): two made-up classes with a term of work, kept apart
// from everything real. Until 11/13 it made one sample class beside the teacher's own classes instead. A browser that still has
// that class keeps it, with its card on Today and the button that removes it.
const hasSample = () => lib.classes.some(c => c.sample);
const asked = () => !lib.me || !!lib.me.hi;   // the three questions were answered here, or this browser's work is from before they existed
async function sampleRemove() {
  const c = lib.classes.find(c => c.sample); if (!c) return;
  if (batch) return toast('Close the papers first.');
  for (const u of c.units) for (const it of u.items) if (it.batchId) { try { await forgetKept(it.batchId); } catch (e) { console.error(e); } }
  lib.classes.splice(lib.classes.indexOf(c), 1); saveLib();
  renderLib(); railRender(); renderNeeds(); sampleNoteRender();
  if (routeNow().v !== 'home') go('#/', true);
  toast('The sample class is gone.');
}
// On Today: in the sample, what it is, a few things to try and the way out. Outside it, only for a sample class from before.
const SAMPLE_TRY = [['paper', 'A marked paper'], ['quiz', 'A quiz marked by question'], ['book', 'The gradebook'], ['charts', 'Charts'], ['missing', 'Missing work'], ['seats', 'The seating chart'], ['plan', 'This week’s lessons']];
function sampleGo(k) {
  const c = lib.classes[0], it = n => { for (const u of (c || {}).units || []) for (const x of u.items) if (x.sampleKey === n) return x; return null; };
  if (k === 'plan') { location.href = $('#lessonsBtn').getAttribute('href'); return; }
  if (!c) return;
  const a = k === 'paper' ? it('essay') : k === 'quiz' ? it('quiz') : null;
  if (a && a.batchId) return go(batchHash(a.batchId));
  go(classHash(c, { book: 'gradebook', charts: 'charts', missing: 'missing', seats: 'seating' }[k] || ''));
}
function sampleNoteRender() {
  const el = $('#sampleNote'); if (!el || !shellReady) return;
  let h = '';
  if (sampleOn()) h = !sampleBuilt() ? '' : '<span class="saic">' + WL_ICON.drop + '</span><div class="satx"><h2>You’re looking at the sample</h2><p>Two made-up classes, part-way through a term: marked papers, a gradebook, a timetable and lessons. Change anything you like. None of it is real, and your own work is kept apart.</p>' +
    '<p class="satry"><span>Things to try:</span>' + SAMPLE_TRY.map(([k, t]) => '<button class="link" data-sampletry="' + k + '">' + t + '</button>').join('') + '</p>' +
    '<p class="sarow"><button class="btn primary" data-sampleleave>Leave the sample</button></p></div>';
  else if (hasSample()) h = '<span class="saic">' + WL_ICON.drop + '</span><div class="satx"><h2>You’re looking at a sample class</h2><p>Its six students and their papers are made up. Mark them, score them and export them as much as you like: nothing here is real.</p>' +
    '<p class="sarow">' + (asked() ? '' : '<button class="btn primary" data-wlstart>Set up my own classes</button>') + '<button class="' + (asked() ? 'btn' : 'link') + '" data-samplego>Open the sample papers</button><button class="link" data-samplerm>Remove the sample class</button></p></div>';
  el.hidden = !h; el.classList.toggle('calm', !!h);
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#sampleNote').addEventListener('click', e => {
  if (e.target.closest('[data-wlstart]')) return wlOpen();
  if (e.target.closest('[data-samplego]')) { const c = lib.classes.find(c => c.sample); return c && go(classHash(c)); }
  if (e.target.closest('[data-samplerm]')) return sampleRemove();
  const t = e.target.closest('[data-sampletry]'); if (t) return sampleGo(t.dataset.sampletry);
});

/* Settings: the same answers, to change */
function meSetRender(sec) {
  const put = (id, h) => { const el = $(id); if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
  if (sec === 'classes') {
    const s = sysName(), known = SYS_LIST.includes(s);
    put('#setSys', '<div class="lhead"><h2>Where students hand in work</h2><span class="muted">Only for the words on screen. Nothing is connected to it.</span></div>' +
      '<p class="setp merow"><select id="meSys" aria-label="Where students hand in work"><option value="">On paper, or not said</option>' + SYS_LIST.map(x => '<option' + (x === s ? ' selected' : '') + '>' + esc(x) + '</option>').join('') +
      '<option value="other"' + (s && !known ? ' selected' : '') + '>Somewhere else…</option></select>' + (s && !known ? '<input type="text" id="meSysOther" maxlength="40" value="' + esc(s) + '" aria-label="Its name">' : '') + '</p>');
  }
  if (sec === 'claude') {
    const a = aiName(), known = AI_LIST.some(x => x[0] === a);
    put('#setAi', '<p class="setp merow"><label for="meAi"><b>Your AI assistant</b></label> <select id="meAi"><option value="">None, or not said</option>' + AI_LIST.map(x => '<option' + (x[0] === a ? ' selected' : '') + '>' + x[0] + '</option>').join('') +
      '<option value="other"' + (a && !known ? ' selected' : '') + '>Another one…</option></select>' + (a && !known ? '<input type="text" id="meAiOther" maxlength="30" value="' + esc(a) + '" aria-label="Its name">' : '') +
      ' <span class="muted">Only for the words on screen and the names of the files you make for it. Nothing is connected to it.</span></p>' +
      // Where it opens, and how (src/beside.js). An assistant the app doesn't know is in the sidebar once it has an address.
      (a ? '<p class="setp merow"><label for="meAiUrl"><b>Opens at</b></label> <input type="url" id="meAiUrl" class="meurl" maxlength="400" spellcheck="false" data-rawa placeholder="' + esc(aiUsual(a) || 'https://') + '" value="' + esc(aiUrlClean(me().aiUrl)) + '">' +
        ' <span class="muted">Empty for its usual page. A link of your own can go to your school account, a Gem, a project or a custom GPT.</span></p>' +
        '<p class="setp merow"><label for="meAiOpen"><b>A click on its name opens it</b></label> <select id="meAiOpen"><option value="">in a window on the right of the screen</option><option value="tab"' + (me().aiOpen === 'tab' ? ' selected' : '') + '>in a new tab</option></select>' +
        (aiLink() ? ' <button class="btn sm" data-besideopen>Open it now</button>' : '') + '</p>' +
        (aiLink() ? '<p class="setp merow" id="meAiList"><b>Others you switch to</b> ' + [...new Set(AI_LIST.map(x => x[0]).concat(Object.keys(me().aiUrls || {})))].filter(n => n !== a).map(n => '<label class="mecheck"><input type="checkbox" data-ailist="' + esc(n) + '"' + ((me().aiOff || []).includes(n) ? '' : ' checked') + '> <span data-raw>' + esc(n) + '</span></label>').join(' ') +
          ' <span class="muted">A click on your assistant’s name in the sidebar lists these too. Pick one there and it opens and becomes the one in use, with its own link.</span></p>' : '') +
        '<p class="setp" id="meBeside"><b>Side by side.</b> ' + (aiLink() ? '<span class="aiWord">' + esc(a) + '</span> is in the sidebar on every screen, so you can go between the two without hunting for a tab. In Chrome, right-click it there and choose <b>Open link in split view</b>: both are then in one window, with a divider you can drag.' : 'Give it an address above and it is in the sidebar on every screen.') +
        ' <span>Grading Studio sends nothing to it. It sees only what you paste or attach.</span></p>' : ''));
  }
  if (sec === 'grading') {
    const g = meGrade(), way = g ? g.way : '';
    put('#setWay', '<div class="lhead"><h2>How you usually grade</h2><span class="muted">What a new assignment starts with. Any assignment can be scored another way, in its Rubric setup.</span></div>' +
      '<div class="meways" role="radiogroup" aria-label="How you usually grade">' + GRADE_WAYS.map(([k, t, s]) => '<button class="wlway' + (way === k ? ' on' : '') + '" role="radio" aria-checked="' + (way === k) + '" data-meway="' + k + '"><b>' + t + '</b><span>' + s + '</span></button>').join('') + '</div>' +
      (g && g.way === 'rubric' ? '<div class="rowscale merowscale"><label for="meRowTop">Each rubric row is scored 0 to</label><select id="meRowTop" class="btn sm">' + Array.from({ length: ROW_TOP_MAX }, (_, k) => '<option' + (k + 1 === (rowsTop(g.setup) || ROW_TOP) ? ' selected' : '') + '>' + (k + 1) + '</option>').join('') + '</select>' +
        '<label class="rowhalf"><input type="checkbox" id="meRowHalf"' + (rowHalf(g.setup) ? ' checked' : '') + '> Half points</label><span class="muted">For new assignments. Any rubric can use another scale, in its Rubric setup.</span></div>' : '') +
      (g ? '' : '<p class="muted setp">Not chosen: a new assignment starts as it always has here, with three rubric rows and the 12-point scale (12 = 100, 11 = 95, 10 = 91…). Choosing one changes only assignments you make from then on.</p>') +
      (g && g.bands ? '<div class="mebands"><p class="setp"><b>' + (g.way === 'ib7' ? 'Grade boundaries' : 'Where each letter starts') + '</b> <span class="muted">The lowest percent that earns each grade. Shown beside the percent while you score and on the Grades tab.</span></p>' +
        '<div class="mebrow">' + g.bands.map((b, i) => '<label><input type="text" class="mebl" data-mebl="' + i + '" maxlength="12" value="' + esc(b[1]) + '" aria-label="Grade ' + (i + 1) + '"><span>from</span><input type="number" min="0" max="100" step="1" data-mebp="' + i + '" value="' + b[0] + '" aria-label="Lowest percent for ' + esc(b[1]) + '"' + (i === g.bands.length - 1 ? ' disabled' : '') + '><span>%</span></label>').join('') + '</div></div>' : ''));
  }
}
// One of the teacher's own settings that is kept only while it says something: an empty one is taken out, not stored empty.
function meDrop(k, v) { const m = { ...me() }; if (v) m[k] = v; else delete m[k]; lib.me = m; saveLib(); gradeDefaultApply(); }
// Another assistant: a link the teacher gave the last one doesn't go with it.
function meAiSet(name) { if (name === aiName()) { meSet({ ai: name }); return; } besideUse(name); }   // its own link is remembered under its name and comes back with it (src/beside.js)
$('#setPane').addEventListener('click', e => { if (e.target.closest('[data-besideopen]')) besideOpen(); });
$('#setPane').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'meSys') { if (t.value === 'other') { meSet({ sys: 'My school’s system' }); sysWords(); setRender(); const o = $('#meSysOther'); if (o) { o.focus(); o.select(); } return; } meSet({ sys: t.value }); sysWords(); return setRender(); }
  if (t.id === 'meAi') { if (t.value === 'other') { meAiSet('My assistant'); sysWords(); setRender(); const o = $('#meAiOther'); if (o) { o.focus(); o.select(); } return; } meAiSet(t.value); sysWords(); return setRender(); }
  if (t.id === 'meAiUrl') {   // its own address: https only, and nothing is kept for an empty box
    const v = aiUrlClean(t.value);
    if (t.value.trim() && !v) { t.value = aiUrlClean(me().aiUrl); return toast('A link starts with https://'); }
    meDrop('aiUrl', v); sysWords(); return setRender();
  }
  if (t.dataset.ailist) { const off = new Set(me().aiOff || []); if (t.checked) off.delete(t.dataset.ailist); else off.add(t.dataset.ailist); meDrop('aiOff', off.size ? [...off] : null); sysWords(); return; }
  if (t.id === 'meAiOpen') { meDrop('aiOpen', t.value === 'tab' ? 'tab' : ''); sysWords(); return setRender(); }
  if (t.id === 'meAiOther') { meSet({ ai: t.value.trim().slice(0, 30) }); sysWords(); return setRender(); }
  if (t.id === 'meSysOther') { meSet({ sys: t.value.trim().slice(0, 40) }); sysWords(); return setRender(); }
  if (t.id === 'meRowTop' || t.id === 'meRowHalf') {   // the teacher's usual row scale: only new assignments start with it
    const g = meGrade(); if (!g) return;
    const su = { ...g.setup }; for (const k of ['top', 'tops', 'half']) delete su[k];
    Object.assign(su, rowScaleOf({ top: $('#meRowTop').value, half: $('#meRowHalf').checked }));
    store.set('gs.setup', JSON.parse(JSON.stringify(su)));   // the next new assignment starts from this, not from the last one saved
    meSet({ grade: { ...me().grade, setup: su } });
    if (!batch) setup = { ...DEFAULT_SETUP };
    setRender(); return toast('New rubrics score each row ' + rowsSay(su) + '.');
  }
  if (t.dataset.mebl != null || t.dataset.mebp != null) {
    const g = meGrade(); if (!g || !g.bands) return;
    const bands = g.bands.map((b, i) => { const l = $('[data-mebl="' + i + '"]'), p = $('[data-mebp="' + i + '"]'); return [i === g.bands.length - 1 ? 0 : Math.max(0, Math.min(100, Math.round(+p.value) || 0)), (l.value.trim() || b[1]).slice(0, 12)]; });
    meSet({ grade: { ...me().grade, bands } }); setRender(); if (batch) { renderGrade(); }
  }
});
$('#setPane').addEventListener('click', async e => {
  const b = e.target.closest('[data-meway]'); if (!b) return;
  const way = gradeWay(b.dataset.meway), g = meGrade(); if (!way || (g && g.way === way[0])) return;
  if (!g && !await askDlg('Start new assignments with “' + way[1] + '”? Assignments you already have keep their own rubric and scale, and their scores do not change.', { ok: 'Use it' })) return;
  store.set('gs.setup', { ...JSON.parse(JSON.stringify(way[3])) });   // the next new assignment starts from this, not from the last one saved
  meSet({ grade: { way: way[0], setup: JSON.parse(JSON.stringify(way[3])), ...(way[4] ? { bands: way[4].map(x => x.slice()) } : {}) } });
  if (!batch) setup = { ...DEFAULT_SETUP };
  setRender(); toast('New assignments start with ' + way[1].toLowerCase() + ' from now on.');
});

sysWords();
// A brand-new browser is asked. One that looked at the sample class first is asked again from the card on Home.
if (fresh && !asked() && !lib.classes.length && routeNow().v === 'home' && !sampleOn()) wlOpen();
Object.assign(window.__gs, { wlOpen, wlShown, sampleRemove, me, meGrade, bandOf, sysName });
