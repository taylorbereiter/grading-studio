/* ---------------- today's classes on Home: a one-way read of the Planner's timetable ---------------- */
// The Planner keeps its timetable and its lessons in its own database. This opens that database only to read, never writes to it, and never
// makes it: with no Planner work in this browser, nothing shows. Class names, colours, times and lesson names are all it takes. Nothing of
// grading's goes the other way, and the Planner never opens grading's work.
let plan = null;   // { classes, daysOff, lessons } or null when there is no timetable
async function planRead() {
  const db = await planDb(false); let setup = null, lessons = [];
  if (db) {
    try { const t = db.transaction(['kv', 'lessons']); [setup, lessons] = await Promise.all([idbP(t.objectStore('kv').get('setup')), idbP(t.objectStore('lessons').getAll())]); } catch {}
    db.close();
  }
  const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#1F6FB2';
  const classes = (setup && Array.isArray(setup.classes) ? setup.classes : []).filter(c => c && c.id != null).map(c => ({ id: String(c.id), name: String(c.name || c.id), color: hex(c.color),
    meets: (Array.isArray(c.meets) ? c.meets : []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || '') })) }));
  plan = !classes.length ? null : {
    classes, semStart: String(setup.semStart || ''), semEnd: String(setup.semEnd || ''),
    daysOff: (Array.isArray(setup.daysOff) ? setup.daysOff : []).filter(d => d && d.date).map(d => ({ date: String(d.date), label: String(d.label || '') })),
    lessons: (Array.isArray(lessons) ? lessons : []).filter(l => l && l.id && Array.isArray(l.slots) && l.slots.length).map(l => ({ id: String(l.id), title: String(l.title || 'Untitled lesson'), status: String(l.status || ''), done: !!l.final, slots: l.slots.map(s => ({ classId: String(s.classId), date: String(s.date) })) })),
  };
  return plan;
}
const planUrl = h => $('#lessonsBtn').getAttribute('href') + (h || '');
const planTime = t => { const m = /^(\d{1,2}):(\d\d)$/.exec(t || ''); return m ? (+m[1] % 12 || 12) + ':' + m[2] : ''; };
// Today's meetings in the order they happen, each with the lesson planned for it, if there is one.
function todayRows(p, now) {
  const d = isoDay(now || Date.now()), dow = new Date(now || Date.now()).getDay(), off = p.daysOff.find(x => x.date === d);
  if (off) return { off: off.label || 'No school', rows: [] };
  const rows = [];
  for (const c of p.classes) for (const m of c.meets) if (m.dow === dow) rows.push({ c, m, lessons: p.lessons.filter(l => l.slots.some(s => s.classId === c.id && s.date === d)) });
  return { off: '', rows: rows.sort((a, b) => a.m.start.localeCompare(b.m.start)) };
}
function hsideShow() { $('#hside').hidden = $('#today').hidden && $('#needs').hidden; }
function renderToday() {
  const el = $('#today'); let h = '';
  if (plan) {
    const t = todayRows(plan), chip = l => l.done ? '<span class="schip ok">Finished</span>' : l.status === 'review' ? '<span class="schip on">Ready for you</span>' : l.status === 'claude' ? '<span class="schip on">With Claude</span>' : '<span class="schip">Draft</span>';
    const row = ({ c, m, lessons }) => {
      const l = lessons[0], more = lessons.length > 1 ? ' · and ' + (lessons.length - 1) + ' more' : '';
      return '<a class="nrow trow" href="' + esc(planUrl(l ? '#lesson/' + encodeURIComponent(l.id) : '#week')) + '" title="' + (l ? 'Open this lesson in the Planner' : 'Plan this class in the Planner') + '"><span class="tt">' + planTime(m.start) + '</span>' +
        '<span class="nt"><b><span class="rdot" style="background:' + c.color + '"></span>' + esc(c.name) + '</b><span class="ns">' + (l ? esc(l.title) + more : 'No lesson yet') + '</span></span>' + (l ? chip(l) : '<span class="btn sm">Plan it</span>') + '</a>';
    };
    h = '<section class="ncard"><div class="nhead"><h2>Today’s classes</h2><span class="sp"></span><a class="link tweek" href="' + esc(planUrl('#week')) + '">Open the week</a></div>' +
      (t.off ? '<div class="nrow"><span class="nt"><b>No classes today</b><span class="ns">' + esc(t.off) + '</span></span></div>' : t.rows.length ? t.rows.map(row).join('') : '<div class="nrow"><span class="nt"><span class="ns">No classes on your timetable today.</span></span></div>') + '</section>';
  }
  el.hidden = !h;
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  hsideShow();
}
// Read again whenever Home shows or she comes back to this tab: she may have planned a lesson in the Planner's tab meanwhile.
let planBusy = null;
function planRefresh() {
  if (planBusy) return planBusy;
  return planBusy = planRead().catch(() => { plan = null; }).then(() => { planBusy = null; renderToday(); if (shellReady) setRender(); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !batch) planRefresh(); });
window.addEventListener('pageshow', e => { if (e.persisted) planRefresh(); });
