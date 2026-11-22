// Builds the new app into next/: the pages (next/index.html, next/proof.html) and their code (next/dist/). The current app's build
// (build.js) is not touched, and nothing here goes into its pages or its size budgets.
//
//   node next/build.js          (npm run next:build)
//
// ES modules, split into chunks by esbuild, Preact for the screens. Every page of the new app starts with the same few lines
// as the current app's (src/samplemode.js), so the sample keeps its own names here too. The output is committed, since the
// site is served from the repository, and CI checks it is what next/src builds.
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const ROOT = path.join(__dirname, '..'), NEXT = __dirname, DIST = path.join(NEXT, 'dist');

// The current app's languages, each by its code and its own name (the same list as build.js LANGS), for the Language setting.
function langList() {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8'), L = JSON.parse(/const LANGS = (\[.*\]);/.exec(src)[1].replace(/'/g, '"'));
  return L.map(([code, file, obj]) => {
    const text = fs.readFileSync(path.join(ROOT, 'src/lang-' + file + '.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/[ \t]*\r?\n/, '') + '\nreturn ' + obj + ';';
    return [code, new Function(text)().name];
  });
}
// The saved-work format the current app writes (src/migrate.js DATA_V). The new app never changes the format: it writes only to
// saved work at this version, so it never writes over work a newer version has changed.
function dataVersion() {
  const src = fs.readFileSync(path.join(ROOT, 'src/migrate.js'), 'utf8'), m = /const MIGRATIONS = \[([\s\S]*?)\n  \];/.exec(src);
  if (!m) throw new Error('src/migrate.js: MIGRATIONS not found');
  return Math.max(1, ...[...m[1].matchAll(/^\s*\{\s*to:\s*(\d+)/gm)].map(x => +x[1]));
}
// next/version.json: every file the new app's worker (next/sw.js) keeps, with its SHA-256, so a version is only ever taken whole.
function writeVersion() {
  const crypto = require('crypto'), sum = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(NEXT, f))).digest('hex');
  const files = { 'index.html': sum('index.html') };
  for (const f of fs.readdirSync(DIST).sort()) if (!/^(meta\.json|gallery|proof)/.test(f)) files['dist/' + f] = sum('dist/' + f);
  const build = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version;
  fs.writeFileSync(path.join(NEXT, 'version.json'), JSON.stringify({ version: version + '-next', build, files }, null, 1) + '\n');
}

// next/src/engines/merge.js: the current app's merge code (src/merge.js, which touches neither the page nor storage), made into a
// module so the new app stamps and merges saved work with the very same functions. Made here, never edited by hand.
function writeEngines() {
  const src = fs.readFileSync(path.join(ROOT, 'src/merge.js'), 'utf8');
  const out = '// MADE BY next/build.js FROM src/merge.js. Do not edit: change src/merge.js and build again.\n/* eslint-disable */\n' + src +
    '\nexport { hashOf, recHash, revsOf, stampData, workCounts, workVec, libPrev, stampLib, mergeLib, mergeWork, mergeStates, mergeLs, focusShared, planTimeMerge, taughtInMerge, vJoin, tabDiffers, tabMerge, mergePlan, libLinked, libFollow, libHold, snapKeep };\n';
  fs.mkdirSync(path.join(NEXT, 'src/engines'), { recursive: true });
  const f = path.join(NEXT, 'src/engines/merge.js');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) fs.writeFileSync(f, out);
  writePlanner();
  writeActivities(); writePbank();
  writeGrading();
  return out;
}
// next/src/engines/planner.js: the Planner's engines (next/docs/engines.md, "Planning engines"), cut by name out of src/planner by
// next/tools/lift.js with everything they use. Made here, never edited by hand.
// Only what the new app calls: every name here comes with everything it uses, and each planning screen loads all of it, inside the
// 60 KB screen budget (next/budgets.json route). A screen that needs another engine adds its name here.
const PLANNER_ROOTS = [
  // the timetable and the school week
  'L', 'plWeekOffs', 'mondayOf', 'meetingsOn', 'partnerSlots', 'unitAt', 'unitEnd',
  // lessons and slides: the model, the deck rules (28 to 36 pt, agenda on slide 2), drawing and measuring a slide
  'lid', 'LAYOUTS', 'deckAgenda', 'deckSizes', 'deckAdd', 'deckSizeSay', 'normSlide', 'normLesson', 'deckStart', 'slideHtml', 'slideFit', 'tplPreview',
  // files: the lesson's file in the Planner folder, the .pptx from the teacher's template
  'lessonForFile', 'fileBase', 'b64ToU8', 'buildPptx', 'mimeOf',
  // the assistant: the lesson as one message, the .zip that comes back, versions
  'lessonText', 'lessonZipAsk', 'lessonContext', 'lessonBack', 'ZIP_SKIP', 'baseName', 'MAX_FILE', 'snap', 'MAX_VERSIONS',
  // a lesson's materials and links
  'uniqueName', 'normLinks', 'lkUrl', 'lkHost',
  // units
  'normUnit', 'tplLayouts',
  // where each class got to, for the phone's notes put on their lessons (planning/taught-fold.js)
  'normTaught', 'rtParse', 'rtInlineHtml',
];
const TOOLS_ROOTS = ['pptxToSlides', 'docxOf', 'shareLesson', 'finSig', 'docClean', 'DOC_CSS', 'shrinkPic', 'imgSrc',
  // slide looks and the editor's text tools: per-box sizes, biggest that fits, moving a box, lists and formatting (src/planner/boxes.js, rich.js)
  'LOOKS', 'lookOf', 'ownTpl', 'PT', 'BOX_KEYS', 'boxSizes', 'boxUsual', 'boxSize', 'boxOver',
  'rtHtml', 'rtLineHtml', 'rtRead', 'rtTidy', 'rtRenumber', 'rtCurLines', 'rtLvl', 'rtSetKind', 'rtSetLvl', 'RT_NOCOLOR',
  // notebook and the unit a lesson is in
  'nbClean', 'nbText', 'lessonUnit', 'videoFrom', 'ytId', 'ytStart'];
const PFOLDER_ROOTS = ['plAi', 'FOLDER_MARK', 'folderReadme', 'unitBase', 'unitForFile', 'bankBase', 'bankForFile', 'slideKey', 'deckClean', 'meetsOn', 'mbUrl', 'ymd', 'parseYmd'];
const PLANNER_DENY = ['$', 'toast', 'openDlg', 'closeDlg', 'lTx', 'kvGet', 'kvSet', 'kvDel', 'lPut', 'lDelete', 'lOpenDb', 'saveBlob', 'renderLessons', 'renderWeek',
  'renderEditor', 'renderStage', 'renderUnits', 'renderUnit', 'renderSemester', 'renderBank', 'renderLibrary', 'renderActivities', 'openLesson', 'folderWriteSoon',
  'unitWriteSoon', 'bankWriteSoon', 'copyText', 'refreshThumb'];
