/* ---------------- what fills the sample: two made-up classes part-way through a term ----------------
   Not in the page. The build writes this out as sample.js, fetched when somebody opens the sample (src/sample.js), and squeezes
   it into the double-click copy. It runs once, in the sample's own storage (src/samplemode.js), with the page's own code handed
   to it as A, and makes everything the way a teacher would have: classes and rosters, assignments of each kind, papers with
   marks, comments and scores on them, the gradebook, attendance, seating, goals, to-dos, and a timetable with lessons.
   Every student, paper, school and link in here is invented. Dates are worked out from today, so the sample is always
   part-way through its term whenever it is opened. */
const SAMPLE = {};

SAMPLE.build = async function (A) {
  const lib = A.lib, uid = A.uid;
  /* a steady source of chance, so the sample is the same every time */
  let seed = 0x5A3C91;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* days: everything is counted from today */
  const DAY = 864e5, now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plus = (d, n) => new Date(d.getTime() + n * DAY);
  const monday = d => plus(d, -((d.getDay() + 6) % 7));
  const wk = monday(today);                       // this week's Monday
  const day = n => iso(plus(today, n));           // n days from today
  // The nearest school day on or before n days from today.
  const school = n => { let d = plus(today, n); while (d.getDay() === 0 || d.getDay() === 6) d = plus(d, -1); return iso(d); };
  const at = (n, h) => plus(today, n).setHours(h || 15, 20, 0, 0);   // a time on that day, for "when this was last changed"
  const TERM1 = { id: 't1', name: 'Term 1', start: iso(plus(wk, -70)), end: iso(plus(wk, 46)) };
  const TERM2 = { id: 't2', name: 'Term 2', start: iso(plus(wk, 49)), end: iso(plus(wk, 49 + 18 * 7 + 4)) };

  /* the two classes */
  const ENG = ['Maya Okafor', 'Liam Chen', 'Sofia Reyes', 'Noah Patel', 'Aiko Tanaka', 'Daniel Kim', 'Amara Diallo', 'Lucas Meyer', 'Priya Nair', 'Ethan Brooks', 'Zara Ahmed', 'Mateo Silva', 'Hana Novak', 'Oliver Grant'];
  const ENG_LEVEL = [.93, .78, .88, .55, .97, .70, .82, .48, .90, .62, .74, .58, .85, .40];   // how each made-up student tends to do
  const SCI = ['Ines Castillo', 'Tomas Berg', 'Leila Haddad', 'Jonah Whitfield', 'Mei Sato', 'Kofi Mensah', 'Elena Petrova', 'Ravi Menon', 'Chloe Dubois', 'Samir Rahman'];
  const SCI_LEVEL = [.85, .55, .92, .45, .78, .66, .88, .72, .60, .50];
  const eng = { id: 'smp-eng', name: 'English 9', names: ENG.slice(), units: [] };
  const sci = { id: 'smp-sci', name: 'Science 8', names: SCI.slice(), way: 'myp', ib: { group: 'sci' }, units: [] };

  /* learning goals, tagged on rubric rows and quiz questions */
  const GOALS = [['smp-g1', 'Make a clear claim'], ['smp-g2', 'Support a claim with evidence'], ['smp-g3', 'Write clear, correct sentences'], ['smp-g4', 'Use new vocabulary accurately'], ['smp-g5', 'Explain how an author builds meaning']];
  lib.goals = GOALS.map(([id, name], i) => ({ id, name, at: at(-70) + i }));

  /* scores that follow each student's level, with a little chance in them */
  const lv = (i, wobble, levels) => clamp((levels || ENG_LEVEL)[i] + (rnd() - .5) * (wobble == null ? .18 : wobble), .12, 1);
  const pts = (max, x) => Math.round(max * x * 2) / 2 > max ? max : Math.round(max * x);
  const item = (c, key, name, more) => ({ id: 'smp-' + key, sampleKey: key, name, classId: c.id, ...more });
  // An assignment with scores typed in and no papers behind it. vals: a number for each student, 'm' missing, 'e' excused, null not in yet.
  const typed = (names, max, vals) => ({ max, s: Object.fromEntries(names.map((n, i) => [n, vals[i]]).filter(x => x[1] != null).map(([n, v]) => [n, v === 'm' ? { v: null, st: 'missing' } : v === 'e' ? { v: null, st: 'excused' } : typeof v === 'object' ? v : { v }])) });
  const scores = (max, wobble, swap) => ENG.map((_, i) => (swap && swap[i] !== undefined) ? swap[i] : pts(max, lv(i, wobble)));

  const RUB3 = { mode: 'rubric', criteria: ['Claim', 'Evidence', 'Writing'], outOf: 10, scale: null, goals: ['smp-g1', 'smp-g2', 'smp-g3'],
    levels: [{ 4: 'A clear claim that the whole paragraph argues for', 3: 'A clear claim', 2: 'A claim, but the paragraph wanders from it', 1: 'A topic, not yet a claim' },
      { 4: 'Specific evidence, explained', 3: 'Specific evidence', 2: 'General reasons, little evidence', 1: 'Opinion only' },
      { 4: 'Controlled sentences, no errors that distract', 3: 'Clear, a few errors', 2: 'Errors slow the reader', 1: 'Hard to follow' }] };
  const RUB4 = { mode: 'rubric', criteria: ['Claim', 'Evidence', 'Organization', 'Language'], outOf: 10, scale: null, goals: ['smp-g1', 'smp-g2', '', 'smp-g3'],
    levels: [{ 4: 'An arguable claim, kept in view throughout', 3: 'A clear claim', 2: 'A claim that shifts or fades', 1: 'A topic, not yet a claim' },
      { 4: 'Well-chosen evidence, explained and weighed', 3: 'Relevant evidence, explained', 2: 'Some evidence, little explanation', 1: 'Reasons without evidence' },
      { 4: 'Each paragraph does one job and leads to the next', 3: 'Clear paragraphs in a sensible order', 2: 'Paragraphs, but the order is hard to follow', 1: 'No clear paragraphs' },
      { 4: 'Precise words and varied, correct sentences', 3: 'Clear sentences, a few errors', 2: 'Errors slow the reader', 1: 'Hard to follow' }] };
  const RUBS = { mode: 'rubric', criteria: ['Understanding', 'Evidence', 'Language'], outOf: 10, scale: null, goals: ['smp-g5', 'smp-g2', 'smp-g3'],
    levels: [{ 4: 'Explains how the author’s choices build meaning', 3: 'Explains what the story means', 2: 'Retells with some explanation', 1: 'Retells the story' },
      { 4: 'Short, well-chosen quotations, explained', 3: 'Quotations that fit', 2: 'Refers to the story in general', 1: 'No reference to the story' },
      { 4: 'Precise words and varied, correct sentences', 3: 'Clear sentences, a few errors', 2: 'Errors slow the reader', 1: 'Hard to follow' }] };

  eng.units = [
    { id: 'smp-u1', name: 'Unit 1: Persuasion', items: [
      item(eng, 'rc1', 'Reading check 1', { type: 'ic', due: school(-63), typed: typed(ENG, 10, scores(10, .2)) }),
      item(eng, 'exit1', 'Exit ticket: claim or topic?', { type: 'fm', due: school(-58), typed: { max: null, s: Object.fromEntries(ENG.filter((_, i) => i !== 7 && i !== 13).map(n => [n, { v: null, st: '', fb: true }])) } }),
      item(eng, 'para', 'Persuasive paragraph', { type: 'ic', due: school(-49), setup: RUB3 }),
      item(eng, 'quiz', 'Vocabulary quiz 1', { type: 'ic', due: school(-42), setup: { mode: 'points', criteria: ['Criterion 1'], outOf: 10, scale: null } }),
      item(eng, 'kahoot', 'Review game', { type: 'xc', due: school(-40), typed: typed(ENG, null, ENG.map((_, i) => [0, 4, 8].includes(i) ? 2 : [2, 6, 10].includes(i) ? 1 : null)) }),
      item(eng, 'essay', 'Persuasive essay', { type: 'sum', due: school(-28), setup: RUB4 }),
    ] },
    { id: 'smp-u2', name: 'Unit 2: Short stories', items: [
      item(eng, 'rc2', 'Reading check 2', { type: 'ic', due: school(-21), typed: typed(ENG, 10, scores(10, .2, { 3: { v: 9, tries: [5] }, 9: { v: 8, tries: [6] }, 13: 'm' })) }),
      item(eng, 'exit2', 'Exit ticket: point of view', { type: 'fm', due: school(-17), typed: { max: null, s: Object.fromEntries(ENG.filter((_, i) => i !== 3).map(n => [n, { v: null, st: '', fb: true }])) } }),
      item(eng, 'poster', 'Story elements poster', { type: 'ic', due: school(-14), setup: { mode: 'points', criteria: ['Criterion 1'], outOf: 20, scale: null } }),
      item(eng, 'talk', 'Book talk', { type: 'ic', due: school(-9), typed: typed(ENG, 20, scores(20, .16, { 7: 'm', 11: 'e' })) }),
      item(eng, 'story', 'Story analysis', { type: 'sum', due: school(-3), setup: RUBS }),
      item(eng, 'quiz2', 'Vocabulary quiz 2', { type: 'ic', due: school(4) }),
    ] },
  ];

  /* Science 8: an IB MYP class, marked by criterion */
  const mlv = i => Math.round(clamp(SCI_LEVEL[i] * 8 + (rnd() - .5) * 2.4, 1, 8));
  const task = (key, name, due, crit, skip) => item(sci, key, name, { type: 'sum', due, crit, typed: { lv: true, s: Object.fromEntries(SCI.map((n, i) => [n, { l: Object.fromEntries(crit.map(k => [k, mlv(i)])) }]).filter((_, i) => !(skip || []).includes(i))) } });
  sci.units = [
    { id: 'smp-s1', name: 'Unit 1: Cells', items: [task('cells', 'Cells lab report', school(-60), ['B', 'C', 'D']), task('test1', 'Cells unit test', school(-45), ['A'])] },
    { id: 'smp-s2', name: 'Unit 2: Forces and motion', items: [task('ramp', 'Ramp investigation', school(-24), ['B', 'C']), task('news', 'Seat belts: science in the news', school(-12), ['D'], [3]), task('test2', 'Forces quiz', school(-5), ['A'], [1, 9])] },
  ];
  // The teacher's own best-fit level for the term, for most of the class: close to the latest evidence, never an average.
  const fit = (n, k) => { let v = null; for (const u of sci.units) for (const x of u.items) { const r = x.typed.s[n]; if (r && r.l[k] != null) v = r.l[k]; } return v; };
  sci.lv = { t1: Object.fromEntries(SCI.slice(0, 7).map(n => [n, { ...Object.fromEntries(['A', 'B', 'C', 'D'].map(k => [k, fit(n, k)]).filter(x => x[1] != null)), t: at(-2) }])) };

  /* what a teacher knows about each student, where they sit, and who was here */
  const mail = n => n.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@students.example.org';
  eng.info = Object.fromEntries(ENG.map((n, i) => [n, { id: String(240100 + i * 7), email: mail(n) }]));
  Object.assign(eng.info['Lucas Meyer'], { note: 'Works best with a checklist. Check in at the start of independent work.' });
  Object.assign(eng.info['Aiko Tanaka'], { note: 'Ready for extension reading. Likes to help a partner.' });
  Object.assign(eng.info['Oliver Grant'], { note: 'Joined in week 3. Seat near the front.', other: ['Ollie Grant'] });
  sci.info = Object.fromEntries(SCI.map((n, i) => [n, { id: String(250200 + i * 9), email: mail(n) }]));
  const seat = (c, kind, order) => { const r = A.seatRoom(kind, c.names.length); c.seats = { w: r.w, h: r.h, desks: Object.fromEntries(r.cells.map((k, i) => [k, order[i] || ''])) }; };
  seat(eng, 'pairs', [13, 7, 0, 3, 4, 9, 2, 11, 6, 1, 8, 5, 10, 12].map(i => ENG[i]));
  seat(sci, 'tables', SCI);
  // Attendance on each day the class met in the last five weeks: nearly everyone is nearly always here.
  const MEETS = { eng: [1, 2, 4, 5], sci: [1, 3, 4] };
  const attend = (c, dows, levels) => {
    c.att = {};
    for (let n = -35; n < 0; n++) {
      const d = plus(today, n); if (!dows.includes(d.getDay())) continue;
      const m = {}, note = {};
      c.names.forEach((name, i) => { const r = rnd(), shaky = levels[i] < .56; if (r < (shaky ? .1 : .025)) m[name] = rnd() < .5 ? 'a' : 'e'; else if (r < (shaky ? .2 : .06)) m[name] = 'l'; });
      c.att[iso(d)] = { t: d.getTime(), m, n: note };
    }
  };
  attend(eng, MEETS.eng, ENG_LEVEL); attend(sci, MEETS.sci, SCI_LEVEL);
  { const d = Object.keys(eng.att).sort().slice(-3)[0]; if (d) { eng.att[d].m['Lucas Meyer'] = 'e'; eng.att[d].n['Lucas Meyer'] = 'Dentist, note from home'; } }

  lib.classes.push(eng, sci);
  lib.book = { terms: [TERM1, TERM2], w: { sum: 50, ic: 50, fm: 0 } };
  lib.me = { sys: '', unit: '', ai: '', grade: { way: 'rubric', setup: { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null } }, hi: Date.now() };

  /* the teacher's own to-do list */
  const todo = (x, d, more) => ({ id: 'smp-td' + uid(), x, d, c: '', who: '', a: '', rep: '', note: '', done: 0, made: at(-6), t: at(-6), ...more });
  lib.todo = { items: [
    todo('Photocopy the short story for Thursday', day(0), { c: eng.id }),
    todo('Email Lucas’s family about the missing book talk', day(-1), { c: eng.id, who: 'Lucas Meyer', a: 'smp-talk', note: 'Second reminder. Offer Tuesday lunch to record it.' }),
    todo('Book the lab for the friction practical', day(2), { c: sci.id }),
    todo('Report comments due to the office', day(9), { note: 'English 9 first, then Science 8.' }),
    todo('Check homework diaries', day(1), { c: eng.id, rep: 'week' }),
    todo('Order new whiteboard pens', '', {}),
    todo('Set up the seating chart for Science 8', day(-8), { c: sci.id, done: at(-7), t: at(-7) }),
  ] };
  A.saveLib();

  /* links and notes about the school (all made up) */
  const sch = (name, more) => ({ id: 'smp-sc' + uid(), at: at(-30), kind: 'link', name, group: '', note: '', ...more });
  A.store.set('gs.school', { items: [
    sch('Staff handbook', { url: 'https://school.example.org/staff/handbook', group: 'Policies', pin: true }),
    sch('School calendar', { url: 'https://school.example.org/calendar', group: 'Dates', pin: true }),
    sch('Bell schedule', { kind: 'note', group: 'Dates', note: 'Period 1  9:00 to 10:20\nBreak  10:20 to 10:40\nPeriod 2  10:40 to 12:00\nLunch  12:00 to 13:10\nPeriod 3  13:10 to 14:30' }),
    sch('Report a broken projector', { url: 'https://school.example.org/helpdesk', group: 'Who to ask', note: 'Or call the office, extension 104.' }),
    sch('English 9 reading list', { url: 'https://library.example.org/lists/english-9', group: 'Teaching', cls: ['English 9'] }),
    sch('Lab safety rules', { url: 'https://school.example.org/science/lab-safety', group: 'Teaching', cls: ['Science 8'] }),
  ] });

  A.say('Writing the papers…');
  await SAMPLE.papers(A, { eng, ENG, ENG_LEVEL, rnd, pick, clamp, at, lv, RUB3, RUB4, RUBS });
  A.say('Planning the lessons…');
  await SAMPLE.planner(A, { eng, sci, wk, today, iso, plus, at, MEETS, TERM1, TERM2 });

  /* report comments already written for a few students, and reminders already sent about missing work */
  const REP = {
    'Maya Okafor': 'Maya has had an excellent term. Her persuasive essay kept its claim in view from the first line to the last, and her story analysis shows she can read a single word closely. Next term I would like her to weigh the other side of an argument in more depth.',
    'Liam Chen': 'Liam has worked steadily this term and his reading checks show he understands what he reads. His writing is clear. To move up, he should explain how his evidence proves his point instead of leaving it to speak for itself.',
    'Sofia Reyes': 'Sofia has had a strong term and is a generous partner in group work. Her story analysis was among the best in the class. Her next step is to plan her paragraphs before she writes, so each one does a single job.',
    'Noah Patel': 'Noah contributes well in discussion and did his best work this term on the group poster. In writing he needs to slow down: one clear claim, then the evidence for it. We will keep practising this together next term.',
    'Aiko Tanaka': 'Aiko has had an outstanding term. Her essay was used as a model for the class, and she reads with real care. I have given her extension reading for next term and look forward to what she makes of it.',
  };
  for (const [n, text] of Object.entries(REP)) Object.assign(eng.info[n], { pro: /\b[Hh]er\b|\bshe\b/.test(text) ? 'she' : 'he', rep: { t1: { text, done: true, t: at(-2) } } });
  const col = k => { for (const u of eng.units) for (const x of u.items) if (x.sampleKey === k) return x.id; };
  eng.info['Lucas Meyer'].nudge = { [col('talk')]: at(-6) };
  eng.info['Oliver Grant'].nudge = { [col('rc2')]: at(-15) };
  A.saveLib();
};

