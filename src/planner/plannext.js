/* ================= Plan next =================
   The top of the Plan lessons page: the lesson she was working on, and the classes coming up that have no lesson yet,
   so opening the Planner lands her on planning and not on finding a day in the calendar.
   It reads the timetable and the lessons, and stores nothing. */
const PN_DAYS = 14, PN_SHOW = 4, PN_RECENT = 3 * 864e5;
// Each meeting from now to two weeks ahead that has no lesson on it, soonest first. A class that has already ended today is left out.
function planGaps(now = new Date()) {
  const out = [], today = ymd(now), hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  for (let i = 0; i < PN_DAYS; i++) {
    const d = ymd(addDays(now, i)); if (dayOff(d)) continue;
    for (const { c, m } of meetingsOn(d)) {
      if (d === today && m.end && m.end <= hhmm) continue;
      if (!lessonsAt(c.id, d).length) out.push({ c, m, d });
    }
  }
  return out;
}
// The lesson she touched last, if it was in the last few days.
const planRecent = () => L.lessons.filter(l => !l.library && Date.now() - l.updated < PN_RECENT).sort((a, b) => b.updated - a.updated)[0] || null;
function planWhen(d) { const t = ymd(new Date()), n = ymd(addDays(new Date(), 1)); return d === t ? 'Today' : d === n ? 'Tomorrow' : shortDate(d); }
function planNextBar() {
  if (!L.setup) return '';
  const gaps = planGaps(), rec = planRecent();
  // One blue button on the page: carry on with a lesson from the last day or so, or else plan the next class without one.
  const keepOn = rec && Date.now() - rec.updated < 864e5;
  let h = '<section class="pl-next" aria-label="Plan next">';
  if (rec) {
    const slot = rec.slots.filter(s => s.date >= ymd(new Date())).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    h += '<div class="pn-row pn-rec"><span class="pn-k">Pick up where you left off</span><b>' + esc(rec.title) + '</b><span class="pn-w">' + (slot ? esc(className(slot.classId)) + ' · ' + planWhen(slot.date) : 'Not on the timetable') + '</span><span class="sp"></span>' +
      (pfReady ? pfBtnTag('data-pnfocus="l:' + esc(rec.id) + '"', pfOnIt(rec)) : '') + '<button class="btn sm' + (keepOn ? ' primary' : '') + '" data-open="' + rec.id + '">Continue</button></div>';
  }
  h += '<div class="pn-head"><h2>Coming up without a lesson</h2><span class="pn-sub">' + (gaps.length ? gaps.length + ' class' + (gaps.length === 1 ? '' : 'es') + ' in the next two weeks' : 'Every class in the next two weeks has a lesson.') + '</span></div>';
  gaps.slice(0, PN_SHOW).forEach((g, i) => {
    const k = esc(g.c.id) + '|' + g.d;
    h += '<div class="pn-row" style="--cc:' + esc(g.c.color || '#1F6FB2') + '"><span class="pn-dot"></span><b>' + esc(g.c.name) + '</b><span class="pn-w">' + planWhen(g.d) + ' · ' + hm(g.m.start) + '–' + hm(g.m.end) + (g.m.label ? ' · ' + esc(g.m.label) : '') + '</span><span class="sp"></span>' +
      '<button class="btn sm' + (!keepOn && i === 0 ? ' primary' : '') + '" data-new="' + k + '">Plan it</button>' + (pfReady ? pfBtnTag('data-pnfocus="n:' + k + '"') : '') + (L.lessons.length ? '<button class="btn sm ghost" data-attach="' + k + '">Use a lesson…</button>' : '') + '</div>';
  });
  if (gaps.length > PN_SHOW) h += '<p class="pn-more">' + (gaps.length - PN_SHOW) + ' more. The calendar below shows each week.</p>';
  return h + '</section>';
}
// Its Focus buttons: a focus session on the lesson to pick up, or on a new lesson made for that class and day (src/planner/plfocus.js).
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pnfocus]'); if (!b) return;
  const v = b.dataset.pnfocus, id = v.slice(2);
  if (v[0] === 'l') { const l = L.lessons.find(x => x.id === id); if (l) { pfStart(l); openLesson(l); } return; }
  const [c, d] = id.split('|');
  createLesson([{ classId: c, date: d }, ...partnerSlots(c, d)]).then(() => { pfStart(L.open); renderEditor(); }).catch(err => console.error(err));
});

// Library in the sidebar (units, past lessons, activities, rubrics): open or closed as she left it, kept in this page's own gsp.railLib.
function libFold(open, keep) {
  $('#railLib').setAttribute('aria-expanded', String(open)); $('#railLibBox').hidden = !open;
  if (keep) try { localStorage.setItem('gsp.railLib', open ? '1' : '0'); } catch { }
}
try { if (localStorage.getItem('gsp.railLib') === '1') libFold(true); } catch { }