// next/src/engines/activities.js: the Planner's activity bank (src/planner/activities.js), lifted the same way into its own module so
// only Library > Activities loads its words. normSlide and lid come from the planner engine, so a slide made here is the Planner's own.
function writeActivities() {
  const { lift } = require('./tools/lift.js');
  const out = lift({ roots: ['ACTIVITIES', 'PARTS', 'KINDS', 'BOOK', 'actVideo', 'actSlide', 'normActivity'], deny: PLANNER_DENY,
    header: '// MADE BY next/build.js FROM src/planner/activities.js (next/tools/lift.js). Do not edit: change the source and build again.\n/* eslint-disable */\n',
    given: ['normSlide', 'lid'], preamble: "import { normSlide, lid } from './planner.js';\n" });
  const f = path.join(NEXT, 'src/engines/activities.js');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) fs.writeFileSync(f, out);
}
// next/src/engines/pbank.js: the rubric bank's rules (src/planner/bank.js): tidying a rubric or a scale as the Planner saves it, presets and
// rescaling. L and lid come from the planner engine; the new app puts the bank in L.bank before calling, as the Planner does.
function writePbank() {
  const { lift } = require('./tools/lift.js');
  const out = lift({ roots: ['tidyBank', 'normScale', 'scaleTop', 'normRef', 'normRubric', 'normBankScale', 'presetScale', 'rescale', 'bTop', 'bMax', 'bLevels', 'bOneTop', 'bRowScale', 'B_TOP', 'B_TOP_MAX', 'bankNatural', 'bankRubrics', 'bankScales'], deny: PLANNER_DENY,
    header: '// MADE BY next/build.js FROM src/planner/bank.js (next/tools/lift.js). Do not edit: change the source and build again.\n/* eslint-disable */\n',
    given: ['L', 'lid'], preamble: "import { L, lid } from './planner.js';\n" });
  const f = path.join(NEXT, 'src/engines/pbank.js');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) fs.writeFileSync(f, out);
}
function writePlanner() {
  const { lift } = require('./tools/lift.js');
  const out = lift({ roots: PLANNER_ROOTS, deny: PLANNER_DENY,
    header: '// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.\n' +
      '// L holds what the Planner keeps in memory: the new app puts the timetable in L.setup (and lessons, units) before calling.\n/* eslint-disable */\n',
    given: ['myActivities'],
    // The teacher's own activities come from L.activities (the new app reads them with the rest), not from the Planner's database.
    preamble: "import * as fflate from 'fflate';\nconst myActivities = async () => ((L && L.activities) || []).filter(a => a && a.name);\n" });
  // next/src/engines/plantools.js: what the lesson's own tools need beyond that (reading a finished .pptx, a lesson file to share,
  // a document as .docx, rich slide text, looks, a class's lasting links). Lifted the same way into its own module, loaded only by
  // the lesson tools screen; every name the planner engine already holds is imported from it, so both share one L.
  const decl = new Set([...out.matchAll(/^(?:async )?function\*? ?(\w+)|^(?:const|let|var) (\w+)/gm)].map(m => m[1] || m[2]));
  const tools = lift({ roots: TOOLS_ROOTS, deny: PLANNER_DENY, header: '', given: [...decl] });
  const used = [...decl].filter(n => new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b').test(tools));
  const head = '// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.\n/* eslint-disable */\n';
  // Only Present needs to choose which of today's classes is meeting now.
  const present = lift({ roots: ['prSlotNow'], deny: PLANNER_DENY, given: ['meetingsOn'], header: head,
    preamble: "import { meetingsOn } from './planner.js';" });
  const presentFile = path.join(NEXT, 'src/engines/present.js');
  if (!fs.existsSync(presentFile) || fs.readFileSync(presentFile, 'utf8') !== present) fs.writeFileSync(presentFile, present);
  const toolsOut = head + "import * as fflate from 'fflate';\nimport { " + used.join(', ') + " } from './planner.js';\n" + tools;
  // next/src/engines/pfolder.js: the Planner folder's own words and file shapes (src/planner/lessons.js folderReadme, units.js
  // unitBase, bank.js bankForFile) and what reading a teacher profile there needs, loaded only when a Planner folder is linked.
  // Only L is shared with the planner engine (the rest is copied in), so the screens that load that engine carry none of this.
  const pfOut = head + "import { L } from './planner.js';\n" + lift({ roots: PFOLDER_ROOTS, deny: PLANNER_DENY, header: '', given: ['L'] });
  const pff = path.join(NEXT, 'src/engines/pfolder.js');
  if (!fs.existsSync(pff) || fs.readFileSync(pff, 'utf8') !== pfOut) fs.writeFileSync(pff, pfOut);
  const exported = new Set(PLANNER_ROOTS), extra = used.filter(n => !exported.has(n));
  const plannerOut = extra.length ? out + 'export { ' + extra.join(', ') + ' };\n' : out;
  const f = path.join(NEXT, 'src/engines/planner.js');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== plannerOut) fs.writeFileSync(f, plannerOut);
  const tf = path.join(NEXT, 'src/engines/plantools.js');
  if (!fs.existsSync(tf) || fs.readFileSync(tf, 'utf8') !== toolsOut) fs.writeFileSync(tf, toolsOut);
  // The slide's own look (what slideHtml draws), taken from the Planner page's stylesheet: the rules about the slide and its text,
  // not the editor around it. The two sizes the slide borrows from the current app's tokens come with it.
  const page = fs.readFileSync(path.join(ROOT, 'src/planner/planner.html'), 'utf8'), st = page.slice(page.indexOf('<style>') + 7, page.indexOf('</style>'));
  const KEEP = /\.(ls-(slide|bg|body|bx|fade|full|fullsrc|lk|ph|pic|play|rule|shape|src|sub|t|trule|tslide|ttl|vid|vlink|wood)|rt|lk-[a-z]+|rt-[a-z]+)(?![\w-])/;
  const DROP = /\.(ls-(stage|mini|ta|rted|frame|ed|over|grip|grips|boxback|stagewrap)|pl-|rt-(tools|tb|pal|sw|sep))|::?(hover|focus)/;
  const css = '.ls-slide{--text-heading:24px;--text-display:28px}\n' + st.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/*') && KEEP.test(l) && !DROP.test(l)).join('\n');
  const g = path.join(NEXT, 'src/engines/slidecss.js'), js = '// MADE BY next/build.js FROM src/planner/planner.html. Do not edit.\nexport default ' + JSON.stringify(css) + ';\n';
  if (!fs.existsSync(g) || fs.readFileSync(g, 'utf8') !== js) fs.writeFileSync(g, js);
}

// The grading engines (stage 4, next/docs/engines.md "Grading engines, as lifted"): cut by name out of the grading page's source (the
// files build.js joins inside gsData.boot, in its order) by next/tools/lift.js, the same way as the Planner's. Never edited by hand.
//
// The grading page keeps its open work in top-level variables (batch, cur, setup, lib…). Here they are the engine's own state: they
// are declared once, in gcore.js, and the marking screen hands them in with use({ batch, setup, lib, … }) before it calls an engine,
// so the lifted text stays the current app's text, and a mark is drawn, scored and exported by the very same lines in both apps.
// Each later module imports what it uses from the modules before it; esbuild refuses a module that assigns to one of those, so
// only gcore.js can change the state.
//
// store: the current app's get/set over localStorage. Here it is engines/gstore.js, which goes through whatever the screen gives it
// (students/prefs.js: registered keys only, writes only with the lock), and reads nothing before that.
const GRADING_STATE = {
  batch: 'null', cur: '0', setup: 'null', lib: '{ classes: [], loose: { id: "", units: [] } }', tool: "'pen'", selected: 'null', zoom: '1',
  pages: '[]', docs: '[]', docMap: 'new Map()', undoStack: '[]', redoStack: '[]', bank: '[]', disp: 'null',
  inkColor: "'red'", hlColor: "'yellow'", penW: '2', checkInk: "'green'", CHECK_INK: "'#1E8A4C'", ptsInk: "''", once: 'null', onceEl: 'null',
  LANG_LOCALE: 'undefined', tr: '(s) => s', libVer: '0', keptMeta: 'new Map()',
  // the Grades tab's order (src/app/dialogs.js gradesOrder): roster or folder
  gradesOrder: "'roster'",
  // the screen's own: a change was made (the screen saves it through students/write.js), and what to redraw
  saveSoon: '() => {}',
  // the libraries, loaded by the screen when a paper needs them (each has its own budget) and handed in
  pdfjsLib: 'null', PDFLib: 'null', fflate: 'null', mammoth: 'null', html2canvas: 'null', workerReady: 'Promise.resolve()',
  // the iPhone photo decoder (libheif-js, src/engines/heic.js): its own chunk, fetched only when an HEIC picture is read
  // (with pdf-lib, which the photo's page is made with, when the screen hasn't loaded it yet)
  heicLoad: "() => import('./heic.js').then(async m => { if (!PDFLib) PDFLib = await m.pdflib(); return m.heic(); })",
  // Hooks: what the lifted marking code calls that belongs to the screen. The marking screen hands in its own with use({ ... });
  // until it does, each is quiet. writeWork is where a lifted saveNow hands the work it built: the screen saves it through
  // students/write.js saveWork. The window checks (tabLive and the rest) are students/write.js's, so here they let the save through.
  toast: '() => {}', renderList: '() => {}', renderTools: '() => {}', renderGrade: '() => {}', openStudent: '() => {}', renderPage: '() => {}',
  gradeMarksChanged: '() => {}', gradeShown: '() => {}', openImported: '() => {}', rescanFile: '() => {}', editText: '() => {}', openNote: '() => {}',
  openStampMenu: '() => {}', placeScore: '() => {}', stopScorePlace: '() => {}', scanNote: '() => {}', refound: '() => {}', endOnce: '() => {}', setTool: '() => {}',
  lightPagesChanged: '() => {}',
  // the teacher's own assistant by name, for what is made for it (Share with your assistant): handed in by the dialog
  aiSay: "() => 'your assistant'",
  // group work: the partner new marks and notes are just for (src/groups.js groupJust), one for every module that reads it
  groupJust: 'null',
  scorePlacing: 'null', activeEditor: 'null',
  writeWork: '() => {}', tabLive: '() => true', tabForgot: '() => false', tabLetGo: '() => {}', tabsBehind: '() => false', saveBehind: '() => {}', stampWork: '() => {}',
};
// What the lifted code calls that belongs to the screen (a toast, a redraw): quiet here, the new screen says and draws things itself.
const GRADING_STUBS = { pickedUpNew: '() => false', histFill: '() => {}', nameFlagsShow: '() => {}', renderKept: '() => {}', groupNoteRefresh: '() => {}', groupBandRefresh: '() => {}' };
const GRADING_DENY = ['$', 'openDlg', 'closeDlg', 'sayDlg', 'saveLib', 'keepWork', 'go', 'routeNow', 'paperPut', 'folderSaved', 'syncSoon', 'homeRender'];
// Names that are only local variables in what is lifted (an unrelated top-level declaration has the same name).
const GRADING_LOCAL = ['inside', 'num', 'average'];
// Each module: [file, roots, preamble, given, uses, real]. Later modules may use anything the earlier ones declare. real: names on
// GRADING_LOCAL that this module's code does use as top-level declarations (the grade sheet's num).
const GRADING = [
  ['gcore', [
    // grade maths (src/app/start.js, grades.js, ib.js, quiz.js)
    'setupOver', 'DEFAULT_SETUP', 'setupMax', 'rowsMax', 'rowTop', 'rowHalf', 'rowSteps', 'rowLevels', 'rowsTop', 'rowsSay', 'rowScaleOf', 'SCALE12', 'SCALE_FIVES',
    'RUBRIC_STEPS', 'maxPoints', 'roundPct', 'pointsWith', 'pointsFor', 'percentFor', 'percentWith', 'gradeOf', 'tryGrade', 'scoreOf', 'ownGrade', 'withTries',
    'retakeRule', 'RETAKE_RULES', 'addXc', 'xcSay', 'fmtNum', 'fmtPct', 'noScore',
    // the marks' colours
    'COLORS', 'HL', 'NOTE_COLORS', 'TEXT_COLORS', 'PTS_AMBER', 'QZ_GOLD', 'ptsColor', 'totalInk', 'setCheckInk',
  ]],
  ['gdraw', [
    // drawing marks on a page, shared by the screen and the export (src/app/draw.js, marking.js, stamps.js, lighting.js)
    'FONT', 'AT_END', 'drawMarks', 'layoutNotes', 'textLayout', 'wrapText', 'bboxOf', 'sideFor', 'sideScreen', 'drawStamp', 'stampBox', 'strokePath', 'drawHls',
    'stickersReady', 'STICKERS', 'lightLut', 'lightCanvas', 'draw', 'marksMine', 'loadLines', 'anonOn', 'shownName', 'viewBytes', 'impHas', 'fileSeq', 'layoutOf', 'docIn', 'docAuto', 'fileByPath', 'viewable', 'vpRot', 'vpDraw', 'skewXf', 'rotOf', 'skewOf',
    // Arrange pages (src/app/arrange.js, files.js, lighting.js): the paper as turned in, how files line up, which pages lighting touches
    'defaultLayout', 'seqSig', 'pageLit', 'setPageLit', 'lightLive',
    // Lighting (src/app/lighting.js): the download's and each page's own, and Auto fix
    'lightAuto', 'lightFor', 'lightOpts', 'lightKey', 'pageOwnL', 'setPageOwnL', 'LIGHT0', 'lightOn',
  ], "import STICKER_SRC from './stickers.js';\n", ['STICKER_SRC']],
  ['gopen', [
    // opening a kept download as the current app does (src/app/open.js intake, with fromKeep): its files, students and saved work
    'paperGet', 'srcRead', 'spellLikeSaved', 'groupRaw', 'houseFile', 'makeFile', 'batchIdOf', 'revsBase', 'restore', 'rosterSort', 'loadAdded', 'loadEdits',
    'applyRubricPage', 'loadRefs', 'photoTurns', 'natural', 'newestWork', 'cardOfKept', 'findItem', 'holders', 'rubricsDiffer', 'workScored', 'rubricFitting',
    'junk', 'unzipInto', 'qmkFor', 'revsOf', 'partHashes', 'batchClass',
    // a newer copy of a download (src/carryover.js): the comparing and mapping; what writes is in app/mark/carry.js through students/write.js
    'compareFiles', 'compareNames', 'matchLevel', 'mapBoxes', 'mapLit', 'mapPaths', 'rubricNamed', 'sameBytes', 'nfc', 'carryRoster', 'lostPages', 'studentOf', 'hasGsTail', 'underId', 'REF_KEY', 'isNotes',
  ]],
  ['gmark', [
    // marking a page as the current app does (src/app/paper.js bindPage, src/marking.js, src/stamps.js): the pen, highlighter,
    // shapes, checks, eraser, moving and resizing marks, undo and redo; and saveNow, which builds the record to save
    'bindPage', 'undo', 'redo', 'snap', 'changed', 'pushUndo', 'gradeSnap', 'fieldSnap', 'commitEditors', 'stepSize', 'saveNow', 'placeStamp', 'redrawAll',
    'hitMark', 'moveMark', 'keepOnPage', 'deleteSelected', 'gripDrag', 'r1', 'clamp',
    'turnMarks', 'stepOf', 'reshape', 'thumbCache', 'setRot',
    // the right-click menu's marks (src/stamps.js openStampMenu; the menu itself is the new screen's)
    'circleWord', 'highlightWord', 'textBoxHere',
    // scoring (src/grades.js, src/app/panels.js): the score changes as the current app makes them
    'scoreTouched', 'setStatus', 'touchGrade', 'nextUnscored', 'stampName', 'isSticker', 'isProof', 'PROOF', 'PUNCT', 'BRAINROT', 'wordUnder', 'newCheckSize', 'stickerAspect', 'RECENT_STAMPS',
    // the screen's own keys and stamps (src/app/wiring.js keydown, src/app/calc.js placeScore, src/app/panels.js): a picked mark resized,
    // the highlighter's snap, the score and a row's score put on the paper
    'canResize', 'setHlMode', 'hlMode', 'critStampOf', 'scoreStampText', 'stampOwner', 'newStampSize', 'fmNow',
    // the mark key's wording, for Settings > Marking (src/stamps.js openMarkKey)
    'markLabel0', 'MARK_MEAN', 'MARK_KEY',
    // one undo step for several students' grades (src/anchors.js setAnchor: a level moved from one paper to another)
    'groupStep', 'gradeStep',
  ], "// a focus session on these papers with shortest first on picks the next paper (src/gradeplan.js gpShortNext): the new app has the plan\nconst gpReady = true;\n// the session as it runs (src/focus.js fcRun): a planning key the students side reads but never writes (shared/keys.js)\nconst fcRun = () => { try { const r = JSON.parse(localStorage.getItem('gsp.focusRun') || 'null'); return r && r.st ? r : null; } catch { return null; } };\n", ['gpReady', 'fcRun'], ['gcore', 'gdraw']],
  ['gexport', [
    // what goes back to students (src/app/export.js, src/feedback.js, src/exportreport.js, src/anchors.js): which files, their names,
    // each paper with its marks baked in, the feedback page; the grades read off the papers and the grade sheet (src/app/gradesheet.js);
    // the Grades tab's rows (src/app/dialogs.js) and Returned (src/tabs.js)
    'exportPlan', 'nameOut', 'outStem', 'flattenDoc', 'oneLeftOver', 'xOne', 'xNames', 'xEdit', 'xAll', 'xEarly', 'gotEarly', 'canvasJpg', 'exportWhy', 'fbOn', 'keyOn', 'asgName', 'fileSafe', 'outWord',
    'scanAll', 'buildSheetPdf', 'parseGrade', 'foundLabel', 'manyReads', 'readsCount', 'disagreeNote',
    // the files nothing could be drawn from (src/exportreport.js unopenable); the check before returning's unmarked files are in
    // next/src/app/mark/out.js (src/grades.js unmarkedFile), so the drawing engine doesn't grow for them
    'unopenable', 'wordFound', 'wordScore',
    'gradeRows', 'tableHead', 'tableRow', 'gradesSummary', 'cellCopy', 'totalText', 'statusText', 'rowShown', 'scoreText', 'cellOut', 'csvCell', 'tsvLine', 'bandOf', 'ibSetup',
    'meGrade', 'pctAvgText', 'setKey', 'keyRows', 'classStats', 'leftOutText', 'spreadBins', 'onThisScale', 'partNote', 'STATUS_LABEL', 'triesSay',
    'anchorDocs', 'anchorDocPdf', 'anchorFile', 'anchorsHere', 'ANCHORS', 'anchorOf', 'anchorLabel', 'setAnchor', 'anchorCoverOn',
    'wordPagesPdf', 'WP_MAX', 'scanFile',
    // the Grade sheet's rows and what she says about a grade read off a paper (src/app/gradesheet.js, src/grades.js)
    'sheetRows', 'appScored', 'appShots', 'rowGraded', 'splitReads', 'readKey', 'readingDoubt', 'quietReads', 'paperScore', 'rivalReads', 'paperBytes', 'fileIn',
    // a paper's pages drawn as an assistant or the same-score view sees them (src/app/claude.js sharePage, shareDocs)
    'sharePage', 'shareDocs', 'classCommon', 'nameFreeText', 'shareOpts', 'nameFindOn',
  ], "// the Grade sheet's choices, which the current app keeps in module variables: read and set from the Grades tab\nexport function sheetSet(o) { if ('all' in o) sheetAll = !!o.all; if ('found' in o) sheetFound = !!o.found; if ('out' in o) sheetShowOut = !!o.out; }\nexport const sheetNow = () => ({ all: sheetAll, found: sheetFound, out: sheetShowOut });\n", [], ['gcore', 'gdraw', 'gopen'], ['num', 'inside']],
  ['greport', [
    // the opening report (src/intake.js openingFacts, checkStack): what opened, what didn't and why, who has nothing, and anything odd
    'openingFacts', 'checkStack', 'checkFile', 'repHead', 'zipSay', 'troubleOf', 'troubleText', 'hash', 'textOf',
    // files sorted to students by the names in their file names (src/app/bringin.js sortGuess, guessAmong: Bring in files, Match files to a roster)
    'sortGuess', 'guessAmong', 'nameWords',
  ], '', ['drop'], ['gcore', 'gdraw', 'gopen'], ['num', 'inside']],   // drop: only ever rtfText's own counter here
  ['gfiles', [
    // a student's files changed on the marking screen (src/app/kept.js addFiles, src/app/replace.js, src/app/bringin.js bringIn):
    // what a file added, removed, brought back or replaced does to the student, and how files are sorted to students by name
    'goneNow', 'markCount', 'replacedOf', 'freshRows', 'guessNewName', 'fileShown', 'sortTag', 'madeFromWord', 'setDocIn', 'gradeWords', 'wordsJoin', 'moveFileNow', 'gradeHasWork', 'pasteTextPdf', 'pasteClean', 'pasteName', 'outPages',
    // marks from other apps (src/imported.js): read off a file and made hers; what changes the file is in app/mark/change.js
    'impRead', 'impCount', 'gsFlatCheck', 'impKind',
    // splitting a scan (src/app/scansplit.js, src/scans.js): each page read as it comes, the page's turn and straightening, the
    // blank-page check, and what was decided going along with each student's new file; the dialog itself is app/mark/split.jsx
    'scanLook', 'scanDarken', 'spView', 'spXf', 'scanSplitSays', 'scanHint', 'scanHintsAll', 'scanBytes', 'spRange', 'spWho', 'spAll', 'spLight', 'splitIntoNames', 'rosterMatch', 'splitInk', 'scanRescans',
    // the strip above a scanned page (src/scans.js scanNote): Turn it, Straighten, Put back, Fix the lighting
    'scanTurn', 'scanStraighten', 'scanLight', 'scanLightBack', 'scanAsks',
  ], '', [], ['gcore', 'gdraw', 'gopen', 'greport'], ['num', 'inside']],
  ['gmedia', [
    // video and audio papers (src/video.js, src/app/media.js, src/app/readings.js): links and how they play, a kept video's id, a video
    // turned for one filmed sideways, transcripts read from what she pastes or made in this browser by the speech engine, notes pages
    'linkClean', 'linkOf', 'linkPlayer', 'linkTitle', 'linkHost', 'linkBytes', 'vidRef', 'drvRef', 'keptId', 'linkKey', 'vrotKey', 'vrotOf', 'frameTicks', 'fmtSize',
    'MEDIA_RX', 'VIDEO_RX', 'MIME', 'extOf', 'fmtTime', 'trLines', 'trText', 'trParse', 'trMakeable', 'transcribe', 'asrStop', 'asrStandIn',
    'notesPdf', 'npRows', 'npFileName', 'isNotes', 'notesFileOf', 'NP_TAIL', 'vidBytes', 'sameVideo',
    // clips: a part of a video to show the class, two times and a label kept in batch.clips (src/video.js clipStrip, clipShow)
    'clipSecs', 'clipFrame', 'clipSpan', 'clipsOf', 'clipFile',
  ], '', [], ['gcore', 'gdraw']],
  ['gnotes', [
    // typed notes (src/typednotes.js): the page she types on, drawn from the blocks and read back by walking it, the bar, the margin's
    // times and marks, Enter, a paste read from an inert copy, each change one undo step; and the Timer's clock for a talk given live
    // (src/sidepane.js). The listeners that src/typednotes.js puts on the page are the new screen's (app/mark/typed.js).
    'tnDraw', 'tnLoad', 'tnPaint', 'tnMore', 'tnBar', 'tnGutter', 'tnShowTime', 'tnAllHid', 'tnApply', 'tnStyle', 'tnList', 'tnMark', 'tnIndent', 'tnHl',
    'tnTime', 'tnEnter', 'tnInsert', 'tnFromHtml', 'tnParse', 'tnText', 'tnSync', 'tnPos', 'tnSetPos', 'tnRestore', 'tnReadAll', 'tnBack', 'tnPut', 'tnSnap',
    'tnStored', 'tnHidden', 'tnTimesOn', 'tnBackOn', 'tnSizeOf', 'tnHead', 'TN_SIZE', 'tnView',
    'spClockOf', 'spClockMs', 'spClockGo', 'spTalk',
  ], `// The page the notes are drawn in, and what gives a new paragraph its time (a playing video, or the Timer): the screen hands them in.
let tnHostEl = null, tnNowFn = () => null;
export const tnUse = o => { if ('host' in o) tnHostEl = o.host; if ('now' in o) tnNowFn = o.now; };
const tnHost = () => tnHostEl;
const tnEd = () => (tnHostEl ? tnHostEl.querySelector('.tned') : null);
const tnNow = st => tnNowFn(st);
// The blocks on the page, read and set by the screen's listeners (src/typednotes.js sets them from its own).
export const tnGetL = () => tnL;
export const tnSetL = v => { tnL = v; };
export const tnGetSt = () => tnSt;
export const tnQuietSet = v => { tnQuiet = v; };
export const tnIsQuiet = () => tnQuiet;
export const tnRngSet = r => { tnRng = r; };
`, ['tnHost', 'tnEd', 'tnNow'], ['gcore', 'gdraw', 'gmark', 'gmedia']],
  ['ggroup', [
    // group work (src/groups.js): partners put together on one paper, left again, the way a group is graded (one grade, a group score
    // adjusted for one partner, or own scores with shared notes), each change put back whole by its snapshot; and a scan's shared pages
    'groupAdd', 'groupSync', 'groupLeave', 'groupSetOwn', 'groupSnapOf', 'groupMates', 'groupNames', 'groupFromSplit', 'splitMates', 'shareCopies', 'groupPaper',
    'adjReset', 'adjName', 'adjSay',
  ], '', [], ['gcore', 'gdraw', 'gmark']],
  ['gcalc', [
    // the calculator (src/app/calc.js): its own small reader of sums (no eval), the keys it takes, and the words on a score sticker
    'calcEval', 'calcFmt', 'calcKeyOf', 'stickerText',
  ], '', [], ['gcore']],
  ['gsnip', [
    // a screenshot (src/snip.js): one page drawn fresh from its file with name covers painted in, the area's rectangle, and the
    // picture put on the clipboard (or saved where the browser can't copy pictures); the layer and the area picture are the screen's
    'snipPage', 'snipRect', 'copyPicture', 'canvasPng', 'nameFindOn', 'fileRx',
  ], '', [], ['gcore', 'gdraw']],
  ['gword', [
    // a Word paper on the marking screen (src/app/word.js, src/wordnotes.js): drawn from its own XML, typed in, cells shaded, boxes
    // ticked, comments named Teacher added and taken off, and the file written back; the screen around it is the new app's
    'openWord', 'wordBytes', 'renderWord', 'wApplyPara', 'wToggle', 'wShadeCell', 'CELL_COLORS', 'wordScore', 'wordCanPdf',
    'wCommentAdd', 'wCommentDrop', 'wCommentSet', 'wCommentEls', 'wCommentText', 'wCommentMap', 'wPickWords', 'wId',
    'wComments', 'wCommentsKeep', 'wSplitSpan', 'wNotesPaint',
    // scoring on her own Word rubric (src/app/wordrubric.js): the boxes read as a rubric, the score they give, the Total line written in
    'rubricModel', 'rubricScore', 'isShaded', 'RUB_HL', 'fillTotalBlank', 'wordLineHers', 'rubricToGrade', 'wordScoreGone', 'scaleDiffers',
    'wordTabOn', 'tryOfFile', 'liftStatus', 'ownGrade', 'hasOwnScore', 'wordFound', 'wordTableRead', 'readKey', 'rubricKey',
  ], '', [], ['gcore', 'gdraw'], ['num', 'inside']],
  ['gsetup', [
    // Rubric setup (src/rubrics.js, src/goals.js, src/rubricup.js): what each score means kept tidy, the learning goals a row can be
    // tagged with, and rows read out of a rubric she brings in (Word or PDF); the dialog and its one undo step are the new app's
    'tidyLevels', 'levelIn', 'goalList', 'goalById', 'goalName', 'goalsTidy', 'ruFromWord', 'ruFromPdf', 'rubricRowsInto',
    // an IB MYP class's task (src/ib.js): the class's criteria, the ones this task assesses, and its levels in the list and on a stamp
    'classWay', 'ibCrit', 'IB_TOP', 'ibTaskClass', 'ibTaskLevels', 'ibListSay', 'ibStampText',
  ], '', [], ['gcore', 'gdraw', 'gword']],
  ['ginsight', [
    // Insights > Consistency (src/insight.js): whether her scores drifted as she went, read the same way, rubric row by row, and
    // the papers that share a score; the chart, the list and the side-by-side pages are the new app's
    'consData', 'driftRead', 'rowDrifts', 'roughly', 'roughGap', 'roughStep', 'DRIFT_MIN', 'DRIFT_SURE', 'sameLabel',
    // Past work beside this one (src/insight.js): other downloads' scores and comments for this student, matched through the roster
    'histLoad', 'histFind', 'histHas', 'pastScore', 'workTime',
  ], '', [], ['gcore', 'gdraw', 'gopen', 'gexport'], ['average']],
  ['gnames', [
    // hiding names while marking and Check the covers (src/app/anon.js, src/app/claude.js checkCovers, src/insight.js cover*, src/names.js):
    // the shuffled order, which papers she has looked at, her own cover boxes and the ones she took off, and what the name search found;
    // the switch, the dialog and the page she boxes on are the new app's, and saving goes through the marking screen
    'anonShuffle', 'coverList', 'coverOk', 'coverMark', 'coverAgain', 'coverName', 'coverFirst', 'coverLine', 'boxKey', 'shareState', 'sameSpot',
    'findNames', 'nameFlag', 'nameFlagged', 'namesLooking', 'wordNoName', 'stillCounting', 'ensureCounts', 'anonCovers',
  ], '', [], ['gcore', 'gdraw', 'gopen', 'greport', 'gexport']],
  ['gshare', [
    // Share with your assistant (src/app/claude.js makeSharePackage, parseFeedback; src/marksout.js; src/insight.js SHARE_ASK): the ZIP of
    // papers as pictures under random codes with names covered, the Marks only file, and reading the reply back by code. The dialog
    // is the new app's (app/mark/share.jsx); the assistant's name comes from the screen (aiSay, handed in with use)
    'makeSharePackage', 'parseFeedback', 'codeOf', 'marksFileText', 'makeMarksFile', 'marksOpts', 'marksEmpty', 'SHARE_ASK', 'MARKS_ASK', 'shareDocs',
  ], '', [], ['gcore', 'gdraw', 'gopen', 'greport', 'gexport', 'gnames']],
  ['gquiz', [
    // Quick mark (src/quiz.js, src/ib.js ibQz*): a paper quiz's boxes, each answer cut from its page, the marks given on the paper
    // and the total stamped; the boxes editor, the cards and their keys are the new app's
    'QZ_PAD', 'QZ_HOW', 'QZ_KIND', 'QZ_ANS', 'QZ_AT', 'quizOn', 'quizMax', 'quizLabel', 'qzHow', 'qzByPts', 'qzSteps', 'qzWordsOk', 'qzWordsMine', 'qzWordsAll', 'qzStepWords', 'qzWord',
    'quizPages', 'quizMarks', 'quizCount', 'quizPart', 'quizSum', 'quizWho', 'qzDoc', 'qzClose', 'qzForget', 'qzShift', 'qzSz', 'qzOwn', 'qzSpot', 'qzCropKey',
    'qzPage', 'qzRect', 'qzCut', 'qzCrop', 'qzPageSize', 'quizSet', 'quizScore', 'qzLook', 'qzPaper', 'qzAnsMode', 'qzAnsText', 'qzAnsWant', 'qzAnsAt', 'qzAnsSpot',
    'qzAnsOld', 'qzMoved', 'qzAnsLab', 'qzAns', 'qzAnsOf', 'qzTotal', 'qzRedoPaper', 'qzDropGone', 'qzNoteOf', 'qzNoteSet', 'qzMarkInk', 'qzAnswerPic',
    'ibQzOn', 'ibQzOf', 'ibQzUsed', 'ibQzMax', 'ibQzRaw', 'ibQzTable', 'ibQzLevel', 'ibQzEven', 'ibQzParts', 'ibQzScore', 'ibQzSay',
  ], "// the papers' documents are let go once the answers being cut from them are done, so a cut under way isn't cancelled\nexport const qzLetGo = () => qzQueue.then(() => qzClose());\n", [], null],
  ['gex', [
    // strong examples from a paper (src/examples.js): one Quick mark answer cut from the clean page with every cover painted in, the
    // pages of a paper that can be kept, the score written on a picture; the boxes, the dialog and the saving are the new app's
    'exAnswerPic', 'exItems', 'exScoreText', 'exScoreMarks', 'exScoreOn', 'exScoreTop', 'exJpg', 'coverRx', 'exWho', 'exFrom', 'exTitleNow',
  ], '', [], null],
  ['gqmake', [
    // A quiz made here (src/quizmake.js, src/quizread.js): typed questions printed with bubbles and a code on each page, the code
    // read back to send each scanned page to its student, and the bubbles read and scored; the maker, the print window and the
    // answers to check are the new app's
    'QMK_T', 'QMK_L', 'qmkNew', 'qmkNew0', 'qmkPts', 'qmkLetters', 'QMK_CSS', 'qmkBits', 'qmkQ', 'qmkPageHtml', 'qmkPages', 'qmkLayout', 'qmkBoxes',
    'QR_REG', 'qrGrey', 'qrFind', 'qrH', 'qrMean', 'qrRing', 'qrCode', 'qrPageCode', 'qrSplitPage', 'qrSplitSays', 'qrStudent', 'qrDecide', 'qzAutoLetters', 'qrScoreOf',
  ], '', [], null],
  ['gways', [
    // the teacher's usual way of grading (src/app/library.js GRADE_WAYS, meGrade): what a new assignment starts with, read from the
    // library the settings screen has in hand (useLib), not the marking screen's
    'GRADE_WAYS', 'gradeWay', 'meGrade', 'ME_OLD',
  ], `let lib = { me: null };
export const useLib = l => { lib = l || { me: null }; };
`, ['lib'], ['gcore']],
  ['gkept', [
    // where each kept download stands and Today's groups (src/app/screens.js keptState, keptBack; src/app/kept.js cardOfKept;
    // src/today.js homeGroups; src/shell.js classLeft), for Home and the sidebar, read from the library and kept rows they are
    // handed (useKept), not the marking screen's
    'keptState', 'keptBack', 'cardOfKept', 'homeGroups', 'classLeft',
  ], `let lib = { classes: [], loose: { units: [] } }, keptMeta = new Map();
export const useKept = (l, k) => { lib = l; keptMeta = k; };
`, ['lib', 'keptMeta'], ['gcore']],
  ['gbook', [
    // the gradebook (src/book.js): its columns read from saved work and typed scores, each cell, each term, the weighted term grade
    // with extra credit, and a typed score parsed and put the way the current app puts it; the table and its keys are the new app's
    'BK_TYPES', 'bkConf', 'bkCats', 'bkType', 'bkIsType', 'bkIsDef', 'bkLabel', 'bkTermOf', 'bkMean', 'bkCellOf', 'bkTypedCell', 'bkLoad', 'bkClassCols', 'bkCounts', 'bkGrade', 'bkXcTo',
    'bkTabs', 'bkTermNow', 'bkClassAvg', 'bkBands', 'bkGroups', 'bkCountTypes', 'pctAvgText', 'bkParse', 'bkCellVal', 'bkColMax', 'bkPut', 'typedStamp', 'isoDay', 'bkDay', 'BK_DEF', 'rosterPairs', 'bkTypeUse',
    // IB classes (src/ib.js): an MYP class's criteria, boundaries, evidence and the level she sets; a DP class's 1 to 7 and predicted grades
    'IB_TOP', 'IB_BANDS', 'IB_GROUPS', 'IB_WAYS', 'IB_BOUNDS_DP', 'ibLetter', 'classWay', 'ibGroup', 'ibGroupCrit', 'ibBoundsFor', 'ibBoundsClean', 'ibCrit', 'ibBounds', 'ibGradeOf', 'ibLevel', 'ibBandName', 'ibTerm', 'ibEvidence', 'ibConf', 'ibCols', 'ibEvFor', 'ibMid',
    // missing work (src/missing.js): who owes what, and who was reminded
    'MIS_WORDS', 'misConf', 'misCols', 'misOwes', 'misByStu', 'misByCol', 'misNudge', 'misLate', 'misDue',
    // the roster (src/app/screens.js, src/people.js, src/attend.js): a pasted list read, and a student's details and days kept through an edit
    'mbParts', 'mbSorted', 'MB_ORDERS', 'parseRosterRows', 'keepInfo', 'keepAtt', 'infoOf', 'setInfo', 'blankInfo', 'attDays', 'attCount', 'attOf', 'attNote', 'classNewWay',
    // attendance (src/attend.js): a day taken, one student set, a day cleared, the day before or after on the class's timetable;
    // seating (src/seating.js): the room, who sits where, kept in a seat; the name picker's groups (src/pickshare.js)
    'ATT_WAYS', 'attRec', 'attDayOk', 'attSet', 'attTake', 'attClear', 'attDayCount', 'attUnknown', 'attMeets', 'attStep', 'csvSafe',
    'SEAT_ROOMS', 'SEAT_MAX_W', 'SEAT_MAX_H', 'seatXY', 'seatKeys', 'seatRoom', 'seatOf', 'seatSave', 'seatList', 'seatFill', 'seatPut', 'seatSetRoom',
    'pkNice', 'pkShort', 'pkShuffle', 'pkCount', 'pkGroups',
    // missing-work reminders (src/missing.js): one student's email, one to everyone who owes an assignment, the link, reminded today
    'misDraft', 'misGroup', 'misHref', 'misPlain', 'misEmail', 'misLine', 'misFill', 'misClassName', 'rptCall',
    // learning goals (src/goals.js): each goal's percent for each student and the class, from the rows and questions tagged with it
    'goalList', 'goalData', 'GOAL_LOW',
    // report comments (src/reports.js): what the gradebook knows about a student this term, and a draft from her own sentences
    'RPT_WORDS', 'RPT_SLOTS', 'RPT_PROS', 'RPT_LEN', 'rptConf', 'rptEntry', 'rptPut', 'rptPro', 'rptFacts', 'rptDraft', 'rptText', 'bkScored', 'bkIn', 'ibLvAt', 'ibPredOf',
    // linked classes (src/linked.js): sections of one course, copies of one assignment, and the cards made twice that look alike
    'lkKey', 'lkSibs', 'lkTwins', 'lkCopy', 'lkJoin1', 'lkLev', 'lkLike', 'lkSuggest',
    // charts (src/classpage.js): rubric rows across the summatives, for the class and one student
    'chRowAvgs', 'chSums', 'chRowTop',
  ], `// The class page hands in which class the gradebook is on (src/book.js keeps it in bk.cls); saving is the screen's, through
// students/write.js: what the lifted code changes is the library it was handed inside saveLibrary.
export const bkUse = o => Object.assign(bk, o);
// Its own library, setup and kept rows (bookUse), so a class page or Home reading the book never changes the marking screen's.
let lib = { classes: [], loose: { id: '', units: [] } }, setup = null, keptMeta = new Map();
export const bookUse = o => { if ('lib' in o) lib = o.lib; if ('setup' in o) setup = o.setup; if ('keptMeta' in o) keptMeta = o.keptMeta; };
// A retake's counting rule (gcore retakeRule) is read from the library: this one, for just the moment of the call.
import { withTries as coreTries, state as coreState, set as coreSet } from './gcore.js';
const withTries = (...a) => { const was = coreState().lib; coreSet.lib(lib); try { return coreTries(...a); } finally { coreSet.lib(was); } };
const saveLib = () => {}, bkSaveLib = () => {}, renderLib = () => {}, seatDraw = () => {};
// The Planner's timetable as attendance reads it (src/today.js plan: { classes: [{ name, meets: [{ dow }] }], daysOff: [{ date }] }), handed in by the page.
let plan = null;
export const planUse = p => { plan = p; };
`, ['lib', 'setup', 'keptMeta', 'withTries', 'saveLib', 'bkSaveLib', 'renderLib', 'seatDraw', 'plan'], ['gcore']],
  ['gtodo', [
    // To do (src/todo.js): her lines and their categories, a typed line read for its day, class, student and School people, a
    // repeating line's next day, the groups by day, and each change saved the way the current app saves it (tdSave keeps lib.todo
    // tidy); the page, the week and the lines the app adds from saved work are the new app's (app/todo/, crossings.js)
    'TD_CAT0', 'TD_DAY', 'tdData', 'tdSave', 'tdItems', 'tdItem', 'tdPut', 'tdAutoPut', 'tdCats', 'tdCat', 'tdGuess', 'tdCatOf', 'tdCatSave', 'tdCatPut', 'todoCatAdd', 'todoCatMove',
    'tdToday', 'tdAt', 'tdAdd', 'tdGap', 'tdNextMon', 'tdWordDay', 'tdReadDay', 'tdKey', 'tdReadWho', 'tdReadPpl', 'todoRead', 'todoAdd', 'tdNext', 'todoTick', 'tdGroups', 'tdSort', 'tdDoneToday',
  ], `// The library she is changing (inside students/write.js saveLibrary), the timetable for "each time this class meets", and the
// people on the School page, handed in by the page. Saving is the page's: tdSave changes lib.todo of the library handed in.
let lib = { classes: [], loose: { id: '', units: [] } }, plan = null, people = [];
export const todoUse = o => { if ('lib' in o) lib = o.lib; if ('plan' in o) plan = o.plan; if ('people' in o) people = o.people || []; };
const saveLib = () => {}, todoRender = () => {}, schPeople = () => people;
`, ['lib', 'plan', 'saveLib', 'todoRender', 'schPeople', 'setup'], []],
  ['gcount', [
    // Papers marked today (src/focus.js fcSeen, fcGain, fcCame): what each save of work tells the timer's log, and a running session,
    // so a paper counts only when it is marked, wherever. Small, apart from the timer: students/write.js loads it with a save.
    'fcSeen', 'fcGain', 'fcCame', 'fcLog', 'fcLogSet', 'fcToday', 'fcMon', 'fcRun', 'fcPut', 'fcOwnRun', 'FC_P0', 'FC_KEY', 'fcDone', 'fcKnown', 'fcPapersOf', 'fcPapersBy', 'fcFrom',
  ], `// The library, the kept rows (all of them, as they stand before this save) and the store, handed in by students/count.js.
import { useKept } from './gkept.js';
let lib = { classes: [], loose: { id: '', units: [] } }, keptMeta = new Map(), keptRead = false;
let store = { get: (k, d) => d, set: () => {}, del: () => {} };
export function countUse(o) { if ('lib' in o) lib = o.lib; if ('keptMeta' in o) { keptMeta = o.keptMeta; keptRead = true; } if ('store' in o) store = o.store; useKept(lib, keptMeta); }
const FC_ON = true;
`, ['lib', 'keptMeta', 'keptRead', 'store', 'FC_ON', 'useKept'], ['gkept']],
  ['gfocus', [
    // Focus and time (src/focus.js, src/tracker.js, src/gradeplan.js): the timer's settings and log, a session from start to its end and
    // break, papers counted only as they are marked (fcSeen, fcGain, fcCame on each save of work), the session goal, the time tracker's
    // days and sums, time added by hand, and the grading plan's free periods, due work and pace. The drawing is the new app's
    // (app/focus/); the music is engines/glofi.js, loaded when it plays.
    'FC_LENS', 'FC_BRKS', 'FC_AWAY', 'TK_IDLES', 'TK_PES', 'FC_DOWS', 'fcGoalMax', 'fcConf', 'fcConfSet',
    'fcPapersToday', 'fcSecsToday', 'fcWeekPapers', 'fcWeekMins', 'fcWeekPapersNow', 'fcGoalNow', 'fcGoalDay', 'fcRunSet', 'fcElapsed', 'fcIdle',
    'fcBusy', 'fcLeft', 'fcGot', 'fcN', 'fcClock', 'fcWorks', 'fcWork', 'fcPicked', 'fcSgSuggest', 'fcSgNow', 'fcSgN', 'fcSgMet', 'fcDaysTo', 'fcStart',
    'fcLesStart', 'fcPlanAdd', 'fcLesSecs', 'fcRecord', 'fcExt', 'fcPause', 'fcResume', 'fcMore', 'fcBreak', 'fcStop', 'fcClose', 'fcTick', 'fcTickOn', 'fcDrain', 'fcUp',
    'focusOn', 'fcS', 'fcFrac',
    'tkPlan', 'tkDay', 'tkPeriod', 'tkSum', 'tkDur', 'tkAsg', 'tkAddTime', 'tkCsvText', 'tkFlush', 'tkShare', 'tkMonday', 'tkYmd',
    'gpPaces', 'gpPaceN', 'gpKept', 'gpLeft', 'gpDue', 'gpSum', 'gpGaps', 'gpFreeNow', 'gpFreeLen', 'gpBack', 'gpPlanWeek', 'gpLesWorked', 'gpLesPace', 'gpAdd',
  ], `// What the lifted timer reads and writes, handed in by students/focus.js: the library (lib.me.focus is her settings), the kept rows, the
// timetable, and the store (gs.focus on the students side, gsp.focusRun, gsp.focusQ, gsp.planTime and gsp.timeCount on the planning
// side). What it calls that draws or moves between screens are the hooks (H), quiet until the new app hands its own in.
import { useKept } from './gkept.js';
import { todoUse } from './gtodo.js';
import { countUse } from './gcount.js';
let lib = { classes: [], loose: { id: '', units: [] } }, keptMeta = new Map(), keptRead = false, plan = null, LANG_LOCALE = undefined;
let store = { get: (k, d) => d, set: () => {}, del: () => {} }, canOpen = m => !!m && !!m.papers;
const H = { render() {}, clock() {}, title() {}, goTo() {}, lesOpen() {}, chime() {}, wake() {}, page() {} };
export function focusUse(o) {
  if ('lib' in o) lib = o.lib; if ('keptMeta' in o) { keptMeta = o.keptMeta; keptRead = true; } if ('plan' in o) plan = o.plan; if ('store' in o) store = o.store;
  if ('canOpen' in o) canOpen = o.canOpen; if ('locale' in o) LANG_LOCALE = o.locale; if ('hooks' in o) Object.assign(H, o.hooks);
  useKept(lib, keptMeta); todoUse({ lib, plan }); countUse({ lib, keptMeta, store });
}
// Something pressed, typed or scrolled (src/tracker.js tkLast): the new app's shell tells it.
export const fcActive = t => { tkLast = t; };
export const fcActiveAt = () => tkLast;
export const tkPending = () => tkPend;
export const tkCount = (k, secs) => { tkPend.g += secs; tkPend.a[k] = (tkPend.a[k] || 0) + secs; };
const FC_ON = true, tkReady = true, gpReady = true, batch = null, cur = 0, $ = () => ({ hidden: true });
const fcRender = () => H.render(), fcClockDraw = () => H.clock(), fcTitle = () => H.title(), fcGoTo = n => H.goTo(n), fcLesOpen = () => H.lesOpen();
const fcChime = () => H.chime(), fcAudioWake = () => H.wake(), tkPageRender = () => H.page(), renderProg = () => {}, routeNow = () => ({});
const me = () => lib.me || {}, meDrop = (k, v) => { const m = { ...me() }; if (v) m[k] = v; else delete m[k]; lib.me = m; };
// The music's moods, by id (engines/glofi.js LOFI_STYLES, which next/test/focus.test.js holds this to): fcConf only checks a mood is one.
const LOFI_STYLES = ['rain', 'library', 'coffee', 'night', 'tape', 'garden', 'blue', 'quiet'].map(id => ({ id }));
const tr = s => s;
`, ['lib', 'keptMeta', 'keptRead', 'plan', 'LANG_LOCALE', 'store', 'canOpen', 'FC_ON', 'tkReady', 'gpReady', 'batch', 'cur', '$', 'fcRender', 'fcClockDraw', 'fcTitle',
    'fcGoTo', 'fcLesOpen', 'fcChime', 'fcAudioWake', 'tkPageRender', 'renderProg', 'routeNow', 'me', 'meDrop', 'LOFI_STYLES', 'tr', 'useKept', 'todoUse', 'countUse', 'once'], ['gkept', 'gtodo', 'gcount']],
  ['gpanel', ['stpPanelRecord', 'stpPanelWidth'], '', [], []],
  ['gstp', [
    // My setup (src/setupin.js): a setup pasted back from an assistant read key by key, never running anything and never taking a
    // student in (stpParse, stpRead); the Planner's timetable with its classes and calendar laid over (stpPlanNext); this teacher's
    // setup copied out in the same format (stpExport); and the prompt that describes the format (stpPrompt). The preview, bringing it
    // in and undo are the new app's (app/setup/).
    'stpParse', 'stpRead', 'stpPlanNext', 'stpExport', 'stpPrompt', 'stpKey', 'STP_V', 'stpApply', 'stpUndo', 'stpUndoRec', 'stpMarkNow', 'stpTodoNext', 'stpIbChanges', 'stpOwnTypes', 'stpPersonHere',
    // what the preview compares with (the new app's own words, app/setup/diff.js)
    'me', 'meGrade', 'bkConf', 'retakeRule', 'savedRubrics', 'goalList', 'fcConf', 'tdCats', 'TD_CAT0', 'tabsKept', 'attOn', 'stpPlanGet', 'sysName', 'unitLinkName', 'mbOrder', 'mbOf', 'BK_TYPES', 'CLASS_TABS', 'STP_LAYOUTS', 'lkKey', 'stpMonday', 'aiUrlClean', 'GP_DAYS', 'gradeWay',
  ], `// What My setup reads, handed in by app/setup/stp.js (stpUse): the library, the students' store, her saved comments, the School
// page's people and spots, and how points are coloured and the student list shown.
let lib = { classes: [], loose: { id: '', units: [] } }, bank = [], ptsInk = '', listPts = false, people = [], roles = null, setup = null;
let store = { get: (k, d) => d, set: () => {}, del: () => {} };
export function stpUse(o) { if ('lib' in o) lib = o.lib; if ('bank' in o) bank = o.bank || []; if ('store' in o) store = o.store; if ('ptsInk' in o) ptsInk = o.ptsInk || ''; if ('listPts' in o) listPts = !!o.listPts; if ('people' in o) people = o.people || []; if ('roles' in o) roles = o.roles || null; }
const schPeople = () => people, schNow = () => ({ roles }), go = () => {}, saveLib = () => {};
const tr = s => s; // The setup screen supplies its translated undo result.
// What bringing a setup in does that is the page's: the School page's people (H.school(fn) changes them), the Planner's timetable
// (H.planPut), and what the page says (H.said). Quiet until the page hands its own in.
const H = { school() {}, async planPut() {}, said() {} };
export const stpHooks = o => Object.assign(H, o);
// what the engine was handed, for the preview
export const libNow = () => lib, bankNow = () => bank;
const schChange = f => H.school(f), stpPlanPut = s => H.planPut(s), stpAfter = () => {}, toast = s => H.said(s), bankJob = () => Promise.resolve(), bankRead = () => {}, batch = null, fcCardRender = () => {}, fcRender = () => {}, listDraw = () => {}, renderPage = () => {}, once = () => {};
// only words in the lifted text ("a few pages", a local cur), never the marking screen's
const cur = 0, pages = [];
`, ['lib', 'bank', 'ptsInk', 'listPts', 'people', 'roles', 'setup', 'store', 'schPeople', 'schNow', 'go', 'saveLib', 'cur', 'pages', 'H', 'schChange', 'stpPlanPut', 'stpAfter', 'toast', 'bankJob', 'bankRead', 'batch', 'fcCardRender', 'fcRender', 'listDraw', 'renderPage', 'once', 'tr'], ['gpanel']],
  ['gyear', [
    // a new school year (src/newyear.js): the year's names and its file's name, what is about a student, and the next year's library
    // (the same classes, units and cards, with no student in them unless the class lists are kept). The box and the steps are whole/'s.
    'nyLib', 'nyNames', 'nyAbout', 'nyStrip', 'nyDay', 'nyLabel', 'nyNext', 'nyGuess', 'nyFileName', 'NY_YEAR_ONLY',
  ], `// The library the year's name is guessed from, handed in by whole/newyear.js (yearUse).
let lib = { classes: [], loose: { id: '', units: [] } };
export const yearUse = l => { lib = l || lib; };
`, ['lib', 'setup'], []],
  ['glofi', [
    // lo-fi music while a session runs (src/lofi.js): made in the browser as it plays, nothing fetched
    'LOFI_STYLES', 'lofi', 'lofiCompose', 'lofiPlay', 'lofiPause', 'lofiNext', 'lofiStop', 'lofiVolume', 'lofiStyle', 'lofiAmb', 'lofiRender',
  ], '', [], []],
  // the QR code of this page's own address for Use on your phone (src/qr.js)
  ['gqr', ['qrSvg'], '', [], []],
  ['gbki', [
    // a gradebook imported from a spreadsheet (src/bookimport.js): the file read (CSV, TSV, Excel or pasted cells), its rows and
    // columns found, each column matched to an assignment already in the class, a category to a type; the screen is the new app's
    'bkiParse', 'bkiXlsx', 'bkiCell', 'bkiDate', 'bkiWide', 'bkiRead', 'bkiGuess', 'bkiFit', 'bkiMatch', 'bkiCatGuess', 'BKI_SUM', 'normName', 'gcRead', 'gcNameOf',
  ], "// the teacher's types as the class page's gradebook reads them (gbook's own library), not a copy reading the marking screen's\nimport { bkCats } from './gbook.js';\n",
  // given: bkCats from gbook; mis, te and td only look used (a local td, the word "mis" in a pattern)
  ['bkCats', 'mis', 'te', 'td'], ['gcore', 'gbook']],
];
function writeGrading() {
  const { lift } = require('./tools/lift.js');
  const head = '// MADE BY next/build.js FROM the grading page\'s source (next/tools/lift.js). Do not edit: change the source and build again.\n/* eslint-disable */\n';
  const names = Object.keys(GRADING_STATE);
  const core = "import { store, kdo, kget, idbDo } from './gstore.js';\n" + names.map(n => 'let ' + n + ' = ' + GRADING_STATE[n] + ';').join('\n') + '\n' +
    Object.entries(GRADING_STUBS).map(([n, v]) => 'const ' + n + ' = ' + v + ';').join('\n') + '\n' +
    '// The open work, handed in by the marking screen: use({ batch, setup, lib, … }). Only the names above.\n' +
    'export function use(o) {\n' + names.map(n => "  if ('" + n + "' in o) " + n + ' = o.' + n + ';').join('\n') + '\n}\n' +
    'export const state = () => ({ ' + names.join(', ') + ' });\n' +
    '// A later module that assigns one of these (the marking code clears what is picked) calls its setter instead; see setters() below.\n' +
    'export const set = { ' + names.map(n => n + ': v => (' + n + ' = v)').join(', ') + ' };\n';
  const declared = [...names, 'store', 'kdo', 'kget', 'idbDo', ...Object.keys(GRADING_STUBS)], made = {}, texts = {}, needs = {};
  const sticker = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'src/stickers')).filter(f => f.endsWith('.webp')).sort().map(f => [f.slice(0, -5), f]));
  // The decoder's licence (LGPL) travels with it, as it does in the current app's page.
  const heif = path.join(ROOT, 'node_modules', 'libheif-js');
  writeIf('src/engines/heic-license.js', '// MADE BY next/build.js FROM node_modules/libheif-js. Loaded with the decoder, never on its own.\nexport default ' + JSON.stringify('libheif-js ' + require(path.join(heif, 'package.json')).version + ': libheif (https://github.com/strukturag/libheif), libde265 (https://github.com/strukturag/libde265), built by https://github.com/catdad-experiments/libheif-js\n' + fs.readFileSync(path.join(heif, 'libheif-wasm', 'LICENSE'), 'utf8')) + ';\n');
  writeIf('src/engines/stickers.js', '// MADE BY next/build.js FROM src/stickers/. Each sticker is its own file, fetched when a page with stickers is drawn.\n' +
    Object.entries(sticker).map(([k, f], i) => 'import s' + i + " from '../../../src/stickers/" + f + "';").join('\n') + '\n// The bundler gives each file a name next to this chunk; the page is a folder up, so each is read from where this module is.\nconst at = f => new URL(f, import.meta.url).href;\nexport default { ' + Object.keys(sticker).map((k, i) => JSON.stringify(k) + ': at(s' + i + ')').join(', ') + ' };\n');
  for (const [file, roots, preamble = '', given = [], uses = null, real = []] of GRADING) {
    // uses: the earlier modules this one may import from (all of them when not given). Anything else it needs it lifts for itself,
    // so a part loaded on its own (the marking tools) doesn't bring a module it barely uses (opening a download).
    const may = uses ? declared.filter(n => !made[n] || uses.includes(made[n])) : declared;
    let out = lift({ files: 'grading', scoped: true, roots, deny: GRADING_DENY, ignore: GRADING_LOCAL.filter(n => !real.includes(n)), given: [...may, ...given], header: '', preamble: '' });
    out = engineWords(file, out);
    const own = [...out.matchAll(/^(?:async )?function\*? ?(\w+)|^(?:const|let|var) (\w+)/gm)].map(m => m[1] || m[2]);
    // const a = 1, b = 2 on one line declares b too (as lift.js reads it), so a later module imports b instead of declaring the line again
    const { depthOf } = require('./tools/lift.js');
    for (const ln of out.split('\n')) if (/^(?:const|let|var) /.test(ln)) for (const x of ln.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=|>)/g)) if (depthOf(ln.slice(0, x.index)) === 0 && !own.includes(x[1])) own.push(x[1]);
    // a name right after a dot is a property, except after a spread (...vpDraw(…))
    const used = may.filter(n => !given.includes(n) && new RegExp('(?<![\\w$])(?<![^.]\\.)' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(out));
    const imports = {};
    for (const n of used) { const from = file === 'gcore' ? null : (made[n] || 'gcore'); if (from && from !== file) { (imports[from] ||= []).push(n); (needs[from] ||= new Set()).add(n); } }
    // a name the module declares for itself in its preamble (given) is its own: assigning it is not gcore's setter
    if (file !== 'gcore') out = setters(out, names.filter(n => !given.includes(n)));
    let pre = file === 'gcore' ? core : Object.entries(imports).map(([f, l]) => 'import { ' + l.join(', ') + " } from './" + f + ".js';").join('\n') + '\n';
    if (file === 'gcore') pre += 'export { ' + names.join(', ') + ', store, kdo, kget, idbDo, ' + Object.keys(GRADING_STUBS).join(', ') + ' };\n';
    else if (/(?<![.\w$])set\./.test(out)) pre = pre.replace(/^import \{ ([^}]*) \} from '\.\/gcore\.js';/m, (m, l) => "import { " + l + ", set } from './gcore.js';") || pre;
    if (file !== 'gcore' && /(?<![.\w$])set\./.test(out) && !/import \{[^}]*\bset\b[^}]*\} from '\.\/gcore\.js'/.test(pre)) pre = "import { set } from './gcore.js';\n" + pre;
    // The one change to what is lifted: the current app has the decoder in its page, so heicToPdf reads it at once; here it is
    // fetched when the first iPhone photo arrives, so heicToPdf waits for it (an await on the same call, in an async function).
    if (file === 'gopen') { const n = out.split('const lib = heicLoad(),').length - 1; if (n !== 1) throw new Error('lift: heicToPdf changed'); out = out.replace('const lib = heicLoad(),', 'const lib = await heicLoad(),'); }
    out = head + preamble + pre + out;
    for (const n of own) { if (made[n]) continue; made[n] = file; declared.push(n); }
    texts[file] = { out, roots };
  }
  // A module may not assign a name it imports from another lifted module (only gcore's state has setters): that throws when it runs.
  for (const [file, { out }] of Object.entries(texts)) for (const m of out.matchAll(/^import \{ ([^}]*) \} from '\.\/(g\w+)\.js';$/gm)) {
    if (m[2] === 'gcore') continue;
    const rest = out.slice(m.index + m[0].length), q = n => n.replace(/\$/g, '\\$');
    for (const n of m[1].split(',').map(x => x.trim())) if (!new RegExp('\\b(?:const|let|var)\\s+(?:[^;]*?[,\\s])?' + q(n) + '\\s*[=,;]').test(rest) && new RegExp('(?<!(?:const|let|var)\\s+)(?<![\\w$.])' + n.replace(/\$/g, '\\$') + '\\s*(?:[-+*/|&]?=(?!=)|\\+\\+|--)').test(out.slice(m.index + m[0].length))) throw new Error('lift: ' + file + ' assigns ' + n + ', which belongs to ' + m[2]);
  }
  for (const [file, { out, roots }] of Object.entries(texts)) {
    const coreOut = [...names, 'store', 'kdo', 'kget', 'idbDo', ...Object.keys(GRADING_STUBS)];
    const extra = [...(needs[file] || [])].filter(n => !roots.includes(n) && !(file === 'gcore' && coreOut.includes(n)));
    writeIf('src/engines/' + file + '.js', extra.length ? out + 'export { ' + extra.join(', ') + ' };\n' : out);
  }
}
// The engines' own words in the language. The current app put what its engines draw into the language in two ways: drawn text
// (the feedback page, a notes page, an answer note) through tr(s), and the rest (the typed notes' bar, "Paper 3", a printed quiz)
// by watching the page. Here tr is gcore's, which app/engine-lines.js sets to look each line up by its English (next/lang/engine.en.json),
// and the words that went the second way are wrapped in tr(...) as they are lifted. Each change names the text it expects, and the
// build stops when the source no longer has it, so a change there can't leave words in English unnoticed.
const ENGINE_TR = {
  // a paper while names are hidden, and a student's second paper in Check the covers
  gdraw: [["anonOn() ? 'Paper ' + (anonPos(i) + 1) : st.key", "anonOn() ? tr('Paper ' + (anonPos(i) + 1)) : st.key"]],
  gnames: [["(k ? ' (paper ' + (k + 1) + ')' : '')", "(k ? ' ' + tr('(paper ' + (k + 1) + ')') : '')"]],
  // Past work beside this one: a download whose name is gone
  ginsight: [["m.name || 'An earlier download'", "m.name || tr('An earlier download')"]],
  // Quick mark: the usual words for a question's steps, and the words on top of an answer's picture
  gquiz: [
    ["if (n === 3) return ['Not shown', 'Partial', 'Full'];", "if (n === 3) return [tr('Not shown'), tr('Partial'), tr('Full')];"],
    ["k === 0 ? 'Not shown' : k === n - 1 ? 'Full' : ''", "k === 0 ? tr('Not shown') : k === n - 1 ? tr('Full') : ''"],
    ["'Question ' + quizLabel(q, qi) + ' · ' + (qzByPts(q) ? 'scored 0 to ' + fmtNum(pts) : fmtNum(pts) + (pts === 1 ? ' point' : ' points') + ', right or wrong')",
      "tr('Question ' + quizLabel(q, qi)) + ' · ' + (qzByPts(q) ? tr('scored 0 to ' + fmtNum(pts)) : pts === 1 ? tr(fmtNum(pts) + ' point, right or wrong') : tr(fmtNum(pts) + ' points, right or wrong'))"],
    ["'Answer key: ' + q.key", "tr('Answer key: ' + q.key)"],
    ["'Scale: ' + qzSteps(pts).map((v, i) => fmtNum(v) + (words[i] ? ' ' + words[i] : '')).join(', ')", "tr('Scale: ' + qzSteps(pts).map((v, i) => fmtNum(v) + (words[i] ? ' ' + words[i] : '')).join(', '))"],
  ],
  // a quiz made here, as printed
  gqmake: [
    ["m.items.length + ' questions · ' + fmtNum(qmkPts(m)) + ' points</div>", "tr(m.items.length + ' questions') + ' · ' + tr(fmtNum(qmkPts(m)) + ' points') + '</div>"],
    ["'<div class=\"qfname\"><span>Name</span>", "'<div class=\"qfname\"><span>' + tr('Name') + '</span>"],
    ["'<p class=\"qfhow\">Fill each bubble completely with a dark pencil or pen. To change an answer, erase it fully or cross it out and fill the new one.</p>'",
      "'<p class=\"qfhow\">' + tr('Fill each bubble completely with a dark pencil or pen. To change an answer, erase it fully or cross it out and fill the new one.') + '</p>'"],
    ["<div class=\"qffoot\">Page ' + (pg + 1) + ' of ' + of + '</div></div>'", "<div class=\"qffoot\">' + tr('Page ' + (pg + 1) + ' of ' + of) + '</div></div>'"],
    ["'<span class=\"qffor\">Teacher</span>'", "'<span class=\"qffor\">' + tr('Teacher') + '</span>'"],
    ["'<div class=\"qfhint\">Fill every answer that applies.</div>'", "'<div class=\"qfhint\">' + tr('Fill every answer that applies.') + '</div>'"],
    ["esc(q.text || (q.t === 'sa' ? 'Your question' : 'Your question'))", "esc(q.text || tr('Your question'))"],
  ],
  // typed notes: the margin, the bar as it changes, and a paragraph just for one partner (the bar itself is tnFrame, below)
  gnotes: [
    ["if (x.o) el.title = 'Just for ' + tnWho(x.o);", "if (x.o) el.title = tr('Just for ' + tnWho(x.o));"],
    ["el.title = 'Just for ' + tnWho(o);", "el.title = tr('Just for ' + tnWho(o));"],
    ["btn('tnhid', 'tnts', 'Show this time')", "btn('tnhid', 'tnts', tr('Show this time'))"],
    ["btn('tnhide', 'tnts', 'Hide this time')", "btn('tnhide', 'tnts', tr('Hide this time'))"],
    ["vid ? 'Play the video from here' : 'The time on the Timer'", "vid ? tr('Play the video from here') : tr('The time on the Timer')"],
    ["m.title = TN_K[x.k][0];", "m.title = tr(TN_K[x.k][0]);"],
    ["w = { '': 'Normal text', h: 'Heading', h2: 'Small heading' }[sty]", "w = tr({ '': 'Normal text', h: 'Heading', h2: 'Small heading' }[sty])"],
    ["allw = tnAllHid() ? 'Show all times' : 'Hide all times'", "allw = tnAllHid() ? tr('Show all times') : tr('Hide all times')"],
    ["ck.title = c.at ? 'Pause the Timer' : 'Start the Timer';", "ck.title = c.at ? tr('Pause the Timer') : tr('Start the Timer');"],
    ["fs = back ? 'Goes back to the student with the paper' : 'Only for you. Not given back.'", "fs = back ? tr('Goes back to the student with the paper') : tr('Only for you. Not given back.')"],
    ["sws = back && sz ? TN_SIZE[sz][1] : ''", "sws = back && sz ? tr(TN_SIZE[sz][1]) : ''"],
  ],
};
// The typed notes' bar (src/typednotes.js tnFrame) is one HTML text: each word between tags and each title and aria-label in it goes
// through tr, as do a button's title (b(…, 'Bold', …)) and the marks' and sizes' names (w). Letters alone (B, I, U) are not words.
const TN_FRAME_WORDS = 33;
function engineWords(file, out) {
  for (const [from, to] of ENGINE_TR[file] || []) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error('lift: ' + file + ' has ' + n + ' of ' + JSON.stringify(from.slice(0, 60)) + ' (next/build.js ENGINE_TR)');
    out = out.replace(from, () => to);
  }
  if (file !== 'gnotes') return out;
  const at = out.indexOf('\nfunction tnFrame() {'), end = out.indexOf('\n}\n', at);
  if (at < 0 || end < 0) throw new Error('lift: gnotes has no tnFrame');
  let n = 0;
  const word = s => /[A-Za-z]{2}/.test(s);
  const body = out.slice(at, end)
    .replace(/'((?:[^'\\\n]|\\.)*)'/g, (lit, s) => "'" + s
      .replace(/>([^<>]+)</g, (m, x) => (word(x) ? (n++, ">' + tr('" + x + "') + '<") : m))
      .replace(/\b(title|aria-label)="([^"]+)"/g, (m, a, x) => (word(x) ? (n++, a + "=\"' + tr('" + x + "') + '\"") : m)) + "'")
    .replace(/\bb\(('[^']*'), '([^']+)'/g, (m, a, x) => (n++, 'b(' + a + ", tr('" + x + "')"))
    .replace(/' \+ w \+ '/g, () => (n++, "' + tr(w) + '"));
  if (n !== TN_FRAME_WORDS) throw new Error('lift: gnotes tnFrame has ' + n + ' words for tr, not ' + TN_FRAME_WORDS + ' (next/build.js TN_FRAME_WORDS)');
  return out.slice(0, at) + body + out.slice(end);
}
// Only gcore may change the open work's state (esbuild refuses an assignment to an import). Where a later module's lifted code
// assigns one of gcore's names (\`selected = null\`), the assignment becomes that name's setter (\`set.selected(null)\`), which
// gcore exports. The value runs to the end of the expression: a ; or , or closing bracket at its own depth, or the end of the line.
function setters(text, names) {
  const rx = new RegExp('(?<![.\\w$])(' + names.join('|') + ')\\s*=(?![=>])', 'g');
  let out = '', at = 0, m;
  while ((m = rx.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(let|const|var)\s+$/.test(before)) continue;   // a declaration of its own (never in what is lifted now, but not an assignment)
    // the top-level declaration it is in declares a variable of that name for itself (let n = 1, pages;) or takes it as a parameter
    const top = (() => { const head = text.slice(0, m.index), all = [...head.matchAll(/^(?:async )?function |^(?:const|let|var) /gm)], st = all.length ? all[all.length - 1].index : 0; const nx = text.slice(m.index).search(/\n(?:async )?function |\n(?:const|let|var) /); return text.slice(st, nx < 0 ? text.length : m.index + nx); })();
    const n = m[1].replace(/\$/g, '\\$');
    if (new RegExp('\\b(?:let|const|var)\\s+(?:[\\w$]+(?:\\s*=\\s*[^,;]*)?\\s*,\\s*)*' + n + '\\s*(?:[,;=]|$)', 'm').test(top) || [...top.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)].some(f => new RegExp('(?<![\\w$])' + n + '(?![\\w$])').test(f[1]))) continue;
    let i = m.index + m[0].length, depth = 0, q = null;
    for (; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (!depth) break; depth--; }
      else if (!depth && (c === ';' || c === ',' || c === '\n')) break;
    }
    out += text.slice(at, m.index) + 'set.' + m[1] + '(' + text.slice(m.index + m[0].length, i).trim() + ')';
    at = i; rx.lastIndex = i;
  }
  return out + text.slice(at);
}
function writeIf(rel, text) { const f = path.join(NEXT, rel); if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== text) fs.writeFileSync(f, text); }