/* ---------------- papers: written here, then marked the way a teacher marks them ---------------- */
// A paper's words carry their own marks, written into the text:
//   {h:words|comment}  a highlight, with a comment in the margin when there is one     {u:words|comment}  underlined in pen
//   {c:words|comment}  circled in pen     {sp:word} {gr:…} {frag:…} {ro:…}  a proofreading mark over the words     {+}  a check mark here
SAMPLE.papers = async function (A, S) {
  const { PDFDocument, StandardFonts, rgb } = A.PDFLib, { eng, ENG, ENG_LEVEL, rnd, clamp, at } = S;
  const PW = 612, PH = 792, LEFT = 72, RIGHT = 540, RED = A.COLORS.red, r1 = v => Math.round(v * 10) / 10;
  const first = n => n.split(' ')[0], tier = i => ENG_LEVEL[i] > .85 ? 0 : ENG_LEVEL[i] > .7 ? 1 : ENG_LEVEL[i] > .55 ? 2 : 3;
  const PROOFS = ['sp', 'gr', 'frag', 'ro', 'wc', 'awk', 'vt', 'cap'];

  // One paper: a heading, a title and paragraphs. Gives back the PDF and where each mark goes, a list for each page.
  async function paper(name, head, title, paras) {
    const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.TimesRoman), bold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const SIZE = 12.5, LEAD = 26, marks = {}; let pg = doc.addPage([PW, PH]), pn = 0, y = 150;
    const put = (t, x, top, size, f) => pg.drawText(t, { x, y: PH - top, size, font: f || font, color: rgb(.1, .1, .12) });
    put(name, LEFT, 62, 11); put(head, LEFT, 78, 11); put(title, LEFT, 118, 15, bold);
    const add = m => (marks[pn] ||= []).push(m);
    for (const para of paras) {
      // the words, each knowing which mark it is under
      const words = [], spans = []; let last = 0;
      const plain = (t, sp) => { for (const w of t.split(/\s+/).filter(Boolean)) words.push({ w, sp }); };
      para.replace(/\{([a-z+]+)(?::([^|}]*))?(?:\|([^}]*))?\}/g, (m, k, t, note, i) => {
        plain(para.slice(last, i)); last = i + m.length;
        if (k === '+') { if (words.length) words[words.length - 1].check = true; return ''; }
        spans.push({ k, note: note || '', rects: [] }); plain(t || '', spans.length - 1);
        return '';
      });
      plain(para.slice(last));
      // punctuation written straight after a mark belongs to the word before it
      for (let i = words.length - 1; i > 0; i--) if (/^[.,;:!?]+$/.test(words[i].w)) { words[i - 1].w += words[i].w; words.splice(i, 1); }
      let x = LEFT + 24, line = [];
      const flush = () => {
        for (const w of line) { put(w.w, w.x, y, SIZE); if (w.check) add({ t: 'check', color: A.CHECK_INK(), x: r1(Math.min(w.x + w.wd + 12, PW - 30)), y: r1(y - 5), size: 18 }); }
        // each marked run on this line is one box
        for (let i = 0; i < line.length; i++) { const sp = line[i].sp; if (sp == null) continue; let j = i; while (j + 1 < line.length && line[j + 1].sp === sp) j++; spans[sp].rects.push({ p: pn, x: r1(line[i].x - 1), y: r1(y - 11), w: r1(line[j].x + line[j].wd - line[i].x + 2), h: 15 }); i = j; }
        line = [];
      };
      for (const w of words) {
        w.wd = font.widthOfTextAtSize(w.w, SIZE);
        if (x + w.wd > RIGHT && line.length) { flush(); x = LEFT; y += LEAD; if (y > 730) { pg = doc.addPage([PW, PH]); pn++; y = 90; } }
        w.x = x; line.push(w); x += w.wd + font.widthOfTextAtSize(' ', SIZE);
      }
      flush();
      for (const sp of spans) {
        if (!sp.rects.length) continue;
        const was = pn; pn = sp.rects[0].p;
        const rs = sp.rects.filter(r => r.p === pn).map(({ x, y, w, h }) => ({ x, y, w, h })), end = rs[rs.length - 1], box = { x: Math.min(...rs.map(r => r.x)), y: rs[0].y, w: 0, h: 0 };
        box.w = r1(Math.max(...rs.map(r => r.x + r.w)) - box.x); box.h = r1(end.y + end.h - box.y);
        if (sp.k === 'h') {
          if (sp.note) add({ t: 'note', color: RED, ax: r1(end.x + end.w), ay: r1(end.y + end.h), hl: box, hc: A.HL.yellow, text: sp.note, ...(rs.length > 1 ? { rects: rs } : {}) });
          else add({ t: 'hl', color: A.HL.yellow, ...box, ...(rs.length > 1 ? { rects: rs } : {}) });
        } else {
          for (const r of rs) {
            if (sp.k === 'c') { const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 1, a = r.w / 2 + 5, b = r.h / 2 + 3, pts = []; for (let k = 0; k <= 26; k++) { const th = -2.2 + k / 24 * Math.PI * 2; pts.push([r1(cx + Math.cos(th) * (a + (rnd() - .5) * 1.6)), r1(cy + Math.sin(th) * (b + (rnd() - .5) * 1.4))]); } add({ t: 'pen', color: RED, w: 1.8, pts }); }
            else { const pts = []; for (let px = r.x; px <= r.x + r.w; px += 7) pts.push([r1(px), r1(r.y + r.h + 1 + (rnd() - .5) * 1.5)]); pts.push([r1(r.x + r.w), r1(r.y + r.h + 1)]); add({ t: 'pen', color: RED, w: 1.8, pts }); }
          }
          if (PROOFS.includes(sp.k)) add({ t: 'stamp', k: sp.k, x: r1(rs[0].x + Math.min(rs[0].w / 2, 40)), y: r1(rs[0].y - 9), size: 16, color: RED });
          if (sp.note) add({ t: 'note', color: RED, ax: r1(end.x + end.w), ay: r1(end.y + end.h), text: sp.note });
        }
        pn = was;
      }
      y += LEAD + 8; if (y > 730) { pg = doc.addPage([PW, PH]); pn++; y = 90; }
    }
    return { data: await doc.save(), marks };
  }

  const it = key => { for (const u of eng.units) for (const x of u.items) if (x.sampleKey === key) return x; };
  // Opens one assignment's papers, lets fn mark them, and saves. made: { roster name: { data, marks } }.
  async function open(key, made, fn) {
    const card = it(key), files = Object.entries(made).map(([n, p]) => ({ path: n + '/' + card.name + '.pdf', data: p.data }));
    await A.intake(files, card.name, card);
    const b = A.batch; if (!b) throw new Error('The papers for ' + card.name + ' did not open');
    await A.papersKept();   // the papers are in the browser's storage before the first save, so the list of work knows it has them
    const of = n => b.students.find(s => s.key === n);
    await fn(b, of);
    A.groupSync();
    await A.saveNow(); await A.settle();
    A.closeDownload();
    await new Promise(r => setTimeout(r, 60));
  }
  const grade = (st, g, t) => { st.grade = { rubric: [], points: '', comment: '', ...g, at: t }; };
  // The marks the paper was written with go on, and the score is stamped at the top.
  const mark = (st, made, stamp) => {
    const f = st.files[0]; if (!f) return;
    f.marks = JSON.parse(JSON.stringify(made.marks));
    if (stamp === false) return;
    const gr = A.gradeOf(st); if (gr.total == null) return;
    (f.marks[0] ||= []).push({ t: 'stamp', k: 'score', text: A.scoreStampText(gr, st), x: 486, y: 84, size: 52, color: A.totalInk() });
  };
  // Rubric rows from a student's level: half points now and then, never all the same.
  const rows = (i, n, lift) => Array.from({ length: n }, (_, k) => clamp(Math.round((ENG_LEVEL[i] * 4 + (lift || 0) + (rnd() - .5) * 1.1 + (k === 0 ? .2 : 0)) * 2) / 2, 1, 4));

  /* 1. Persuasive paragraph: one page each, all marked and handed back */
  const PARA = {
    0: ['Later starts would help students learn', 'Teenagers need {h:about nine hours of sleep|A precise fact to open with.}, and most of us do not get it. When school starts at 7:45, the first lesson is spent waking up. {h:A study of schools in Seattle found that students slept 34 minutes longer|Strong evidence. Say where you found it.} after the start moved to 8:45, and their grades in the first class of the day went up.{+} A later start would cost nothing in lessons, because the day would simply end later. For these reasons our school should start at 8:45.'],
    1: ['Why 8:45 is better', 'First, sleep. {frag:Second, safety,} because fewer students would walk to school in the dark. Third, breakfast. Students who eat breakfast concentrate for longer, and at the moment {u:many of us skip it|How many? A number would help.} to catch the bus. Each of these reasons would be enough by itself.{+} Together they make a clear case, and the only cost is a later finish.'],
    2: ['The school day should not change', '{h:Starting later sounds good, but it moves the problem instead of solving it.|A clear claim that takes on the other side.} Students who stay up late would stay up later still. Practices, jobs and younger brothers and sisters all depend on the afternoon, and a later finish takes that time away. A survey of our own year group showed that {c:61 percent} have something they must be at by four o’clock.{+} The better answer is a firm bedtime, which costs nothing and changes no timetable.'],
    3: ['School should start later', 'I think school should start later because {u:everyone is tired|Everyone? How do you know?}. My brother is always tired. Also the bus comes too early and it is dark in winter. {u:Some people say we would get home late but I do not think that matters.|Why not? Answer them.} Teachers would like it too. So school should start later.'],
    4: ['A later start: the evidence', 'There is strong evidence that a later start improves attendance. {h:In one district, lateness to the first lesson fell by a quarter after the change.|Specific and relevant.} However, the evidence on grades is mixed, and the writer of our article admits this.{+} I would start the school day later, but only by thirty minutes, and {h:I would look at the attendance figures after one term before deciding to keep it|A careful, honest conclusion.}.'],
    5: ['Start later, learn more', 'School should start at nine. Most students in my class go to bed after eleven, {sp:becuase} of homework and practice. That means we get less than eight hours of sleep. {u:Scientists say|Which scientists? Name the study.} teenagers need more than that. If we started later we would be more awake in first period and our marks would improve. It would also be safer for students who cycle.'],
    6: ['Keep the early start', 'An early start is better for families. {h:In our town most parents begin work at eight|Good local evidence.}, so a nine o’clock start would leave younger students waiting alone. Clubs and sports would finish after dark in winter. {u:It is true that teenagers are tired in the morning, but that can be solved at home}.{+} Changing the whole timetable for one problem is not sensible.'],
    7: ['Later start', 'School should start later. I am tired. {u:It is to early.|to / too} We should start at ten. Then I could sleep. {u:That is my opinion.|Now give me one reason someone else would believe.}'],
    8: ['Sleep is not a luxury', '{h:Sleep is part of learning, not a break from it.|A memorable first line.} During sleep the brain sorts what it learned that day, so a tired student remembers less. Our first lesson starts at 7:45, when {u:doctors say a teenager’s body still thinks it is night|Where does this come from?}. Moving the start to 8:45 would cost nothing and would give every student one more hour of real learning.{+}'],
    9: ['Later is better', 'School {gr:start} too early. I am tired every morning and so are my friends. {u:When your tired you can’t think.|Check: your / you’re.} If school started later we could sleep more and do better in tests. Some schools already did this and {u:it worked|What happened there?}. So I think we should do it too.'],
    10: ['One hour would change the morning', 'A later start would make mornings calmer. At the moment I leave home at 6:50 and eat breakfast on the bus. {u:Lots of students do the same|A quick survey would prove this.}. With one more hour we could eat properly and arrive ready to work. {h:Schools that changed their start time reported fewer late arrivals|Good. Which schools?}, which means less lesson time is lost.'],
    11: ['Why I want a later start', 'I want school to start later. {ro:The bus is at seven and I get up at six and it is dark and cold} and nobody talks in first period. {u:I think we would learn more|Why? Give a reason.}. My cousin’s school starts at nine and he likes it. Teachers are tired too. That is why I want a later start.'],
    12: ['Time to wake up', 'The first lesson of the day is the least useful one, because half the class is still half asleep.{+} {h:In a survey of my tutor group, 19 of 24 students said they find period one the hardest to concentrate in.|You collected your own evidence. Excellent.} Starting at 8:45 would move learning to a time when we can actually do it. The day would end later, but {u:an hour of real attention is worth more than an hour of yawning}.'],
  };
  const PARA_SAY = [
    n => 'A convincing paragraph, ' + n + '. Your claim is clear from the first line and you back it with specific evidence. Next time, say where your evidence comes from.',
    n => 'A clear opinion and some good reasons, ' + n + '. To move up, swap one general reason for a specific fact or number, and explain how it supports your claim.',
    n => 'You have a clear view, ' + n + ', and the start of an argument. Next step: one piece of evidence a reader could check, with a sentence that explains it.',
    n => 'You have a view, ' + n + ', and that is the place to start. Let’s add one reason and one piece of evidence together. Come and see me if you would like to redo this.',
  ];
  A.say('Marking the persuasive paragraphs…');
  {
    const made = {}; for (const [i, [title, text]] of Object.entries(PARA)) made[ENG[i]] = await paper(ENG[i], 'English 9 · Persuasive paragraph: should the school day start later?', title, [text]);
    await open('para', made, async (b, of) => {
      for (const i of Object.keys(PARA)) { const st = of(ENG[i]); grade(st, { rubric: rows(+i, 3), comment: PARA_SAY[tier(+i)](first(ENG[i])) }, at(-46)); mark(st, made[ENG[i]]); }
      grade(of('Oliver Grant'), { status: 'excused', comment: 'Joined the class after this was set.' }, at(-46));
      b.returned = { t: at(-45), n: 13 };
    });
  }

  /* 2. Vocabulary quiz 1: marked a question at a time with Quick mark, with the answers noted where points were lost */
  A.say('Marking the vocabulary quiz…');
  {
    const QS = [
      ['1', 'To convince someone to agree with you is to ______ them.', 1, 'persuade', ['persuade', 'argue', 'explain']],
      ['2', 'A statement that someone could disagree with is a ______.', 1, 'claim', ['claim', 'fact', 'topic']],
      ['3', 'Facts, numbers and examples that support a claim are called ______.', 1, 'evidence', ['evidence', 'opinions', 'details']],
      ['4', 'The view of the other side is the ______.', 1, 'counter-argument', ['counter-argument', 'disagreement', 'opposite']],
      ['5', 'Use “credible” in a sentence that shows what it means.', 2, 'A sentence where credible means “can be trusted”', ['I am credible at football.', 'The news was credible.', 'The website is credible because experts wrote it and it lists its sources.']],
      ['6', 'Explain the difference between a fact and an opinion. Give an example of each.', 4, 'A fact can be checked. An opinion is what someone thinks. One example of each.', ['Facts are real.', 'Facts are real and opinions are not.', 'A fact is true. An opinion is what you think.', 'A fact is true and can be proved. An opinion is what you think, like pizza is the best food.', 'A fact can be checked, like “our school has 600 students”. An opinion is what someone thinks, like “600 students is too many”.']],
    ];
    const tops = [150, 222, 294, 366, 438, 546], tall = [60, 60, 60, 60, 96, 150];
    const qs = QS.map(([lab, , p, key], k) => ({ id: 'smpq' + (k + 1), lab, n: 0, x: r1(54 / PW * 1000) / 1000, y: Math.round(tops[k] / PH * 1000) / 1000, w: Math.round(504 / PW * 1000) / 1000, h: Math.round(tall[k] / PH * 1000) / 1000, pts: p, key, how: p > 1 ? 'pts' : 'cx', kind: p > 1 ? 'scale' : 'rw', ...(k < 4 ? { goal: 'smp-g4' } : {}) }));
    const got = i => QS.map(([, , p], k) => p === 1 ? (rnd() < ENG_LEVEL[i] + .08 ? 1 : 0) : clamp(Math.round(ENG_LEVEL[i] * p + (rnd() - .5) * (p === 2 ? .9 : 1.3)), 0, p));
    const made = {}, marks = {};
    for (let i = 0; i < ENG.length; i++) {
      if (i === 5) continue;   // one student was away on quiz day
      const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), hand = await doc.embedFont(StandardFonts.CourierOblique), pg = doc.addPage([PW, PH]);
      const put = (t, x, top, size, f, c) => pg.drawText(t, { x, y: PH - top, size, font: f || font, color: c || rgb(.1, .1, .12) });
      put('Vocabulary quiz 1: the words of persuasion', LEFT, 70, 15, bold); put('Name:', LEFT, 100, 11); put(ENG[i], LEFT + 38, 100, 12, hand, rgb(.1, .2, .55)); put('10 points', 400, 100, 11);
      const v = marks[ENG[i]] = got(i);
      QS.forEach(([lab, q, p, , ans], k) => {
        put(lab + '.', LEFT, tops[k] + 20, 11.5, bold); put(q + (p > 1 ? '  (' + p + ' points)' : ''), LEFT + 20, tops[k] + 20, 11.5);
        const a = p === 1 ? (v[k] ? ans[0] : ans[1 + (i + k) % 2]) : ans[p === 2 ? v[k] : v[k]]; let line = '', yy = tops[k] + 46;
        for (const w of a.split(' ')) { if (hand.widthOfTextAtSize(line + w, 12) > 440) { put(line.trim(), LEFT + 20, yy, 12, hand, rgb(.1, .2, .55)); yy += 22; line = ''; } line += w + ' '; }
        put(line.trim(), LEFT + 20, yy, 12, hand, rgb(.1, .2, .55));
      });
      made[ENG[i]] = { data: await doc.save(), marks: {} };
    }
    await open('quiz', made, async (b, of) => {
      b.quiz = { qs, how: 'cx', ans: 'miss', side: 'right', total: { n: 0, x: Math.round(500 / PW * 1000) / 1000, y: Math.round(92 / PH * 1000) / 1000 } };
      for (const n of Object.keys(made)) { const st = of(n); for (let k = 0; k < qs.length; k++) await A.quizSet(st, qs[k], marks[n][k]); st.grade.at = at(-40); }
      grade(of('Daniel Kim'), { status: 'excused', comment: 'Away on quiz day.' }, at(-40));
      b.returned = { t: at(-39), n: 13 };
    });
  }

  /* 3. Persuasive essay: the summative, every paper marked, with a high, a middle and a low paper tagged */
  const ESSAY = {
    I: ['Almost every student in our school carries a phone, and almost every teacher has a rule about it. {h:The question is not whether phones are powerful, but whether a classroom is the right place for them.|A focused way in.} I will argue that phones should stay in bags during lessons unless a teacher asks for them, because attention is the one thing a lesson cannot do without.',
      'Phones are part of daily life, so it is not surprising that students want them in class. However, {h:a phone that is on the desk is a phone that is being checked|A clear claim.}. In this essay I will argue that phones should be put away in lessons, with a few exceptions.',
      'Many people have different opinions about phones in school. Some think they help and some think they do not. {u:In this essay I will talk about phones.|State your claim here: what do YOU think?} I think they should mostly be banned in lessons.',
      'Phones are good and bad. {u:Everyone has one.|Is this your claim? Tell me what you will argue.} I think we should be allowed them {sp:sometimes} but not always.'],
    B: ['The strongest reason is attention. {h:In one study, students who left their phones in another room remembered more of a lecture than students whose phones were face down on the desk.|Well chosen. Now explain why it matters for us.} Even a silent phone takes up part of the mind, because part of us is waiting for it.{+}',
      'Phones also change how students treat each other. When a message arrives, the person next to you loses your attention. {u:Group work is slower and less friendly when one person keeps looking down.|True. Can you add an example?} A lesson is one of the few places where thirty people look at the same thing.',
      'Some people argue that phones are useful tools, and they are right. A phone can be a calculator, a dictionary and a camera for the board. {h:But a tool is something you pick up for a job and put down again.|A strong answer to the other side.} If the teacher asks for phones, they are a tool; if not, they are a temptation.{+}',
      'Another reason is fairness. {u:Not everyone has the newest phone, and some students have none.|Good point. Who is left out, and how?} When a lesson depends on phones, those students are left out. Paper and a shared screen are the same for everyone.',
      'Phones are distracting. {u:Lots of students play games in class and do not listen.|How many? Where does this come from?} This is bad for their grades. {ro:Teachers have to stop the lesson to tell them and that wastes time and everyone gets annoyed.} So phones are a problem.',
      'On the other hand phones are useful in an emergency. Parents want to be able to reach their children. {u:This is important.|Explain why the office phone is not enough.} But this does not happen very often and the office has a phone.'],
    C: ['A classroom works when everyone in it is paying attention to the same thing. {h:Phones are designed, very cleverly, to take that attention somewhere else.|A strong closing idea.} Keeping them in bags is not a punishment. It is the simplest way to protect the reason we are in the room.{+}',
      'In conclusion, phones should be put away in lessons unless the teacher asks for them. The evidence shows that they cost attention, and attention is what learning needs. A clear rule is easier for everyone than an argument every lesson.',
      'To sum up, phones have good and bad sides. {u:I think the bad is more than the good.|End by repeating your strongest reason.} So they should be banned in lessons but allowed at break.',
      '{frag:In conclusion phones.} They are good sometimes and bad sometimes. Schools should decide.'],
    pairs: [[0, 2], [1, 3], [2, 3], [4, 5], [0, 3], [3, 4], [1, 2], [4, 5], [2, 1], [5, 4], [1, 0], [4, 1], [3, 0], [5, 3]],
    titles: ['Phones belong in bags', 'Phones in class', 'A tool or a temptation?', 'Should phones be allowed in class?'],
    say: [
      n => 'A thoughtful, well organised essay, ' + n + '. Your claim stays in view from start to finish and your evidence is explained, not just dropped in. To go further, weigh the strongest argument against you in more depth.',
      n => 'A clear argument with relevant evidence, ' + n + '. Each paragraph does one job. Next step: after each piece of evidence, add a sentence that says how it proves your claim.',
      n => 'You have some good reasons here, ' + n + ', in a sensible order. State your claim clearly in the first paragraph, and give each reason some evidence: a fact, a number or an example.',
      n => 'There are the beginnings of an argument here, ' + n + '. Let’s work on one thing first: a single sentence that says what you think. Then each paragraph can give one reason for it. Please see me about a rewrite.',
    ],
  };
  A.say('Marking the persuasive essays…');
  {
    const made = {};
    for (let i = 0; i < ENG.length; i++) { const t = tier(i), [a, b] = ESSAY.pairs[i]; made[ENG[i]] = await paper(ENG[i], 'English 9 · Persuasive essay', ESSAY.titles[i % 4], [ESSAY.I[t], ESSAY.B[t > 1 ? Math.max(a, 3) : Math.min(a, 3)], ESSAY.B[t > 1 ? (b === Math.max(a, 3) ? 3 : b) : (Math.min(b, 3) === Math.min(a, 3) ? (Math.min(a, 3) + 1) % 4 : Math.min(b, 3))], ESSAY.C[t]]); }
    await open('essay', made, async (b, of) => {
      for (let i = 0; i < ENG.length; i++) { const st = of(ENG[i]); grade(st, { rubric: rows(i, 4), comment: ESSAY.say[tier(i)](first(ENG[i])), ...(i === 9 ? { status: 'late' } : {}), ...(i === 4 ? { anchor: 'high' } : i === 10 ? { anchor: 'mid' } : i === 7 ? { anchor: 'low' } : {}) }, at(-25)); mark(st, made[ENG[i]]); }
      b.returned = { t: at(-24), n: 14 };
      await A.example(of('Aiko Tanaka'), { marks: true, why: 'The claim stays in view and every piece of evidence is explained.' });
      await A.example(of('Zara Ahmed'), { why: 'A solid middle paper: clear claim, evidence that needs explaining.' });
    });
  }

  /* 4. Story elements poster: group work, one paper marked and graded once for everyone in the group */
  A.say('Marking the group posters…');
  {
    const GROUPS = [
      [[0, 3, 7, 10], 'The Empty House', ['Mara, 15, quiet and observant', 'Her grandmother, seen only in memories'], 'An old house by the sea, empty since March', 'Mara against herself: she cannot bring herself to open the piano', 'Grief changes how we see the places we love', 18, 'Your theme is a full sentence and you found the turning point. Add a quotation for the setting next time.'],
      [[1, 4, 11, 13], 'The Last Bus', ['Dev, who has missed the last bus home', 'The driver, who says almost nothing'], 'A bus shelter on a wet night, then an empty bus', 'Dev against the night: how to get home, and whether to trust a stranger', 'Kindness often comes from people we do not expect', 19, 'Excellent: every box has evidence from the story. Your conflict box is the clearest in the class.'],
      [[2, 5, 8], 'Salt', ['Ines, who works on her father’s boat', 'Her father, who will not talk about the storm'], 'A fishing village in winter', 'Ines against her father: she wants to leave, he needs her to stay', 'Families', 15, 'Good work on character. “Families” is a topic, not yet a theme: what does the story say about families?'],
      [[6, 9, 12], 'Two Rivers', ['Sam and Jo, twins who have been sent to different schools'], 'Two towns on either side of a river', 'The twins against the adults’ decision', 'Growing up can mean growing apart, and that is not a failure', 17, 'A thoughtful theme. Your setting box needs detail: what does the river stand for?'],
    ];
    const made = {}, sheets = [];
    for (const [who, story, chars, setting, conflict, theme] of GROUPS) {
      const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), pg = doc.addPage([PH, PW]);   // a poster lies on its side
      const put = (t, x, top, size, f) => pg.drawText(t, { x, y: PW - top, size, font: f || font, color: rgb(.1, .1, .12) });
      put('Story elements: “' + story + '”', 48, 60, 24, bold); put('Group: ' + who.map(i => ENG[i]).join(', '), 48, 86, 12);
      const box = (x, top, w, h, title, lines) => {
        pg.drawRectangle({ x, y: PW - top - h, width: w, height: h, borderColor: rgb(.12, .43, .7), borderWidth: 1.5 });
        put(title, x + 14, top + 28, 15, bold); let yy = top + 56;
        for (const l of lines) { let line = ''; for (const w2 of ('• ' + l).split(' ')) { if (font.widthOfTextAtSize(line + w2, 13) > w - 30) { put(line.trim(), x + 14, yy, 13); yy += 19; line = '  '; } line += w2 + ' '; } put(line.trim(), x + 14, yy, 13); yy += 24; }
      };
      box(48, 112, 336, 210, 'Characters', chars); box(408, 112, 336, 210, 'Setting', [setting]); box(48, 344, 336, 210, 'Conflict', [conflict]); box(408, 344, 336, 210, 'Theme', [theme]);
      const data = await doc.save(); sheets.push(data);
      for (const i of who) made[ENG[i]] = { data, marks: {} };
    }
    await open('poster', made, async (b, of) => {
      const card = it('poster');
      b.groups = GROUPS.map(([who]) => ({ k: who.map(i => ENG[i]), p: Object.fromEntries(who.map(i => [ENG[i], ENG[i] + '/' + card.name + '.pdf'])) }));
      GROUPS.forEach(([who, , , , , , score, say], g) => {
        const st = of(ENG[who[0]]);
        grade(st, { points: String(score), comment: say }, at(-12));
        const f = st.files[0], ck = (x, y) => ({ t: 'check', color: A.CHECK_INK(), x, y, size: 22 });
        f.marks = { 0: [ck(350, 136), ck(710, 136), ck(350, 368), ...(g === 2 ? [{ t: 'note', color: RED, ax: 520, ay: 404, text: 'A topic, not yet a theme. What does the story SAY about families?' }] : [ck(710, 368)]), ...(g === 3 ? [{ t: 'note', color: RED, ax: 600, ay: 172, text: 'What might the river stand for?' }] : []), { t: 'stamp', k: 'score', text: A.scoreStampText(A.gradeOf(st), st), x: 690, y: 62, size: 52, color: A.totalInk() }, ...(g === 1 ? [{ t: 'stamp', k: 'star', x: 610, y: 66, size: 44, rot: -4 }] : [])] };
      });
      A.groupSync();
      b.returned = { t: at(-11), n: 14 };
    });
  }

  /* 5. Story analysis: handed in a few days ago, half marked, two still missing. The next thing waiting on Today. */
  const STORY = {
    S: ['In “The Empty House”, the writer uses the house itself to show how alone Mara feels after her grandmother’s death. {h:The setting is not a background: it behaves like a character who has stopped speaking.|An original reading, clearly stated.}',
      '“The Empty House” is a story about grief. {h:The writer shows Mara’s feelings through the objects she finds rather than through what she says.|A good claim.}',
      'In this story Mara goes back to her grandmother’s house. {u:The story is sad and has a lot of description.|This describes the story. What does the description SHOW?}',
      'The story is about a girl and a house. {u:I liked it.|Start with a claim about what the story means.}'],
    V: ['The clearest example is the piano. We are told that “dust lay on the piano like a second lid”. {h:The word “lid” suggests something closed for good, as if the music has been shut away with the person who played it.|Excellent close reading of a single word.}{+}',
      'Sound matters too. Upstairs “a window knocked in its frame”, which is the only noise in the house. {h:A knock is usually someone asking to come in, but here nobody is there.|Yes. What does that add to the mood?}',
      'When Mara finds the unfinished crossword, she “filled in one word and stopped”. {u:This shows she misses her grandmother.|How? What does filling in ONE word show?}',
      'The writer says the house “had been empty since March”. {u:This tells us when it happened.|It does. Why might the writer give the month?} It makes the story feel real.',
      'There is a piano and a window in the story. {u:They are described a lot.|Quote the words and say what they suggest.} Mara looks at them.'],
    K: ['By the end Mara opens the piano, and the writer gives us the first warm image in the story: “the keys were the colour of tea”. {h:The house has not changed, but the way she sees it has.|A perceptive ending.}{+}',
      'In the end Mara plays one note. This shows she is beginning to accept what has happened, because the piano is no longer closed.',
      'At the end she plays the piano. {u:It is a good ending.|Why is it good? What has changed for Mara?}',
      'At the end she plays the piano. {u:It is a good ending.|Why is it good? What has changed for Mara?}'],
    pairs: [[0, 1], [1, 2], [0, 2], [3, 4], [1, 0], [2, 3], [0, 3], [3, 4], [1, 0], [4, 3], [2, 1], [4, 2], [0, 2], [4, 3]],
    say: [
      n => 'This is perceptive work, ' + n + '. You read single words closely and explain what they suggest, which is exactly what analysis is. Keep your quotations this short.',
      n => 'A clear reading of the story with quotations that fit, ' + n + '. To move up, explain HOW the words create the effect: pick one word in each quotation and say what it suggests.',
      n => 'You know the story well, ' + n + ', and you are beginning to use quotations. At the moment you mostly retell. After each quotation, add “This suggests…” and finish the sentence.',
      n => 'You have read the story, ' + n + ', and that is the first step. Next: one quotation, and one sentence about what it shows. We will practise this together on Thursday.',
    ],
  };
  A.say('Marking the story analyses…');
  {
    const made = {}, away = [7, 9], done = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < ENG.length; i++) { if (away.includes(i)) continue; const t = tier(i), [a, b] = STORY.pairs[i]; made[ENG[i]] = await paper(ENG[i], 'English 9 · Story analysis: “The Empty House”', 'How does the writer show Mara’s feelings?', [STORY.S[t], STORY.V[t > 1 ? Math.max(a, 2) : Math.min(a, 2)], STORY.V[t > 1 ? (Math.max(b, 2) === Math.max(a, 2) ? 2 + (Math.max(a, 2) - 1) % 3 : Math.max(b, 2)) : (Math.min(b, 2) === Math.min(a, 2) ? (Math.min(a, 2) + 1) % 3 : Math.min(b, 2))], STORY.K[t]]); }
    await open('story', made, async (b, of) => {
      for (const i of done) { const st = of(ENG[i]); grade(st, { rubric: rows(i, 3, .1), comment: STORY.say[tier(i)](first(ENG[i])) }, at(-1, 16)); mark(st, made[ENG[i]]); }
      for (const i of away) grade(of(ENG[i]), { status: 'missing' }, at(-1, 16));
    });
  }
};

