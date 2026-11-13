/* ---------------- languages (Stage 6): the app in a language other than English ----------------
   Built into both pages, after the language files (src/lang-*.js) and before everything else.
   The app is written in English. A language is one file: the English words and sentences it knows, each with its own, the answers
   on the Help page, and how it writes a date. Nothing else in the app knows which language is on. What is drawn inside the parts of
   the page listed in LANG_ROOTS is read as it lands and put into the language, a piece at a time: a whole line, or each part of a line
   that is joined with " · ". A piece the file doesn't know stays as it is, so a class's name, a student's and an assignment's are
   left alone, and a screen that hasn't been translated yet is simply still in English.
   The choice is one setting in this browser (gs.lang), read by both pages. English adds nothing and runs none of this.
   To add a language: copy src/lang-es.js (Spanish) or src/lang-zh.js (Traditional Chinese), translate it, and name it in LANGS in build.js. test/lang.test.js lists what a
   file still leaves in English on the screens it covers. */
// Where a language comes from. A page at the web address fetched the chosen one before this ran (lang/<code>.js, which leaves it in
// window.__gsLangs; build.js says how). A double-click copy carries every language squeezed (LANG_PACKED) and unpacks the one asked for.
// LANG_NAMES lists every language by its code, with its own name for itself.
const LANG_OPEN = {};
function langPack(k) {
  if (!Object.prototype.hasOwnProperty.call(LANG_NAMES, k)) return null;
  if (window.__gsLangs && window.__gsLangs[k]) return window.__gsLangs[k];
  if (!Object.prototype.hasOwnProperty.call(LANG_PACKED, k)) return null;
  if (!LANG_OPEN[k]) { try { const b = atob(LANG_PACKED[k]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); LANG_OPEN[k] = new Function(fflate.strFromU8(fflate.inflateSync(u)))(); } catch (e) { console.error(e); return null; } }
  return LANG_OPEN[k];
}
// Fetches a language that isn't here yet. The app itself never needs this (the page fetched the chosen one as it opened); the tests do.
const langLoad = k => langPack(k) || !Object.prototype.hasOwnProperty.call(LANG_NAMES, k) ? Promise.resolve(!!langPack(k)) : new Promise(done => {
  const s = document.createElement('script'); s.src = 'lang/' + k + '.js' + (window.gsLangV && window.gsLangV[k] ? '?' + window.gsLangV[k] : ''); s.onload = () => done(!!langPack(k)); s.onerror = () => done(false); document.head.appendChild(s);
});
// The language she chose. If its file could not be fetched (no internet, and never used on this computer), this visit is in English
// and the choice stays, so it comes back by itself.
const LANG_WANT = (() => { try { const v = JSON.parse(localStorage.getItem('gs.lang')); return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LANG_NAMES, v) ? v : 'en'; } catch { return 'en'; } })();
const LANG_PACK = LANG_WANT === 'en' ? null : langPack(LANG_WANT);
const LANG = LANG_PACK ? LANG_WANT : 'en';
// For dates: the browser's own way of writing them in English, the language's way otherwise.
const LANG_LOCALE = LANG_PACK ? LANG_PACK.locale : undefined;
// The lines with a number or a name in them that every language answers from its own "fill" list, so the English is matched once, here.
// In a fill, {1} {2} are the parts found in the English, {t1} is that part put into the language when it is known, and a pair is
// one / many by the first number. A line made of several sentences is put together from its pieces (the functions).
const langCap = s => s.charAt(0).toUpperCase() + s.slice(1);
function langFill(t, m, P) {
  const s = Array.isArray(t) ? t[+m[1] === 1 ? 0 : 1] : t;
  return s.replace(/\{(t?)(\d)\}/g, (x, w, i) => { const v = m[+i] == null ? '' : m[+i]; if (!w) return v; const h = trPiece(v, P); return h != null ? h : (trPiece(langCap(v), P) || v); });
}
const LANG_ATT = { present: 'attp', late: 'attl', 'absent, reason unknown': 'atta', excused: 'atte' };
const LANG_FILLS = [
  // Find anything: the teacher's AI assistant, to open beside the app (src/beside.js)
  ['besideopen', /^Open (.+) beside Grading Studio$/],
  // the Gradebook tab
  ['sdet', /^Student details for (.+)$/], ['cnt', /^Count (.+) in the class average$/], ['wout', /^without (\d+) students? ·$/],
  ['nograde', /^Nothing graded for (.+) in this term yet\. Grade a download for it, or use \+ Add scores for work you did before\.$/],
  ['noroster', /^The gradebook lists the students on a class’s roster\. Add a roster to (.+) on its class page first\.$/],
  ['untyped1', /^“(.+)” has no type yet, so it doesn’t count toward a term grade\.$/], ['untypedN', /^(\d+) assignments have no type yet, so they don’t count toward a term grade\.$/],
  ['given', /^(\d+) given$/], ['bydate', /^By the date \((.+)\)$/], ['typedfor', /^Typed-in scores for (.+)$/], ['addfor', /^Add scores for (.+)$/],
  ['xcfor', /^Extra credit for (.+)$/], ['scfor', /^Score for (.+)$/], ['ofxc', /^(\d+) of (\d+) given extra credit$/], ['ofdone', /^(\d+) of (\d+) complete$/], ['ofent', /^(\d+) of (\d+) entered$/],
  ['xcI', /^Each point adds one percentage point to the (.+), which then counts by its weight\. Leave a student blank for none\. It doesn’t change any assignment’s score\.$/],
  ['xcon', /^\+([\d.,]+)% on the term grade$/], ['xconi', /^\+([\d.,]+) on the (.+)$/], ['avg', /^([^·.:]{1,40}) average$/], ['scout', /^Score out of ([\d.,]+)$/],
  ['notros', /^Not on the roster, so left out: (.+)\. Type their scores in by hand\.$/],
  ['how', /^Students are in your roster order\. (?:Each type’s average counts every assignment of that type the same; the (term grade|grade) weights them by your Term setup\. )?Missing and Excused never count against a student\. Point at a (term grade|grade) to see how it’s worked out(, extra credit included)?\.( Scores you typed in can be changed here; a graded download’s scores change in that download\.)?$/,
    (m, F) => [F.how1, m[1] ? (m[1] === 'grade' ? F.how2g : F.how2t) : '', F.how3, (m[2] === 'grade' ? F.how4g : F.how4t).replace('{xc}', m[3] ? F.howxc : ''), m[4] ? F.how5 : ''].filter(Boolean).join(F.sp)],
  // the Students tab
  ['pasteS', /^Paste a class list with names and a student ID or email column \(from (.+) or a spreadsheet\)\. Each row fills in the student with the same name\.$/],
  ['withid', /^(\d+) with an ID$/], ['idfor', /^Student ID for (.+)$/], ['emfor', /^Email for (.+)$/], ['lyfor', /^Last year’s level for (.+)$/],
  // the Attendance tab
  ['notefor', /^Note for (.+)$/], ['att', /^(\d+) (present|late|absent, reason unknown|excused)$/, (m, F, P) => langFill(F[LANG_ATT[m[2]]], m, P)],
  ['cap', /^(Each press is saved as you make it\.|Everyone starts as present\. Press Late or Absent for anyone who isn’t, or “Everyone is here” if they all are\.) Absent starts as “reason unknown”; press “Absent, excused” once you know the absence is excused\. With a name in focus, P, L, A and E set it and move to the next student\.$/,
    (m, F) => (m[1].startsWith('Each') ? F.capA : F.capB) + F.sp + F.capR],
  ['noatt', /^No attendance saved in (.+)\.$/], ['openday', /^Open (?!in )(.*\d.*)$/],
  ['taken', /^(\d+) days? taken(?: in (.+))?\. Click a date to open or change that day, or a name for that student’s page\. “Here” counts everyone present or late\.$/,
    (m, F, P) => langFill(m[2] ? F.takenin : F.taken, m, P) + F.sp + F.takenR],
  ['unk', /^(\d+) absences? still ha(?:s|ve) no reason\.$/], ['andmore', /^and (\d+) more\. Open the day and press “Absent, excused” when you hear why\.$/],
  // the Missing work tab
  ['owes', /^(\d+) students? owes? (\d+) pieces? of work$/, (m, F, P) => langFill(F.owesA, m, P) + F.sp + langFill(F.owesB, [0, m[2]], P)],
  ['reminded', /^Reminded (.+)$/], ['ago', /^(\d+) days? ago$/],
  // the Seating tab
  ['pick', /^Pick the closest one\. There is a desk for each of the (\d+) students, and any desk can be moved or taken away afterwards\.$/],
  ['seated', /^(\d+) of (\d+) seated$/], ['needed', /^(\d+) more desks? needed$/], ['desk', /^Desk, (.+)\. Click to take it away$/],
  ['why', /^(.{1,40}) (\d+)%: ([\d.,]+%|none, counts as 0|none yet, left out)$/], ['xcwhy', /^Extra credit \+([\d.,]+) on the (.+)$/],   // pointing at a grade
  // a student's own page
  ['clsavgT', /^Class average ([\d.,]+%?)$/], ['clsavg', /^class average ([\d.,]+%?)$/], ['clsn', /^class ([\d.,]+%?)$/], ['counted', /^(\d+) of (\d+) counted$/],
  ['incxc', /^includes \+([\d.,]+) extra credit$/], ['plusxc', /^\+([\d.,]+) extra credit$/], ['plusx', /^\+([\d.,]+) extra$/],
  ['rowsof', /^Their average on each rubric row across the summatives, out of (\d+)\. The dashed line is the class average\.$/], ['fmfb', /^(\d+) of (\d+) formative activities have feedback\.$/],
  ['here', /^Here (\d+) of (\d+) days?(?:: (.+)\.|, never late\.)$/, (m, F, P) => m[3] ? langFill(F.hereC, [0, m[1], m[2], m[3].split(' · ').map(p => trPiece(p, P, 'att') || p).join(' · ')], P) : langFill(F.hereN, m, P)],
  // the Charts tab
  ['sortby', /^Sort by (.+)$/], ['across', /^across (\d+) students?$/], ['nleft', /^(\d+) left out$/],
  ['rowscls', /^The class average on each rubric row, out of (\d+), wherever the same row name comes back\. The lowest row is in blue\.$/],
  ['vs', /^(.{1,40}) against (.{1,40})$/], ['strongon', /^Stronger on (.{1,40})$/], ['dotcap', /^One dot per student\. On the line, the two match\. Below it, a student does better on (.+) than on (.+)\.$/],
  ['both', /^This shows once students have both a score in (.+) and one in (.+)\.$/], ['pts', /^([+−][\d.]+) points$/], ['last3', /^Last three ([\d.,]+%), earlier ([\d.,]+%)$/],
  ['outof', /^([\d.,]+) out of (\d+)$/], ['npap', /^(\d+) papers?$/], ['nsc', /^(\d+) scores?$/], ['nsum', /^(\d+) summatives?$/], ['ntask', /^(\d+) tasks?$/],
  ['midhalf', /^class middle half (\d+)–(\d+)%$/], ['midp', /^Middle ([\d.,]+)%$/], ['lowhigh', /^Lowest ([\d.,]+)%, highest ([\d.,]+)%, middle half ([\d.,]+)–([\d.,]+)%$/], ['sums', /^Summatives ([\d.,]+%)$/],
  // the Goals tab
  ['clsavgG', /^([\d.,]+%) class average$/], ['under', /^(\d+) under (\d+)%$/], ['nounder', /^no one under (\d+)%$/],
  ['underwho', /^Under (\d+)%: (.+?)( and \d+ more)?$/, (m, F, P) => langFill(F.underwho, m, P) + (m[3] ? ' ' + (trPiece(m[3].trim(), P) || m[3].trim()) : '')],
  ['glcap', /^The class average on each goal, lowest first\. The dashed line is (\d+)%\.$/], ['nohere', /^No scores here yet: (.+)\.$/], ['gpaper', /^([^·]+) (\d+%) \(([\d.,]+) of ([\d.,]+)\)$/],
  ['glaria', /^(.+): ([\d.,]+%) class average\. (.+)$/, (m, F, P) => m[1] + ': ' + langFill(F.clsavgG, [0, m[2]], P) + F.dot + trWith(m[3], P)],
  // the Report comments tab
  ['rptfor', /^Report comment for (.+)$/], ['rdone', /^(\d+) of (\d+) done$/], ['gradep', /^Grade ([\d.,]+%)( so far)?$/, (m, F, P) => langFill(F.gradep, m, P) + (m[2] ? ' ' + (trPiece('so far', P) || 'so far') : '')],
  ['strongest', /^Strongest: (.+) ([\d.,]+)$/], ['towork', /^To work on: (.+) ([\d.,]+)$/], ['l3', /^Last three scores (up|down) (\d+)$/, (m, F, P) => langFill(m[1] === 'up' ? F.l3up : F.l3down, [0, m[2]], P)],
  ['missn', /^Missing (\d+)$/], ['nchars', /^(\d+) characters$/], ['ofchars', /^(\d+) of (\d+) characters$/], ['overchars', /^(\d+) of (\d+) characters, (\d+) over$/],
  // a class graded the IB way (ib.js)
  ['lvfor', /^([A-Z]) for (.+): (\d|not set|no evidence)$/], ['lvfor2', /^([A-Z]) for (.+)$/], ['ofn', /^of (\d+)$/], ['ofset', /^(\d+) of (\d+) set$/], ['critset', /^(\d+) of (\d+) criteria set$/],
  ['levelfor', /^Level for (.+)$/], ['recent', /^Most recent (\d), highest (\d)$/], ['recentis', /^Most recent is (\d)\. Not set yet\.$/], ['recentns', /^most recent (\d), not set$/], ['stillset', /^still to set: (.+)$/],
  ['hint', /^(?:Still to set: (.+)\. |(This total is below the lowest boundary\.) )?The outlined number is only a hint from the most recent work\. Nothing is set until you click, and clicking a set level again clears it\.$/,
    (m, F, P) => (m[1] ? langFill(F.still, m, P) + F.sp : m[2] ? F.below + F.sp : '') + F.hintR],
  ['midlevel', /^([A-Z]) middle level$/], ['gradeN', /^Grade (\d)$/], ['band', /^(\d) to (\d) (limited|adequate|substantial|excellent)$/], ['mid2', /^(\d) to (\d)$/], ['plusfm', /^\+ (\d+) formative$/],
  ['few', /^Criterion .+ has been assessed (?:once|in no task) this year\. Each criterion is usually assessed at least twice a year\.$/,
    (m, F, P) => { const out = []; m[0].replace(/Criterion (.+?) has been assessed (once|in no task) this year\. /g, (x, k, n) => { out.push(langFill(n === 'once' ? F.fewonce : F.fewnone, [0, k], P)); return ''; }); return out.concat(F.fewR).join(F.dot); }],
  ['nolevels', /^No levels for (.+) in this term yet\. Use \+ Add levels to type in the levels each student earned on a task\.$/], ['predicted', /^predicted (\d)$/], ['ibgrade', /^IB grade (\d)$/], ['predfor', /^Predicted grade for (.+)$/], ['totalof', /^total (\d+) of (\d+)$/],
  // boxes opened from a class page: an assignment, a roster, a unit, how the class is graded, the wording boxes, the notes pages, the progress sheets
  ['openq', /^Open “(.+)”$/], ['wheredl', /^Where is the (.+) download\? You can also drop the ZIP or the folder straight onto this assignment’s card\.$/],
  ['dellv', /^Delete the levels typed in for “(.+)”\?$/], ['delq', /^Delete “(.+)”\?$/], ['delcls', /^Delete the (.+) class\? Its assignments move to “No class”\.$/],
  ['delunit', /^(?=Delete “.+” and its (\d+) )Delete “(.+)” and its \d+ assignments?\? Saved marks for those downloads stay in this browser\.$/],
  ['pasteweb', /^Paste the web address of the class page for (.+) \(leave empty to remove it\)$/], ['pasteplan', /^Paste the link to the unit plan for (.+) \(leave empty to remove it\)$/],
  ['pastemb', /^Paste the (.+) page for (.+) \(leave empty to remove it\)$/], ['pasteul', /^Paste the (.+) link for (.+) \(leave empty to remove it\)$/],
  ['nounit1', /^(.+) has no unit called “(.+)” yet, so one is made there\.$/], ['nounitn', /^(.+) have no unit called “(.+)” yet, so one is made there\.$/], ['addton', /^Add to (\d+) classes$/],
  ['otherway', /^Another way (.+)’s name is written \(in a download, a folder or (.+)\)$/], ['otherway0', /^Another way (.+)’s name is written \(in a download, a folder\)$/],
  ['nopap', /^“(.+)” with no papers$/], ['nopapsay', /^For presentations, speeches, performances and videos\. Each of the (\d+) students in (.+) gets a notes page to write on while you watch\. Mark it, score it and return it like a paper\.$/],
  ['howgr', /^How (.+) is graded$/], ['critname', /^Name of criterion ([A-Z])$/], ['critcut', /^Remove criterion ([A-Z])$/], ['lowfor', /^Lowest for grade (\d)$/], ['lowtot', /^The lowest total of (\d+) for each grade\.$/],
  ['notable', /^No table is published for (\d+) criteria, so these are scaled from the four-criterion one\. Check them against your school’s\.$/], ['wof', /^Weight of (.+)$/],
  ['pastepg', /^Paste this class’s (.+) page address$/], ['orderok', /^Students, one per line, in the order you want \((.+) order works well\)$/],
  ['pastefrom', /^Paste from a spreadsheet or (.+), or upload a file\. Student ID and email columns are kept as each student’s details\.$/],
  ['printn', /^Print (\d+) pages$/], ['ndrafts', /^(\d+) report comments are still drafts you haven’t looked at\.$/], ['cmidl', /^class middle (\d+)$/], ['syslink', /^([A-Z][\w .&-]{0,30}) link$/],
  // the marking screen: the top bar, the student list, the score panel, and its Grades, Insights, Return and Rubric setup screens
  ['mfready', /^(\d+) marked files? ready to give back$/], ['npages', /^(\d+) pages?$/], ['putsc', /^Put the score on the paper: (.+)$/],
  ['partrows', /^Partial: (\d+) of (\d+) rows scored\. This total isn’t final\.$/], ['avgtip', /^(?=Average of (\d+) )Average of \d+ finished scores?’s percents: (.+?)\. Partial, missing, excused and left-out papers don’t count\. Click for Insights\.$/],
  ['tocheck', /^(\d+) to check$/], ['totof', /^Total \/(\d+)$/], ['confq', /^“(.+)”\? confirm$/], ['nmpct', /^(.+), ([\d.,]+%)$/],
  ['nmord', /^(.+), ([\d.,]+) out of (\d+), scored (\d+)(?:st|nd|rd|th)$/], ['scoredn', /^Scored (\d+)(?:st|nd|rd|th)$/],
  ['spreadar', /^Score (.+): (\d+) students?$/, (m, F, P) => langFill(F.scorel, [0, m[1]], P) + ': ' + langFill(F.nstud, [0, m[2]], P)],
  ['nscore', /^(\d+) scores?, (\d+) at ([\d.,]+) or less$/],
  ['ovrar', /^(.+): ([\d.,]+) average\. (.+)$/, (m, F, P) => { const r = trPiece(m[3], P); return r == null ? null : m[1] + ': ' + langFill(F.avgis, [0, m[2]], P) + '. ' + r; }],
  ['pprat', /^(.+): (\d+) papers? at ([\d.,]+)$/, (m, F, P) => m[1] + ': ' + langFill(F.ppat, [0, m[2], m[3]], P)], ['scoredon', /^Scored ([\d.,]+) on (.+)$/],
  ['countedL', /^Counted: (\d+) of (\d+) students?\.(?: Left out: (.+)\.)?$/, (m, F, P) => langFill(F.countedA, [0, m[2], m[1]], P) + (m[3] ? ' ' + langFill(F.leftout, [0, m[3].split(', ').map(x => trPiece(x, P) || x).join(', ')], P) : '')],
  ['nnot', /^(\d+) not scored yet$/], ['npartial', /^(\d+) partial$/], ['nmissing', /^(\d+) missing$/], ['nexcused', /^(\d+) excused$/], ['nleftout', /^(\d+) left out by you$/],
  ['avgpct', /^Average ([\d.,]+%)$/], ['ptsof', /^Points, out of (\d+)\.( A half point counts with the whole number below it\.)?$/, (m, F, P) => langFill(F.ptsof, m, P) + (m[2] ? ' ' + (trPiece(m[2].trim(), P) || m[2]) : '')],
  ['rowavg', /^Average out of (\d+|each row’s top), lowest first\. It uses every row with a score(?:, including the scored rows on (\d+) partial papers?)?\.(.*)$/, (m, F, P) => {
    const rest = m[3].trim(), rs = rest ? rest.split(/(?<=\.) (?=[A-Z0-9])/).map(x => trPiece(x, P)) : []; if (rs.some(x => x == null)) return null;
    return [/^\d+$/.test(m[1]) ? langFill(F.rowavg, m, P) : F.rowavgE, ...(m[2] ? [langFill(F.rowpart, [0, m[2]], P)] : []), ...rs].join(' '); }],
  ['ovrar0', /^(.+): No scores yet\. No scores yet$/, (m, F, P) => { const r = trPiece('No scores yet', P); return r == null ? null : m[1] + ': ' + r + '. ' + r; }], ['rowsdone', /^(\d+) of (\d+) rows scored$/],
  ['nowrit', /^Nothing written for ([\d.,]+)\.$/],
  ['partw', /^Partial: (\d+) of (\d+) rows scored$/], ['partq', /^Partial: (\d+) of (\d+) questions marked in Quick mark$/], ['isgrade', /^Is “(.+)” the grade\?$/], ['nreads', /^(\d+) grades found on the paper$/],
  ['yspaper', /^Your score is ([\d.,]+%?), the paper says (.+)$/], ['yswr', /^Your score is ([\d.,]+), the Word rubric says ([\d.,]+)$/], ['likename', /^Like “(.+)”\. Graded when it has a score, Feedback when it doesn’t\.$/],
  ['rowless', /^(\d+) scores? read from the paper ha(?:s|ve) no rows, so (?:it isn’t|they aren’t) here\.$/],
  ['skipn', /^(\d+) students? ha(?:s|ve) nothing marked, so they’re left out\.$/],
  ['grpn', /^(.+) \((\d+)\)$/, (m, F, P) => { const h = trPiece(m[1], P); return h == null ? null : h + ' (' + m[2] + ')'; }],
  ['fewdrift', /^(?:Only (\d+) papers? ha(?:s|ve)|No papers have) a time to go by so far\. It takes at least (\d+) before this will say anything about getting harder or softer\. Any pattern in fewer is mostly chance\.$/, (m, F, P) => (m[1] ? langFill(F.fewdrift, m, P) : F.nodrift) + ' ' + langFill(F.driftmin, [0, m[2]], P)],
  ['nfready', /^(\d+) files? ready$/], ['fromn', /^From (\d+) students?, in their own folders, ready to (?:upload back on (.+?)|hand back)\.(?: (\d+) students? ha(?:s|ve) nothing marked, so they’re left out\.)?$/,
    (m, F, P) => langFill(m[2] ? F.fromsys : F.fromhb, [0, m[1], m[2]], P) + (m[3] ? ' ' + langFill(F.skipn, [0, m[3]], P) : '')],
  ['nthings', /^(\d+) things? to look at before you return these$/], ['lvmeans', /^What (\d+(?:\.5)?) means on this row$/], ['inall', /^Out of ([\d.,]+) in all\.$/],
  ['stepsof', /^Steps of (\d+) \((.+)\)$/], ['expnow', /^Export (.+)’s paper now$/], ['expone', /^Export (.+)’s paper$/],
  ['askai', /^Ask (.{1,30})$/], ['backai', /^Bring back (.{1,30})’s feedback$/], ['cmtfor', /^Comment for (.+?)( \(optional\)\. It shows on the Grades tab so you can copy it\.)?$/, (m, F, P) => langFill(m[2] ? F.cmtforL : F.cmtfor, [0, m[1] === 'the student' ? (trPiece('the student', P) || m[1]) : m[1]], P)],
  ['clickcp', /^Click any score or comment to copy it, then paste it into (.+)\. Click a name to open that paper\.( Pick a roster under Setup to see this list in roster order\.)?$/, (m, F, P) => langFill(F.clickcp, [0, m[1] === 'your gradebook' ? (trPiece('your gradebook', P) || m[1]) : m[1]], P) + (m[2] ? ' ' + (trPiece(m[2].trim(), P) || m[2]) : '')],
  ['rosterord', /^(.+) roster order$/], ['nscored', /^(\d+) of (\d+) scored$/],
  // what a chart says of itself to a screen reader: the names in it stay, the words between them are put into the language
  ['ariaband', /^(?=.*(?:class middle \d|missing)).+ (?:\d+%|missing|–)(?:, class middle \d+%)?$/, (m, F, P) => m[0].replace(/ missing(?=, class middle |\. |$)/g, ' ' + (trPiece('missing', P) || 'missing')).replace(/, class middle (\d+%)(?=\. |$)/g, (x, v) => langFill(F.cmid, [0, v], P))],
  ['ariamove', /^.+ (?:up|down) [\d.]+$/, (m, F, P) => m[0].replace(/ (up|down) ([\d.]+)(?=, |$)/g, (x, w, v) => ' ' + langFill(w === 'up' ? F.mvup : F.mvdown, [0, v], P))],
  ['ariastack', /^.+: \d+ (?:below 60|\d+ to \d+)(?:[,.] .+)?$/, (m, F, P) => m[0].replace(/(\d+) below 60(?=[,.] |$)/g, (x, n) => langFill(F.below60, [0, n], P)).replace(/(\d+) (\d+) to (\d+)(?=[,.] |$)/g, (x, n, a, b) => langFill(F.rng, [0, n, a, b], P))],
  ['ariascat', /^.+: summatives [\d.,]+%, in-class [\d.,]+%$/, (m, F, P) => m[0].replace(/: summatives ([\d.,]+%), in-class ([\d.,]+%)(?=\. |$)/g, (x, a, b) => ': ' + langFill(F.scat, [0, a, b], P))],
  // a name the language knows with a percent after it ("In-class 82%")
  ['lblpct', /^(.{1,40}) ([\d.,]+%)$/, (m, F, P) => { const h = trPiece(m[1], P); return h == null ? null : h + ' ' + m[2]; }],
];
// One piece of English in a language, or null when the language doesn't know it. A word that means two things ("Late" for a paper
// and for a student) has its second meaning under the name of the part of the screen it is on (data-lc), as "att|Late".
function trPiece(k, P, ctx) {
  if (ctx && Object.prototype.hasOwnProperty.call(P.words, ctx + '|' + k)) return P.words[ctx + '|' + k];
  if (Object.prototype.hasOwnProperty.call(P.words, k)) return P.words[k];
  // On a named part of the screen the shared lines come first, so "1 late" there is a student and not a paper.
  const fills = () => { if (P.fill) for (const [key, re, fn] of LANG_FILLS) { const m = re.exec(k); if (!m) continue; let hit = null; try { hit = fn ? fn(m, P.fill, P) : P.fill[key] != null ? langFill(P.fill[key], m, P) : null; } catch { hit = null; } if (hit != null) return hit; } return null; };   // a language without a line's wording leaves it in English
  if (ctx) { const hit = fills(); if (hit != null) return hit; }
  for (const [re, to] of P.rules) { const m = re.exec(k); if (!m) continue; const hit = typeof to === 'function' ? to(m) : k.replace(re, to); if (hit != null) return hit; }
  return ctx ? null : fills();
}
// A line of English in a language: the whole line if it is known, else each part between " · " that is. The space around it is kept.
function trWith(s, P, ctx) {
  const k = s.trim(); if (!k) return s;
  let hit = trPiece(k, P, ctx);
  if (hit == null && k.includes(' · ')) { const parts = k.split(' · '), out = parts.map(p => { const h = trPiece(p.trim(), P, ctx); return h == null ? p : h; }); if (out.some((p, i) => p !== parts[i])) hit = out.join(' · '); }
  return hit == null ? s : s.replace(k, () => hit);
}
// For words that are drawn rather than put on the page, like the feedback page in a returned paper.
const tr = (s, ctx) => LANG_PACK && typeof s === 'string' ? trWith(s, LANG_PACK, ctx) : s;
// The parts of the page that are put into the language, and what inside them is never touched (what a teacher typed).
const LANG_ROOTS = '#rail, #vHome, #vHelp, #welcome, #findDlg, #setLang, #vSettings, #vClass .clshead, #vClass .ctabs, #vClass .ctools, #vClass .board, #classHint, #dlgBox[data-lg], #askDlg[data-lg], ' +
  // the marking screen: its top bar and menus, the student list, the tools, the bar above each paper and the chips beside each page, and the score panel (never a page itself)
  '#app .top, #side, #tools, #paper .who, #pane2 .sph, #spGrip, #pane2 .sptool, #bsMenu, #paper .lchip, #paper .rchip, #grade, #zoomPill, #colL, #colR, #openRep, ' + ['gradebook', 'students', 'attendance', 'seating', 'missing', 'student', 'charts', 'goals', 'reports'].map(t => '#classPanel[data-tab="' + t + '"]').join(', ');