async function build() {
  writeEngines();
  fs.rmSync(DIST, { recursive: true, force: true });
  const r = await esbuild.build({
    entryPoints: { main: path.join(NEXT, 'src/main.js'), proof: path.join(NEXT, 'src/proof.js'), parts: path.join(NEXT, 'src/ui/index.js'), gallery: path.join(NEXT, 'src/gallery/main.jsx'),
      'parts-css': path.join(NEXT, 'src/ui/parts.css'), 'gallery-css': path.join(NEXT, 'src/gallery/gallery.css'), 'shell-css': path.join(NEXT, 'src/app/shell.css'), 'plan-css': path.join(NEXT, 'src/app/plan.css'), 'mark-css': path.join(NEXT, 'src/app/mark.css'), 'class-css': path.join(NEXT, 'src/app/class.css'), 'todo-css': path.join(NEXT, 'src/app/todo.css'), 'focus-css': path.join(NEXT, 'src/app/focus/focus.css'), 'pages-css': path.join(NEXT, 'src/app/pages.css') },
    // pdf.js's worker, as text, so the Beside drawer's Books can start it from a blob: address (it loads only when a book is opened).
    plugins: [{ name: 'lines-json', setup(b) {
      // The English area already ships with its screen. Ship only each translation's values, in the same key
      // order in all eight languages. Null keeps the slot for an untranslated (identical-to-English) line.
      const englishAreas = require('./tools/lang-areas.js').english();
      b.onLoad({ filter: /[\\/]next[\\/]lang[\\/](zh-Hant|zh-Hans|es|fr|de|pt-BR|ja|ko)[\\/]\w+\.json$/ }, a => {
        const area = path.basename(a.path, '.json'), english = englishAreas[area];
        const translated = JSON.parse(fs.readFileSync(a.path, 'utf8'));
        const englishFile = area === 'core' ? 'en.json' : area + '.en.json';
        for (const key of Object.keys(translated)) {
          if (!Object.hasOwn(english, key) && !(area === 'core' && key === '@locale')) throw new Error(a.path + ': unknown line ' + key);
        }
        const values = Object.keys(english).sort().map(key => Object.hasOwn(translated, key) ? translated[key] : null);
        return { loader: 'js', contents: `import english from '../${englishFile}';
          import { unpackArea } from '../../src/i18n/unpack-area.js';
          export default unpackArea(english, ${JSON.stringify(values)}, ${JSON.stringify(translated['@locale'] || null)});` };
      });
    } }, { name: 'pdf-worker', setup(b) {
      // The path is kept relative to the repository so the build is the same on every machine.
      b.onResolve({ filter: /^pdfjs-worker-text$/ }, () => ({ path: 'node_modules/pdfjs-dist/build/pdf.worker.min.js', namespace: 'pdfw' }));
      b.onLoad({ filter: /.*/, namespace: 'pdfw' }, a => ({ contents: fs.readFileSync(path.join(ROOT, a.path), 'utf8'), loader: 'text' }));
    } }],
    loader: { '.woff2': 'file', '.json': 'json', '.webp': 'file' }, assetNames: '[name]-[hash]',
    outdir: DIST, bundle: true, splitting: true, format: 'esm', target: ['chrome109', 'safari16'], minify: !process.env.GS_NEXT_DEBUG,
    chunkNames: 'chunk-[hash]', entryNames: '[name]', metafile: true, absWorkingDir: ROOT, legalComments: 'none', logLevel: 'warning',
    // An array-valued define injects its initializer into every chunk. Only the language picker needs the list.
    jsxFactory: 'h', jsxFragment: 'Fragment', define: { __GS_LANGS_JSON__: JSON.stringify(JSON.stringify(langList())), __GS_DATA_V__: String(dataVersion()), __GS_APP_VERSION__: JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version), __GS_GCID__: JSON.stringify(process.env.GCID || require('../site.json').googleClientId || ''),
      // where this copy lives and where it is moving to (site.json), only while a move is on, as build.js writes it for the current app
      __GS_MOVE__: (site => JSON.stringify(site.movingTo ? { address: site.address || '', movingTo: site.movingTo } : null))(require('../site.json')) },
  });
  // Each language's chunk with its letters written as themselves, not as \\u escapes: about 10 KB smaller squeezed. Only these
  // chunks: done for the whole app it makes some screens larger. A module is always read as UTF-8, so the letters arrive whole.
  for (const [f, o] of Object.entries(r.metafile.outputs)) {
    if (!Object.keys(o.inputs).some(i => /next\/lang\/(zh-Hant|zh-Hans|es|fr|de|pt-BR|ja|ko)\/\w+\.json$/.test(i))) continue;
    const at = path.join(ROOT, f), s = fs.readFileSync(at, 'utf8');
    const out = s.replace(/\\u([0-9A-F]{4})/g, (m, x) => { const c = parseInt(x, 16); return c < 0x80 || (c >= 0xD800 && c < 0xE000) ? m : String.fromCharCode(c); });
    fs.writeFileSync(at, out); o.bytes = Buffer.byteLength(out);
  }
  fs.writeFileSync(path.join(DIST, 'meta.json'), JSON.stringify(r.metafile, null, 1) + '\n');
  // The tokens, as a stylesheet: made from next/src/ui/tokens.js, the one place colours and sizes are written.
  const tokens = await import(require('url').pathToFileURL(path.join(NEXT, 'src/ui/tokens.js')).href);
  fs.writeFileSync(path.join(DIST, 'tokens.css'), tokens.css());
  const sample = fs.readFileSync(path.join(ROOT, 'src/samplemode.js'), 'utf8').replace(/^[ \t]*\/\/.*\r?\n/gm, '');
  const page = (title, entry, body) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + title + '</title>\n' +
    '<script>' + sample + '</script>\n' +
    '<style>:root{--bg:#F4F5F7;--ink:#1B1F24;--muted:#5B6470;--line:#E4E6EA}:root[data-theme="dark"]{--bg:#14181F;--ink:#E8EAED;--muted:#A3ABB5;--line:#2A3039}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:24px;margin:0 0 12px}p{color:var(--muted)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}</style>\n' +
    '<script>try{if(JSON.parse(localStorage.getItem("gs.theme"))==="dark")document.documentElement.dataset.theme="dark"}catch(e){}</script>\n' +
    '<script type="module" src="dist/' + entry + '.js"></script></head><body>' + body + '</body></html>\n';
  // Pages with the parts: the tokens and parts stylesheets, and the teacher's theme put on before anything is drawn (read only).
  const look = '<script>(function(){var L=' + JSON.stringify(tokens.LOOKS) + ',v=null;try{v=JSON.parse(localStorage.getItem("gs.look"))}catch(e){}if(L.indexOf(v)<0){var d=null;try{d=JSON.parse(localStorage.getItem("gs.theme"))}catch(e){}v=d==="dark"?"midnight":' + JSON.stringify(tokens.DEFAULT_LOOK) + '}document.documentElement.dataset.look=v})()</script>\n';
  // Settings > Display > Phone layout off (gs.phone "0", as the current app keeps it): a phone lays the page out as a computer would.
  const PHONE_VIEW = '<script>try{if(localStorage.getItem("gs.phone")==="0"&&Math.min(screen.width,screen.height)<600)document.querySelector("meta[name=viewport]").content="width=1100"}catch(e){}</script>\n';
  const partsPage = (title, entry, css, style, body) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="data:,"><title>' + title + '</title>\n' +
    '<script>' + sample + '</script>\n' + look + (entry === 'main' ? PHONE_VIEW : '') +
    '<link rel="stylesheet" href="dist/tokens.css"><link rel="stylesheet" href="dist/parts-css.css">' + css.map(c => '<link rel="stylesheet" href="dist/' + c + '.css">').join('') + (style ? '<style>' + style + '</style>' : '') + '\n' +
    '<script type="module" src="dist/' + entry + '.js"></script></head><body>' + body + '</body></html>\n';
  fs.writeFileSync(path.join(NEXT, 'index.html'), partsPage('Grading Studio (new)', 'main', ['shell-css', 'plan-css', 'mark-css', 'class-css', 'todo-css', 'focus-css', 'pages-css'], '.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:var(--t5);margin:0 0 12px}.wrap p{color:var(--mute)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'gallery.html'), partsPage('Parts gallery', 'gallery', ['gallery-css'], '', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'proof.html'), page('Saved-work proof', 'proof', '<p>Saved-work proof page. Used by the checks, not by teachers.</p>'));
  writeVersion();
  const sizes = Object.entries(r.metafile.outputs).map(([f, o]) => path.basename(f) + ' ' + (o.bytes / 1024).toFixed(1) + ' KB').join(', ');
  console.log('next/: ' + sizes);
}
module.exports = { writeEngines };
if (require.main === module) build().catch(e => { console.error(e); process.exit(1); });
