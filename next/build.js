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
    '\nexport { hashOf, recHash, revsOf, stampData, workCounts, workVec, libPrev, stampLib, mergeLib, mergeWork, mergeStates, mergeLs, focusShared, planTimeMerge, taughtInMerge, vJoin, tabDiffers, tabMerge };\n';
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
];
const TOOLS_ROOTS = ['pptxToSlides', 'docxOf', 'shareLesson', 'finSig', 'docClean', 'DOC_CSS', 'shrinkPic', 'imgSrc',
  // slide looks and the editor's text tools: per-box sizes, biggest that fits, moving a box, lists and formatting (src/planner/boxes.js, rich.js)
  'LOOKS', 'lookOf', 'ownTpl', 'PT', 'BOX_KEYS', 'boxSizes', 'boxUsual', 'boxSize', 'boxOver',
  'rtHtml', 'rtLineHtml', 'rtRead', 'rtTidy', 'rtRenumber', 'rtCurLines', 'rtLvl', 'rtSetKind', 'rtSetLvl', 'RT_NOCOLOR',
  // notebook and the unit a lesson is in
  'nbClean', 'nbText', 'lessonUnit', 'videoFrom', 'ytId', 'ytStart'];
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
  const toolsOut = head + "import * as fflate from 'fflate';\nimport { " + used.join(', ') + " } from './planner.js';\n" + tools;
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
  heicLoad: "() => { throw new Error('no decoder in this copy'); }",
  // Hooks: what the lifted marking code calls that belongs to the screen. The marking screen hands in its own with use({ ... });
  // until it does, each is quiet. writeWork is where a lifted saveNow hands the work it built: the screen saves it through
  // students/write.js saveWork. The window checks (tabLive and the rest) are students/write.js's, so here they let the save through.
  toast: '() => {}', renderList: '() => {}', renderTools: '() => {}', renderGrade: '() => {}', openStudent: '() => {}', renderPage: '() => {}',
  gradeMarksChanged: '() => {}', gradeShown: '() => {}', openImported: '() => {}', rescanFile: '() => {}', editText: '() => {}', openNote: '() => {}',
  openStampMenu: '() => {}', placeScore: '() => {}', stopScorePlace: '() => {}', scanNote: '() => {}', refound: '() => {}', endOnce: '() => {}', setTool: '() => {}',
  lightPagesChanged: '() => {}',
  // group work: the partner new marks and notes are just for (src/groups.js groupJust), one for every module that reads it
  groupJust: 'null',
  scorePlacing: 'null', activeEditor: 'null',
  writeWork: '() => {}', tabLive: '() => true', tabForgot: '() => false', tabLetGo: '() => {}', tabsBehind: '() => false', saveBehind: '() => {}', stampWork: '() => {}',
};
// What the lifted code calls that belongs to the screen (a toast, a redraw): quiet here, the new screen says and draws things itself.
const GRADING_STUBS = { pickedUpNew: '() => false', renderKept: '() => {}', groupNoteRefresh: '() => {}', groupBandRefresh: '() => {}' };
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
  ], '', [], ['gcore', 'gdraw']],
  ['gexport', [
    // what goes back to students (src/app/export.js, src/feedback.js, src/exportreport.js, src/anchors.js): which files, their names,
    // each paper with its marks baked in, the feedback page; the grades read off the papers and the grade sheet (src/app/gradesheet.js);
    // the Grades tab's rows (src/app/dialogs.js) and Returned (src/tabs.js)
    'exportPlan', 'nameOut', 'outStem', 'flattenDoc', 'oneLeftOver', 'xOne', 'xNames', 'xEdit', 'xAll', 'xEarly', 'gotEarly', 'canvasJpg', 'exportWhy', 'fbOn', 'keyOn', 'asgName', 'fileSafe', 'outWord',
    'scanAll', 'buildSheetPdf', 'parseGrade', 'foundLabel', 'manyReads', 'readsCount', 'disagreeNote',
    'gradeRows', 'tableHead', 'tableRow', 'gradesSummary', 'cellCopy', 'totalText', 'statusText', 'rowShown', 'scoreText', 'cellOut', 'csvCell', 'tsvLine', 'bandOf', 'ibSetup',
    'meGrade', 'pctAvgText', 'setKey', 'keyRows', 'classStats', 'leftOutText', 'spreadBins', 'onThisScale', 'partNote', 'STATUS_LABEL', 'triesSay',
    'anchorDocs', 'anchorDocPdf', 'anchorFile', 'anchorsHere', 'ANCHORS', 'anchorOf', 'anchorLabel', 'setAnchor', 'anchorCoverOn',
    'wordPagesPdf', 'WP_MAX', 'scanFile',
    // the Grade sheet's rows and what she says about a grade read off a paper (src/app/gradesheet.js, src/grades.js)
    'sheetRows', 'appScored', 'appShots', 'rowGraded', 'splitReads', 'readKey', 'readingDoubt', 'quietReads', 'paperScore', 'rivalReads', 'paperBytes', 'fileIn',
    // a paper's pages drawn as an assistant or the same-score view sees them (src/app/claude.js sharePage, shareDocs)
    'sharePage', 'shareDocs', 'classCommon', 'nameFreeText',
  ], "// the Grade sheet's choices, which the current app keeps in module variables: read and set from the Grades tab\nexport function sheetSet(o) { if ('all' in o) sheetAll = !!o.all; if ('found' in o) sheetFound = !!o.found; if ('out' in o) sheetShowOut = !!o.out; }\nexport const sheetNow = () => ({ all: sheetAll, found: sheetFound, out: sheetShowOut });\n", [], ['gcore', 'gdraw', 'gopen'], ['num', 'inside']],
  ['greport', [
    // the opening report (src/intake.js openingFacts, checkStack): what opened, what didn't and why, who has nothing, and anything odd
    'openingFacts', 'checkStack', 'checkFile', 'repHead', 'zipSay', 'troubleOf', 'troubleText', 'hash', 'textOf',
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
    'linkClean', 'linkOf', 'linkPlayer', 'linkTitle', 'linkHost', 'linkBytes', 'vidRef', 'drvRef', 'keptId', 'linkKey', 'vrotKey', 'vrotOf', 'frameTicks',
    'MEDIA_RX', 'VIDEO_RX', 'MIME', 'extOf', 'fmtTime', 'trLines', 'trText', 'trParse', 'trMakeable', 'transcribe', 'asrStop', 'asrStandIn',
    'notesPdf', 'npRows', 'npFileName', 'isNotes', 'notesFileOf', 'NP_TAIL', 'vidBytes', 'sameVideo',
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
  ], '', [], ['gcore', 'gdraw', 'gword']],
  ['ginsight', [
    // Insights > Consistency (src/insight.js): whether her scores drifted as she went, read the same way, rubric row by row, and
    // the papers that share a score; the chart, the list and the side-by-side pages are the new app's
    'consData', 'driftRead', 'rowDrifts', 'roughly', 'roughGap', 'roughStep', 'DRIFT_MIN', 'DRIFT_SURE', 'sameLabel',
  ], '', [], ['gcore', 'gdraw', 'gexport'], ['average']],
  ['gways', [
    // the teacher's usual way of grading (src/app/library.js GRADE_WAYS, meGrade): what a new assignment starts with, read from the
    // library the settings screen has in hand (useLib), not the marking screen's
    'GRADE_WAYS', 'gradeWay', 'meGrade', 'ME_OLD',
  ], `let lib = { me: null };
export const useLib = l => { lib = l || { me: null }; };
`, ['lib'], ['gcore']],
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
  writeIf('src/engines/stickers.js', '// MADE BY next/build.js FROM src/stickers/. Each sticker is its own file, fetched when a page with stickers is drawn.\n' +
    Object.entries(sticker).map(([k, f], i) => 'import s' + i + " from '../../../src/stickers/" + f + "';").join('\n') + '\n// The bundler gives each file a name next to this chunk; the page is a folder up, so each is read from where this module is.\nconst at = f => new URL(f, import.meta.url).href;\nexport default { ' + Object.keys(sticker).map((k, i) => JSON.stringify(k) + ': at(s' + i + ')').join(', ') + ' };\n');
  for (const [file, roots, preamble = '', given = [], uses = null, real = []] of GRADING) {
    // uses: the earlier modules this one may import from (all of them when not given). Anything else it needs it lifts for itself,
    // so a part loaded on its own (the marking tools) doesn't bring a module it barely uses (opening a download).
    const may = uses ? declared.filter(n => !made[n] || uses.includes(made[n])) : declared;
    let out = lift({ files: 'grading', scoped: true, roots, deny: GRADING_DENY, ignore: GRADING_LOCAL.filter(n => !real.includes(n)), given: [...may, ...given], header: '', preamble: '' });
    const own = [...out.matchAll(/^(?:async )?function\*? ?(\w+)|^(?:const|let|var) (\w+)/gm)].map(m => m[1] || m[2]);
    // const a = 1, b = 2 on one line declares b too (as lift.js reads it), so a later module imports b instead of declaring the line again
    const { depthOf } = require('./tools/lift.js');
    for (const ln of out.split('\n')) if (/^(?:const|let|var) /.test(ln)) for (const x of ln.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=|>)/g)) if (depthOf(ln.slice(0, x.index)) === 0 && !own.includes(x[1])) own.push(x[1]);
    // a name right after a dot is a property, except after a spread (...vpDraw(…))
    const used = may.filter(n => !given.includes(n) && new RegExp('(?<![\\w$])(?<![^.]\\.)' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(out));
    const imports = {};
    for (const n of used) { const from = file === 'gcore' ? null : (made[n] || 'gcore'); if (from && from !== file) { (imports[from] ||= []).push(n); (needs[from] ||= new Set()).add(n); } }
    if (file !== 'gcore') out = setters(out, names);
    let pre = file === 'gcore' ? core : Object.entries(imports).map(([f, l]) => 'import { ' + l.join(', ') + " } from './" + f + ".js';").join('\n') + '\n';
    if (file === 'gcore') pre += 'export { ' + names.join(', ') + ', store, kdo, kget, idbDo, ' + Object.keys(GRADING_STUBS).join(', ') + ' };\n';
    else if (/(?<![.\w$])set\./.test(out)) pre = pre.replace(/^import \{ ([^}]*) \} from '\.\/gcore\.js';/m, (m, l) => "import { " + l + ", set } from './gcore.js';") || pre;
    if (file !== 'gcore' && /(?<![.\w$])set\./.test(out) && !/import \{[^}]*\bset\b[^}]*\} from '\.\/gcore\.js'/.test(pre)) pre = "import { set } from './gcore.js';\n" + pre;
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
      'parts-css': path.join(NEXT, 'src/ui/parts.css'), 'gallery-css': path.join(NEXT, 'src/gallery/gallery.css'), 'shell-css': path.join(NEXT, 'src/app/shell.css'), 'plan-css': path.join(NEXT, 'src/app/plan.css'), 'mark-css': path.join(NEXT, 'src/app/mark.css') },
    // pdf.js's worker, as text, so the Beside drawer's Books can start it from a blob: address (it loads only when a book is opened).
    plugins: [{ name: 'pdf-worker', setup(b) {
      // The path is kept relative to the repository so the build is the same on every machine.
      b.onResolve({ filter: /^pdfjs-worker-text$/ }, () => ({ path: 'node_modules/pdfjs-dist/build/pdf.worker.min.js', namespace: 'pdfw' }));
      b.onLoad({ filter: /.*/, namespace: 'pdfw' }, a => ({ contents: fs.readFileSync(path.join(ROOT, a.path), 'utf8'), loader: 'text' }));
    } }],
    loader: { '.woff2': 'file', '.json': 'json', '.webp': 'file' }, assetNames: '[name]-[hash]',
    outdir: DIST, bundle: true, splitting: true, format: 'esm', target: ['chrome109', 'safari16'], minify: !process.env.GS_NEXT_DEBUG,
    chunkNames: 'chunk-[hash]', entryNames: '[name]', metafile: true, absWorkingDir: ROOT, legalComments: 'none', logLevel: 'warning',
    jsxFactory: 'h', jsxFragment: 'Fragment', define: { __GS_LANGS__: JSON.stringify(langList()), __GS_DATA_V__: String(dataVersion()) },
  });
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
  const partsPage = (title, entry, css, style, body) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="data:,"><title>' + title + '</title>\n' +
    '<script>' + sample + '</script>\n' + look +
    '<link rel="stylesheet" href="dist/tokens.css"><link rel="stylesheet" href="dist/parts-css.css">' + css.map(c => '<link rel="stylesheet" href="dist/' + c + '.css">').join('') + (style ? '<style>' + style + '</style>' : '') + '\n' +
    '<script type="module" src="dist/' + entry + '.js"></script></head><body>' + body + '</body></html>\n';
  fs.writeFileSync(path.join(NEXT, 'index.html'), partsPage('Grading Studio (new)', 'main', ['shell-css', 'plan-css', 'mark-css'], '.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:var(--t5);margin:0 0 12px}.wrap p{color:var(--mute)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'gallery.html'), partsPage('Parts gallery', 'gallery', ['gallery-css'], '', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'proof.html'), page('Saved-work proof', 'proof', '<p>Saved-work proof page. Used by the checks, not by teachers.</p>'));
  writeVersion();
  const sizes = Object.entries(r.metafile.outputs).map(([f, o]) => path.basename(f) + ' ' + (o.bytes / 1024).toFixed(1) + ' KB').join(', ');
  console.log('next/: ' + sizes);
}
module.exports = { writeEngines };
if (require.main === module) build().catch(e => { console.error(e); process.exit(1); });