const LANG_RAW = 'script, style, textarea, [contenteditable], [data-raw], .kname, #railClasses .rl, .wllang, .tbn, .trow:not(.none) b, .hlpa p:not(.hlpgo), .hlpa ol, kbd, .rbrand, .wlbrand, #homeDate, .aiWord, .updnotes, #vSettings .nt b, #meSys option:not([value]), #meAi option:not([value]), #wlSys option:not([value]), #vClass .clshead h1, #vClass .uhead .nm, #vClass .card .t, #classPanel .bklink, #classPanel .bkpop > b, #bkaRows td:first-child, #bkaUnit option:not([value=""]), #peopleTbl td.nm a, .attname, #attDate, .attunk a, .misw, .mishead h3, .misaddr, .seat span, .seatchip, #seatSel b, .tsvg .tlb, #aClass option:not([value=""]), #aUnit option:not([value=""]), #railClasses .rnav, #classSel option:not([value=""]), #crumbClass, #stuList .nm, #paper .who h2, #paper .fhead > span:first-child, #grade .cn > span';
const LANG_ATTRS = ['title', 'aria-label', 'placeholder'];
const langCtx = el => { const c = el.closest('[data-lc]'); return c ? c.dataset.lc : ''; };
// What has been put into the language is not looked at again: a word in the language can be an English word too (German "Note" is "Grade", and "Note" in English is something else).
const LANG_DONE = new WeakMap();
const langText = n => { const p = n.parentElement; if (!p || LANG_DONE.get(n) === n.nodeValue || p.closest(LANG_RAW)) return; const v = tr(n.nodeValue, langCtx(p)); if (v !== n.nodeValue) { LANG_DONE.set(n, v); n.nodeValue = v; } };
// What she types in a box is hers; the grey words in it before she types are the app's.
// data-rawa: this one's own title or label is hers (a criterion's name), though the words inside it are the app's.
const langRawEl = el => { if (el.hasAttribute('data-rawa')) return true; const r = el.closest(LANG_RAW); return !!r && !(r === el && el.tagName === 'TEXTAREA' && !el.parentElement.closest(LANG_RAW)); };
const langAttrs = el => { if (langRawEl(el)) return; const done = LANG_DONE.get(el) || {}; for (const a of LANG_ATTRS) if (el.hasAttribute(a)) { const was = el.getAttribute(a); if (done[a] === was) continue; const v = tr(was, langCtx(el)); if (v !== was) { done[a] = v; LANG_DONE.set(el, done); el.setAttribute(a, v); } } };
function langEl(el) {
  langAttrs(el); for (const x of el.querySelectorAll('[title], [aria-label], [placeholder]')) langAttrs(x);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) langText(n);
}
const langIn = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !!el && !!el.closest(LANG_ROOTS); };
if (LANG_PACK) {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll(LANG_ROOTS)) langEl(el);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') { if (langIn(m.target)) langText(m.target); }
      else if (m.type === 'attributes') { if (langIn(m.target)) langAttrs(m.target); }
      else for (const n of m.addedNodes) {
        if (n.nodeType === 3) { if (langIn(n)) langText(n); }
        else if (n.nodeType === 1) { if (langIn(n)) langEl(n); else for (const r of n.querySelectorAll(LANG_ROOTS)) langEl(r); }
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: LANG_ATTRS });
}
// The language picker, in Settings and on the welcome: choosing one keeps it and draws the page again in it.
const langPick = id => '<select id="' + id + '" class="btn sm wllang" aria-label="Language">' + [['en', 'English'], ...Object.entries(LANG_NAMES)].map(([k, n]) => '<option value="' + k + '"' + (k === LANG_WANT ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
document.addEventListener('change', e => {
  const el = e.target; if (!el || (el.id !== 'setLangPick' && el.id !== 'wlLang')) return;
  try { if (el.value === 'en') localStorage.removeItem('gs.lang'); else localStorage.setItem('gs.lang', JSON.stringify(el.value)); } catch {}
  location.reload();
});
// For the tests and for whoever writes a language file: every piece on the covered parts of the screen as it is now that the language doesn't know.
// Run it with the app in English.
window.__gsLang = { lang: LANG, want: LANG_WANT, packs: Object.keys(LANG_NAMES), load: langLoad, tr: (s, k) => trWith(s, langPack(k)), missing(k) {
  const P = langPack(k), out = new Set(), see = (s, el) => { const word = s => /[A-Za-z]{2}/.test(s.replace(/\{[A-Za-z]+\}/g, '')), t = (s || '').trim(), c = langCtx(el); if (!t || !word(t)) return; if (trPiece(t, P, c) != null) return; for (const p of t.split(' · ')) { const q = p.trim(); if (q && word(q) && trPiece(q, P, c) == null) out.add(q); } };
  for (const r of document.querySelectorAll(LANG_ROOTS)) {
    if (!r.checkVisibility()) continue;
    for (const x of [r, ...r.querySelectorAll('[title], [aria-label], [placeholder]')]) if (!langRawEl(x)) for (const a of LANG_ATTRS) see(x.getAttribute(a), x);
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) if (n.parentElement && !n.parentElement.closest(LANG_RAW) && !n.parentElement.closest('#hlpList') && (n.parentElement.closest('select') || n.parentElement).checkVisibility()) see(n.nodeValue, n.parentElement);   // the Help answers are the language file's own (help), not looked up
  }
  return [...out];
} };