/* ---------------- the Planner: a timetable, two units and three weeks of lessons ---------------- */
SAMPLE.planner = async function (A, S) {
  const { eng, sci, wk, today, iso, plus, at, MEETS } = S, lid = () => 'smp' + A.uid();
  const meet = (dow, start, end) => ({ dow, start, end, label: '' });
  const setup = { semStart: iso(plus(wk, -70)), semEnd: iso(plus(wk, 42)), template: '', tplName: '', claudeUrl: '', profile: '',
    classes: [
      { id: 'smp-E9', name: eng.name, course: 'English 9', color: '#1F6FB2', meets: [meet(1, '09:00', '10:20'), meet(2, '13:10', '14:30'), meet(4, '09:00', '10:20'), meet(5, '10:40', '12:00')] },
      { id: 'smp-S8', name: sci.name, course: 'Science 8', color: '#0E7C86', meets: [meet(1, '10:40', '12:00'), meet(3, '09:00', '10:20'), meet(4, '13:10', '14:30')] },
    ],
    daysOff: [{ date: iso(plus(wk, 18)), label: 'Staff training day' }],
    events: [{ date: iso(plus(wk, 10)), to: '', label: 'Parent conferences' }, { date: iso(plus(wk, 46)), to: '', label: 'Last day of term' }] };

  const slide = (layout, title, body, more) => ({ id: lid(), layout, title, body: body || '', size: 32, notes: '', ask: '', talk: [], fmt: 2, ...more });
  const list = a => a.map((x, i) => (i + 1) + '. ' + x).join('\n'), dots = a => a.map(x => '• ' + x).join('\n');
  const md = d => (d.getMonth() + 1) + '/' + d.getDate();
  // One lesson from a short plan: title, agenda, objectives, warm-up, the main slides, exit ticket.
  const deck = (d, p) => [
    slide('title', p.title, p.sub || ''),
    slide('agenda', md(d) + ' Agenda', list(p.agenda)),
    slide('objectives', 'Today you will', dots(p.goals)),
    slide('warmup', 'Warm-up', p.warm, { tag: '5 minutes' }),
    ...p.main.map(m => slide(m[0], m[1], Array.isArray(m[2]) ? (m[0] === 'steps' ? list(m[2]) : dots(m[2])) : m[2], m[3])),
    slide('exit', 'Exit ticket', p.exit, { tag: 'On a sticky note' }),
  ];
  const E = [
    { title: 'What makes a story a story?', agenda: ['Warm-up', 'Five parts of a plot', 'Map a story you know', 'Exit ticket'], goals: ['Name the five parts of a plot', 'Map a familiar story onto them'], warm: 'Tell your partner the plot of a film in three sentences.', main: [['content', 'The five parts of a plot', ['Exposition: who, where, when', 'Rising action: the problem grows', 'Climax: the turning point', 'Falling action: what follows', 'Resolution: how it ends']], ['steps', 'Map a story you know', ['Choose a story everyone at your table knows', 'Draw the plot mountain on your whiteboard', 'Put one event at each of the five points', 'Be ready to explain your climax'], { notes: 'How to run it:\n1. Tables of three or four, one whiteboard each\n2. Give six minutes, then a gallery walk\n3. Ask two tables that chose the same story to compare their climax' }]], exit: 'Which part of a plot is hardest to spot, and why?' },
    { title: 'Character: what people do and say', agenda: ['Warm-up', 'Direct and indirect', 'Read: the opening page', 'Character chart'], goals: ['Tell direct from indirect characterization', 'Find two details that show what a character is like'], warm: 'Describe someone you know without using any adjectives.', main: [['twocol', 'Two ways to show a character', 'Direct\nThe narrator tells us.\n“Mara was stubborn.”', { body2: 'Indirect\nWe work it out.\n“Mara folded her arms and looked at the door.”' }], ['discuss', 'Turn and talk', 'Which tells you more about Mara, and why?', { foot: 'Think · Pair · Share' }], ['steps', 'Character chart', ['Read the opening page again', 'Find one thing the character says and one thing they do', 'Write what each one shows about them']]], exit: 'Write one sentence that shows a character is nervous without saying so.' },
    { title: 'Setting and mood', agenda: ['Warm-up', 'Words that build a mood', 'Rewrite the room', 'Share'], goals: ['Explain how a setting creates a mood', 'Change a mood by changing the details'], warm: 'List five words for this classroom at 8 in the morning.', main: [['passage', 'Read closely', 'The house had been empty since March. Dust lay on the piano like a second lid, and somewhere upstairs a window knocked in its frame.', { cite: 'A made-up opening' }], ['discuss', 'What do you notice?', 'Which three words do the most to build the mood?'], ['steps', 'Rewrite the room', ['Keep the house and the piano', 'Change the details so the mood is cheerful', 'Underline the words you changed']]], exit: 'What mood did you create, and which word did the most work?' },
    { title: 'Point of view', agenda: ['Warm-up', 'First and third person', 'Whose story is it?', 'Exit ticket'], goals: ['Identify first and third person narration', 'Say what a narrator can and cannot know'], warm: 'Retell this morning from the point of view of your shoes.', main: [['content', 'Who is telling the story?', ['First person: “I”. We know one mind', 'Third person limited: “she”. We follow one mind', 'Third person omniscient: we can know every mind']], ['steps', 'Whose story is it?', ['Read the three openings on your handout', 'Label the point of view of each', 'Rewrite one in a different point of view']]], exit: 'What can a first person narrator never tell us?' },
    { title: 'Conflict: what the character is up against', agenda: ['Warm-up', 'Four kinds of conflict', 'Sort the cards', 'Exit ticket'], goals: ['Name four kinds of conflict', 'Find the main conflict in a short story'], warm: 'What is the hardest choice a character has made in a book or film you like?', main: [['content', 'Four kinds of conflict', ['Character against character', 'Character against self', 'Character against society', 'Character against nature']], ['steps', 'Sort the cards', ['Each pair gets twelve story cards', 'Sort them by kind of conflict', 'Agree on the two that are hardest to place']]], exit: 'Name the main conflict in the story we are reading, in one sentence.' },
    { title: 'Theme: what the story is really about', agenda: ['Warm-up', 'Topic or theme?', 'Evidence hunt', 'Exit ticket'], goals: ['Tell a topic from a theme', 'Support a theme with a quotation'], warm: 'Finish the sentence: “Stories about friendship usually show that…”', main: [['twocol', 'Topic or theme?', 'Topic\nOne word or phrase.\nFriendship. Courage. Home.', { body2: 'Theme\nA full sentence the story argues.\n“Real friends tell you the truth.”' }], ['steps', 'Evidence hunt', ['Choose a theme from the board', 'Find two quotations that support it', 'Explain each one in a sentence']]], exit: 'Write the theme of our story as a full sentence.' },
    { title: 'Writing about a story: claim and quotation', agenda: ['Warm-up', 'Model paragraph', 'Write your own', 'Partner check'], goals: ['Write a claim about a story', 'Introduce and explain a quotation'], warm: 'Which is a claim? “The story is set in winter.” “The winter shows how alone she is.”', main: [['content', 'Claim, quotation, explanation', ['Claim: what you think the story shows', 'Quotation: a few words that prove it', 'Explanation: how those words prove it']], ['steps', 'Write your own', ['Choose a claim from your theme notes', 'Add one short quotation', 'Explain it in two sentences', 'Swap with a partner and underline their claim']]], exit: 'Copy your best explanation sentence here.' },
    { title: 'Story analysis: drafting', agenda: ['Warm-up', 'What the rubric asks for', 'Draft', 'Hand in'], goals: ['Draft a full analysis paragraph', 'Check it against the rubric'], warm: 'Read the top level of the rubric. Which row will be hardest for you?', main: [['content', 'What the rubric asks for', ['Understanding: how the author builds meaning', 'Evidence: short quotations, explained', 'Language: clear, correct sentences']], ['steps', 'Draft', ['Write your claim first', 'Use at least two quotations', 'Explain each one', 'Read it aloud quietly before you hand it in']]], exit: 'Which row of the rubric did you work hardest on today?' },
    { title: 'Feedback day: story analysis', agenda: ['Warm-up', 'Read your feedback', 'Fix one thing', 'Vocabulary preview'], goals: ['Read and use the comments on your paper', 'Improve one sentence'], warm: 'Before you look: what do you think you did well?', main: [['steps', 'Read your feedback', ['Read every comment on your paper', 'Highlight the one that would help most', 'Rewrite that sentence on the back']], ['vocab', 'Words for Friday’s quiz', '', { word: 'ambiguous', pos: 'adjective', body: 'Having more than one possible meaning.\n“The ending is ambiguous: we never learn if she stays.”' }]], exit: 'What will you do differently in your next analysis?' },
    { title: 'Vocabulary and a new story', agenda: ['Warm-up', 'Six new words', 'First read', 'Exit ticket'], goals: ['Use six new words in sentences', 'Read a new story for the gist'], warm: 'Use “reluctant” in a sentence about a Monday.', main: [['content', 'Six new words', ['reluctant', 'ambiguous', 'vivid', 'inevitable', 'resent', 'solitary']], ['steps', 'First read', ['Read the story once without stopping', 'Write one sentence: what happens?', 'Circle two words you would like to know']]], exit: 'Which new word fits the main character best?' },
    { title: 'Vocabulary quiz 2 and close reading', agenda: ['Quiz', 'Close reading in pairs', 'Share'], goals: ['Show what you know about the six words', 'Read one paragraph closely'], warm: 'Two minutes to look over your words.', main: [['steps', 'Close reading in pairs', ['Read paragraph three aloud to each other', 'Mark every word about light or dark', 'Decide what the pattern shows']]], exit: 'What did the pattern of light and dark show?' },
  ];
  const Sx = [
    { title: 'What is a force?', agenda: ['Warm-up', 'Pushes and pulls', 'Force hunt', 'Exit ticket'], goals: ['Describe a force as a push or a pull', 'Draw forces with arrows'], warm: 'List three things you pushed or pulled before school today.', main: [['content', 'Forces', ['A force is a push or a pull', 'We measure it in newtons (N)', 'We draw it as an arrow: length for size, point for direction']], ['steps', 'Force hunt', ['Walk the room with your partner', 'Find five forces acting right now', 'Sketch each with an arrow']]], exit: 'Draw the forces on a book resting on a table.' },
    { title: 'Balanced and unbalanced forces', agenda: ['Warm-up', 'Tug of war', 'Predict and test', 'Exit ticket'], goals: ['Tell balanced from unbalanced forces', 'Predict how an object will move'], warm: 'In a tug of war nobody is moving. What does that tell you?', main: [['twocol', 'Balanced or unbalanced?', 'Balanced\nForces cancel.\nNo change in motion.', { body2: 'Unbalanced\nOne force wins.\nThe object speeds up, slows or turns.' }], ['steps', 'Predict and test', ['Read each card and predict the motion', 'Test it with the trolley', 'Record what happened']]], exit: 'A car moves at a steady speed. Are the forces balanced?' },
    { title: 'Friction', agenda: ['Warm-up', 'What friction does', 'Plan the practical', 'Exit ticket'], goals: ['Explain what friction is', 'Plan a fair test'], warm: 'Why do your shoes have patterns on the bottom?', main: [['content', 'Friction', ['A force between surfaces that touch', 'It acts against the motion', 'Rougher surfaces usually give more friction']], ['steps', 'Plan the practical', ['Question: how does the surface change the force needed to pull a block?', 'Choose what you will change, measure and keep the same', 'Draw your results table']]], exit: 'What is one thing you must keep the same, and why?' },
    { title: 'Friction practical', agenda: ['Safety', 'Collect results', 'Graph', 'Pack away'], goals: ['Collect accurate results', 'Draw a bar chart of your results'], warm: 'Read your plan. What will you do first?', main: [['steps', 'Collect results', ['Pull the block across each surface with the newton meter', 'Take three readings for each', 'Work out the mean']], ['discuss', 'Look at your chart', 'Which surface gave the most friction? Was that what you predicted?']], exit: 'Write a one-sentence conclusion.' },
    { title: 'Speed', agenda: ['Warm-up', 'Distance and time', 'Timing trolleys', 'Exit ticket'], goals: ['Calculate speed from distance and time', 'Use the right units'], warm: 'Who is faster: 100 m in 14 s or 200 m in 30 s?', main: [['content', 'Speed', ['Speed = distance ÷ time', 'Metres per second (m/s)', 'A steeper line on a distance–time graph means faster']], ['steps', 'Timing trolleys', ['Mark one metre on the ramp', 'Time the trolley three times', 'Calculate its average speed']]], exit: 'A cyclist rides 120 m in 15 s. What is her speed?' },
    { title: 'Forces quiz and seat belts', agenda: ['Quiz', 'Read: seat belts', 'Discuss'], goals: ['Show what you know about forces', 'Explain how a seat belt uses forces'], warm: 'Two minutes to look over your notes.', main: [['discuss', 'Seat belts', 'Why does a passenger keep moving when a car stops suddenly?', { foot: 'Use the word “force” in your answer' }]], exit: 'Explain in one sentence what a seat belt does.' },
  ];
  const lessons = [], put = (cid, dows, plans, firstWeek, unit, links) => {
    let k = 0;
    for (let w = firstWeek; k < plans.length; w++) for (const dow of dows) {
      if (k >= plans.length) break;
      const d = plus(wk, w * 7 + dow - 1), p = plans[k++], past = d < today && iso(d) !== iso(today), isToday = iso(d) === iso(today), slides = deck(d, p);
      const l = { id: lid(), title: p.title, slots: [{ classId: cid, date: iso(d) }], slides, created: at(-20), updated: d.getTime() - 2 * 864e5, note: '', status: past || isToday ? '' : (k % 3 === 0 ? 'review' : ''), claudeNote: '', fmt: 2, unit };
      if (past) l.taught = [{ classId: cid, date: iso(d), slide: k % 4 === 1 ? slides.length - 1 : slides.length, of: slides.length, note: k % 4 === 1 ? 'Ran out of time for the exit ticket. Start with it next lesson.' : k % 5 === 2 ? 'Went well. The partner task needed ten minutes, not six.' : '', at: d.getTime() + 4 * 36e5, agenda: [k % 4 === 1 ? p.agenda.length - 1 : p.agenda.length, p.agenda.length] }];
      if (links && k % 2) l.links = links.map(x => ({ id: lid(), name: x[0], url: x[1] }));
      lessons.push(l);
    }
  };
  put('smp-E9', MEETS.eng, [3, 4, 5, 7, 9, 1, 2, 8, 10, 6].map(i => E[i]), -1, 'smp-pu2', [['Short story: full text', 'https://library.example.org/stories/the-empty-house'], ['Plot mountain handout', 'https://school.example.org/english/plot-mountain']]);
  put('smp-S8', MEETS.sci, Sx, -1, 'smp-pu4', [['Forces simulation', 'https://science.example.org/sims/forces']]);
  const week = (focus, notes, standards) => ({ focus, notes: notes || '', standards: standards || '' });
  const units = [
    { id: 'smp-pu1', course: 'English 9', title: 'Unit 1: Persuasion', start: iso(plus(wk, -70)), color: '#7B3FC4', atlas: '', files: [], updated: at(-40), weeks: [week('Claims and reasons'), week('Evidence that convinces'), week('The persuasive paragraph', 'Paragraph due Friday'), week('Counter-arguments'), week('Drafting the essay'), week('Revising and editing', 'Essay due')] },
    { id: 'smp-pu2', course: 'English 9', title: 'Unit 2: Short stories', start: iso(plus(wk, -28)), color: '#1F6FB2', atlas: '', files: [], updated: at(-3), weeks: [week('Reading for the gist', 'Reading check 2'), week('Plot and character', 'Story elements poster in groups'), week('Setting, mood and point of view', 'Book talks this week'), week('Conflict and theme', 'Story analysis due'), week('Feedback and a new story', 'Vocabulary quiz 2 on Friday'), week('Writing our own openings')] },
    { id: 'smp-pu3', course: 'Science 8', title: 'Unit 1: Cells', start: iso(plus(wk, -70)), color: '#0E7C66', atlas: '', files: [], updated: at(-40), weeks: [week('Living things'), week('Using a microscope'), week('Plant and animal cells'), week('Cells lab report'), week('Review and unit test')] },
    { id: 'smp-pu4', course: 'Science 8', title: 'Unit 2: Forces and motion', start: iso(plus(wk, -35)), color: '#B35C00', atlas: '', files: [], updated: at(-3), weeks: [week('Measuring motion'), week('Ramp investigation', 'Criteria B and C'), week('Science in the news', 'Criterion D'), week('Forces around us'), week('Balanced forces and friction', 'Forces quiz'), week('Speed and graphs')] },
  ];
  const db = await A.planDb(true); if (!db) throw new Error('The Planner’s store could not be opened');
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(['lessons', 'kv'], 'readwrite');
      for (const l of lessons) tx.objectStore('lessons').put(l);
      tx.objectStore('kv').put(setup, 'setup'); tx.objectStore('kv').put(units, 'units'); tx.objectStore('kv').put({ sys: '', unit: '' }, 'words');
      tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error);
    });
  } finally { db.close(); }
};
