// Languages: English unless the teacher picks another in Settings or on the welcome; Spanish for the sidebar, Today, the welcome,
// Find anything, Help and the feedback page in a returned paper. Names a teacher typed are never translated, and the choice is one
// setting that touches no saved work. The coverage test is the one a new language file has to pass. Everyone here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { ROOT, builtHtml, openApp, openZip, goTo, score, settle, setTool, drag, catchDownloads, closeBox, pick } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');
const { ibSeed } = require('./helpers/ibseed');
const { langFile } = require('./helpers/serve');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const ES = { 'gs.lang': '"es"' };
const inSpanish = s => { const o = s || gradingSeed(); return { ...o, ls: { ...o.ls, ...ES } }; };
const text = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
// A page in English has fetched no language, so the one asked about is fetched first (load does nothing when it is already there).
const tr = (page, s) => page.evaluate(async s => { await window.__gsLang.load('es'); return window.__gsLang.tr(s, 'es'); }, s);
function serveBoth() {
  builtHtml();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (langFile(res, p)) return;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

test('the app is in English until a language is picked, and Settings, Display switches it there and back', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  assert.equal(await page.evaluate(() => window.__gsLang.lang), 'en');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await text(page, '#rail [data-nav="home"]'), 'Today');
  await goTo(page, '#/settings/display');
  assert.equal(await text(page, '#setLang h2'), 'App language');
  assert.deepEqual(await page.$$eval('#setLangPick option', o => o.map(x => x.value + ' ' + x.textContent)), ['en English', 'zh-Hant 繁體中文', 'zh-Hans 简体中文', 'es Español', 'fr Français', 'de Deutsch', 'pt-BR Português (Brasil)', 'ja 日本語', 'ko 한국어']);
  const before = await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'gs.lang').sort().map(k => k + '=' + localStorage.getItem(k)).join('\n'));
  await Promise.all([page.waitForNavigation(), page.select('#setLangPick', 'es')]);
  await page.waitForFunction(() => window.__gsLang && window.__gsLang.lang === 'es' && document.querySelector('#rail [data-nav="home"]').textContent.trim() === 'Hoy');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'es');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lang')), '"es"');
  assert.equal(await page.evaluate(() => location.hash), '#/settings/display', 'the same screen, drawn again');
  assert.equal(await text(page, '#setLang h2'), 'Idioma de la aplicación');
  assert.equal(await text(page, '#rail [data-nav="settings"]'), 'Ajustes');
  // nothing else that is saved changed
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'gs.lang').sort().map(k => k + '=' + localStorage.getItem(k)).join('\n')), before);
  await Promise.all([page.waitForNavigation(), page.select('#setLangPick', 'en')]);
  await page.waitForFunction(() => window.__gsLang && window.__gsLang.lang === 'en');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lang')), null);
  assert.equal(await text(page, '#rail [data-nav="home"]'), 'Today');
  assert.deepEqual(page.errors, []);
  await close();
});

test('in Spanish the sidebar and Today read in Spanish, with the date written the Spanish way and every typed name left alone', async () => {
  // A class called Help and a rubric row called Language: both are words the app itself uses, and both are hers.
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']); lib.classes[1].name = 'Help';
  const { page, close } = await openApp(browser, { seed: inSpanish({ ...s, ls: { ...s.ls, 'gs.lib': JSON.stringify(lib) } }) });
  await page.waitForFunction(() => /devolver/.test(document.querySelector('#homeSay').textContent));
  assert.deepEqual(await page.$$eval('#rail .rnav[data-nav]:not([hidden]) .rl:not(.rcnt), #rail #lessonsBtn .rl, #rail .rcap .rl, #rail .rfind .rl:not(kbd), #addClass .rl', els => els.map(e => e.textContent.trim())), ['Buscar', 'Hoy', 'Pendientes', 'Planificador', 'Centro', 'Clases', 'Añadir una clase', 'Ayuda', 'Ajustes']);
  assert.deepEqual(await page.$$eval('#railClasses .rname', els => els.map(e => e.textContent)), ['Grade 9 English', 'Help'], 'a class called Help keeps its name');
  assert.match(await text(page, '#railSaved'), /^Sin copia de seguridad\s*Solo en este navegador$/);
  assert.match(await text(page, '#homeDate'), /^[a-záéíóúñ]+, \d+ de [a-záéíóúñ]+$/i);
  assert.equal(await text(page, '#homeSay'), 'Dos grupos de trabajos listos para devolver.');
  assert.match(await page.$eval('#handBack h2', e => e.textContent), /^Listos para devolver$/);
  assert.match(await text(page, '#handBack .krow .ks'), /^Grade 9 English · los 6 con nota · media: \d+ %/);
  assert.equal(await page.$eval('#handBack .kname', e => e.textContent), 'Poetry analysis');
  await page.waitForSelector('#needNext .tbn');
  assert.deepEqual(await page.$$eval('#needNext .tbn', els => els.map(e => e.textContent)), ['Ideas', 'Organization', 'Language'], 'a rubric row called Language keeps its name');
  assert.match(await text(page, '#needNext .tbig'), /^Grade 9 English: Language fue la fila más floja en Poetry analysis\.$/);
  assert.match(await text(page, '#needNext .tsay'), /estudiantes? obtuv\w+ 2 o menos en Language\.$/);
  assert.equal(await page.$eval('#today h2', e => e.textContent), 'Clases de hoy');
  assert.equal(await page.$eval('#dropTitle', e => e.textContent), 'Suelta aquí los trabajos nuevos de tus estudiantes');
  assert.equal(await page.$eval('#pickFiles', e => e.textContent), 'Elegir archivos…');
  assert.equal(await page.$eval('#findBtn', e => e.title), 'Busca un estudiante, una tarea, una herramienta o un ajuste');
  // a class page reads in Spanish, with the class, its units and its assignments under the names she gave them
  await page.click('#railClasses a'); await page.waitForFunction(() => location.hash.startsWith('#/class')); await page.waitForSelector('#vClass .card');
  const cls = await text(page, '#vClass');
  for (const w of ['Grade 9 English', 'Libro de calificaciones', '6 estudiantes en la lista', 'Unit 1: Stories', 'Narrative essay', '+ Tarea', '+ Unidad']) assert.ok(cls.includes(w), w + ' is on the class page');
  // the Gradebook tab reads in Spanish, with the students, the assignments and the term under the names she gave them
  await page.click('#vClass .ctab[data-ctab="gradebook"]'); await page.waitForSelector('#classPanel table');
  const gb = await text(page, '#classPanel');
  for (const w of ['Promedio de la clase', 'Estudiante', 'Nota del periodo', 'Todo el curso', '+ Añadir notas', 'Aria Testwell', 'Reading check 1', 'Term 1', 'escrita a mano']) assert.ok(gb.includes(w), w + ' is in the gradebook');
  assert.match(gb, /1 sept/, 'a due date is written the Spanish way');
  // "Late" means one thing for a paper and another for a student: on the Attendance tab it is the student's
  const base = await page.$eval('#railClasses a', a => a.getAttribute('href'));
  await goTo(page, base + '/attendance'); await page.waitForSelector('#attList');
  assert.deepEqual(await page.$$eval('[data-attrow="0"] [data-atts]', b => b.map(x => x.textContent)), ['Presente', 'Tarde', 'Ausente, motivo desconocido', 'Ausente, justificado']);
  await page.click('[data-attrow="0"] [data-atts="l"]'); await page.waitForFunction(() => /Tarde: 1/.test(document.querySelector('#attSum').textContent));
  assert.equal(await text(page, '#attSum'), 'Presentes: 5 · Tarde: 1');
  assert.equal(await page.$eval('[data-attrow="0"] .attnote', x => x.placeholder), 'Una nota, si quieres');
  // a screen that is not translated yet is simply still in English, and works
  await goTo(page, '#/todo'); await page.waitForFunction(() => !document.querySelector('#vTodo').hidden);
  assert.match(await text(page, '#vTodo'), /Week/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the sentences Today builds come out as Spanish sentences', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const want = {
    'One class today. One set of papers to mark.': 'Una clase hoy. Un grupo de trabajos por corregir.',
    'Three classes today. Two sets of papers to mark, one ready to hand back.': 'Tres clases hoy. Dos grupos de trabajos por corregir y uno listo para devolver.',
    'No classes today. Nothing waiting to be marked.': 'Hoy no hay clases. Nada por corregir.',
    'One set of papers to mark, two ready to hand back.': 'Un grupo de trabajos por corregir y dos listos para devolver.',
    'One set of papers ready to hand back.': 'Un grupo de trabajos listo para devolver.',
    'Four classes today.': 'Cuatro clases hoy.',
    'Test English · due Nov 6': 'Test English · entrega: Nov 6',
    '3 of 6 scored · 1 partial · 2 missing or excused': '3 de 6 con nota · 1 parcial · 2 no entregados o justificados',
    '1 paper, not started': '1 trabajo, sin empezar',
    'Formative · feedback only': 'Formativa · solo comentarios',
    'The river · 12 slides · taught to slide 4 of 12 · and 1 more': 'The river · 12 diapositivas · impartida hasta la diapositiva 4 de 12 · y 1 más',
    'One student scored 2 or below on Evidence.': 'Un estudiante obtuvo 2 o menos en Evidence.',
    'Every row came out the same on the last set of papers.': 'Todas las filas salieron igual en el último grupo de trabajos.',
    'Grade 9 English · 3 left to score': 'Grade 9 English · 3 sin nota',
    'A ZIP from Canvas, a folder, a scan of the whole class, or photos.': 'Un ZIP de Canvas, una carpeta, un escaneo de toda la clase o fotos.',
    'In this browser and your “Marking” folder': 'En este navegador y en tu carpeta “Marking”',
    '2 matches': '2 resultados',
    // Settings: lines with a date, a count or the school's own system in them
    'Aug 10 to Dec 18': 'Aug 10 – Dec 18',
    'You have 1 saved rubric and 2 saved grading scales. They are kept in the rubric bank, sorted by unit, and hold only a rubric’s wording and a scale’s percents.': 'Tienes 1 rúbrica guardada y 2 escalas de calificación guardadas. Se guardan en el banco de rúbricas, ordenadas por unidad, y solo contienen el texto de una rúbrica y los porcentajes de una escala.',
    'new entries add to the term grade, one point for one percentage point. Grades stay at 100% at most.': 'las entradas nuevas se suman a la nota del periodo, un punto por cada punto porcentual. Las notas llegan como máximo al 100%.',
    'No Canvas link': 'Sin enlace de Canvas', 'A class has its roster, its units and its Canvas page.': 'Una clase tiene su lista, sus unidades y su página de Canvas.',
    // a class page
    '6 students on the roster': '6 estudiantes en la lista', '1 assignment': '1 tarea', 'Due Sep 19': 'Entrega: Sep 19', 'Keep Missing work in the tab row': 'Mantener Trabajos sin entregar en la fila de pestañas',
    '6 of 6 scored · papers not kept': '6 de 6 con nota · trabajos no guardados', 'a Canvas ZIP': 'un ZIP de Canvas', 'Add the Class page link…': 'Añadir el enlace de la página de la clase…',
    // the Gradebook, Students, Attendance, Seating and Missing work tabs
    'Student details for Aria Testwell': 'Datos de Aria Testwell', 'without 2 students ·': 'sin 2 estudiantes ·', 'By the date (Term 1)': 'Según la fecha (Term 1)', 'By the date (none)': 'Según la fecha (ninguno)',
    '3 of 6 entered': '3 de 6 introducidas', '+2% on the term grade': '+2% en la nota del periodo', '+1.5 on the in-class average': '+1.5 en: Promedio: En clase', 'In-class average': 'Promedio: En clase',
    'Each point adds one percentage point to the in-class average, which then counts by its weight. Leave a student blank for none. It doesn’t change any assignment’s score.': 'Cada punto suma un punto porcentual a: Promedio: En clase, que luego cuenta según su peso. Deja a un estudiante en blanco si no recibe ninguno. No cambia la nota de ninguna tarea.',
    'Students are in your roster order. Missing and Excused never count against a student. Point at a grade to see how it’s worked out, extra credit included.': 'Los estudiantes están en el orden de tu lista. No entregado y Justificado nunca cuentan en contra de un estudiante. Señala una nota para ver cómo se calcula, puntos extra incluidos.',
    '6 students · 2 with an ID': '6 estudiantes · 2 con ID', 'Email for Bram Sample': 'Correo de Bram Sample',
    '3 days taken in Term 1. Click a date to open or change that day, or a name for that student’s page. “Here” counts everyone present or late.': '3 días registrados en Term 1. Haz clic en una fecha para abrir o cambiar ese día, o en un nombre para ir a la página de ese estudiante. “Presentes” cuenta a todos los presentes o que llegaron tarde.',
    '1 absence still has no reason.': '1 ausencia sigue sin motivo.', '2 students owe 3 pieces of work': '2 estudiantes deben 3 trabajos', '1 student owes 1 piece of work': '1 estudiante debe 1 trabajo',
    'Due Oct 29 · 14 days ago': 'Entrega: Oct 29 · hace 14 días', '4 of 6 seated · 2 more desks needed': '4 de 6 sentados · faltan 2 pupitres', 'Desk, Aria Testwell. Click to take it away': 'Pupitre, Aria Testwell. Haz clic para quitarlo',
    'Late': 'Con retraso', 'Open in Canvas ↗': 'Abrir en Canvas ↗',
    // what the app doesn't know is left exactly as it is
    'Aria Testwell': 'Aria Testwell', 'Narrative essay · Unit 1': 'Narrative essay · Unit 1', '  Today  ': '  Hoy  ',
  };
  for (const [en, es] of Object.entries(want)) assert.equal(await tr(page, en), es);
  await close();
});

// What each language file leaves in English on the covered parts of the screen as it is now. own: what a teacher typed, which is nobody's to translate.
const miss = async (page, where, own) => { for (const k of await page.evaluate(() => window.__gsLang.packs)) { const m = (await page.evaluate(async k => { if (!await window.__gsLang.load(k)) throw new Error('lang/' + k + '.js could not be fetched'); return window.__gsLang.missing(k); }, k)).filter(s => !own.some(o => o === s || (o instanceof RegExp && o.test(s)))); assert.deepEqual(m, [], where + ': not in the ' + k + ' language file'); } };
test('every word on the covered screens is in each language file (run in English, the screens are walked and what is missing is listed)', async () => {
  // a new browser: the welcome, each step and each choice, then Today as a new teacher finds it
  {
    const { page, close } = await openApp(browser, { newTeacher: true });
    await page.waitForSelector('#welcome [data-wlnext]');
    const own = ['Test English'];
    await miss(page, 'welcome, step 1', own);
    await page.type('#welcome [data-wlc="0"]', 'Test English');
    await page.select('#wlSys', 'other'); await page.waitForSelector('#wlSysOther'); await miss(page, 'welcome, another system', own);
    await page.select('#wlSys', '');
    await page.click('#welcome [data-wlnext]'); await page.waitForSelector('#welcome [data-wlway]');
    for (const w of await page.$$eval('#welcome [data-wlway]', b => b.map(x => x.dataset.wlway))) { await page.click('#welcome [data-wlway="' + w + '"]'); await miss(page, 'welcome, step 2, ' + w, own); }
    await page.click('#welcome [data-wlnext]'); await page.waitForFunction(() => /Step 3/.test(document.querySelector('#welcome .wlsteps').getAttribute('aria-label')));
    await miss(page, 'welcome, step 3', own);
    await page.click('#welcome [data-wlnext]'); await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    await pause(300); await miss(page, 'Today, new', own);
    assert.deepEqual(page.errors, []);
    await close();
  }
  // a browser with classes and finished work: Today, Find anything, Help, the Language setting, and Today with papers to mark
  {
    const { page, close } = await openApp(browser, { seed: gradingSeed() });
    const own = ['Grade 9 English', 'Grade 10 Literature', 'Poetry analysis', 'Narrative essay', 'Download', /^(Aria|Bram|Cleo|Dov|Esme|Finn|Gus|Hana) /, /^Unit \d/];
    await page.waitForSelector('#needNext .tbn');
    await miss(page, 'Today', own);
    await page.click('#findBtn'); await page.waitForSelector('#findDlg .frow'); await miss(page, 'Find anything', own);
    await page.type('#findIn', 'zzzz'); await miss(page, 'Find anything, nothing found', own);
    await page.keyboard.press('Escape');
    await goTo(page, '#/help'); await page.waitForSelector('#hlpList .hlpq'); await miss(page, 'Help', own);
    await page.type('#hlpIn', 'zzzz'); await pause(200); await miss(page, 'Help, nothing found', own);
    // a class page: its header, its tab row with the More menu open, and the Assignments tab with a card's and a unit's menu open
    await goTo(page, await page.$eval('#railClasses a', a => a.getAttribute('href'))); await page.waitForSelector('#vClass .card'); await miss(page, 'class page, Assignments', own);
    await page.click('#ctMore'); await pause(200); await miss(page, 'class page, More', own); await page.keyboard.press('Escape');
    await page.click('#clsSetup'); await pause(200); await miss(page, 'class page, Class setup', own); await page.keyboard.press('Escape');
    await page.click('#vClass .card .kdots'); await pause(200); await miss(page, 'class page, an assignment’s menu', own); await page.keyboard.press('Escape');
    await page.click('#vClass .uhead .kdots'); await pause(200); await miss(page, 'class page, a unit’s menu', own); await page.keyboard.press('Escape');
    // the Gradebook tab: the table, its menu, a column's box, the averages, the whole year, students left out, and scores typed in each way
    {
      const base = await page.$eval('#railClasses a', a => a.getAttribute('href')), mine = [...own, /^Term \d/, /^[A-Z][a-z]{2} \d{1,2}$/];
      const at = async (where, f) => { await f(); await pause(400); await miss(page, 'class page, ' + where, mine); };
      await goTo(page, base + '/gradebook'); await page.waitForSelector('#classPanel table'); await at('Gradebook', () => page.click('#classPanel .bkhow summary'));
      await at('Gradebook, More', () => page.click('#bkMore')); await page.keyboard.press('Escape');
      await at('Gradebook, a column', () => page.click('#classPanel [data-bkcol]')); await page.click('#bkPop [data-bkpopclose]');
      await at('Gradebook, averages only', () => page.click('#classPanel [data-bkonly="1"]')); await page.click('#classPanel [data-bkonly=""]');
      await at('Gradebook, whole year', () => page.click('#classPanel [data-bkterm="*"]')); await page.click('#classPanel [data-bkterm]:first-child'); await pause(300);
      await at('Gradebook, students left out', async () => { await page.click('#bkMore'); await pause(200); await page.click('[data-bkpickon]'); await pause(300); await page.click('#classPanel .bkpick'); });
      await page.click('#classPanel [data-bkpickon]'); await pause(300);
      await at('Gradebook, add scores', () => page.click('#classPanel [data-bkadd]'));
      await at('Gradebook, add extra credit', async () => { await page.click('#classPanel [data-bkatype="xc"]'); await page.click('#classPanel [data-bkaxcall="all"]'); });
      await at('Gradebook, add feedback only', () => page.click('#classPanel [data-bkatype="fm"]'));
      await at('Gradebook, add percents', async () => { await page.click('#classPanel [data-bkatype="ic"]'); await page.click('#classPanel [data-bkamode="pct"]'); });
      await page.click('#classPanel [data-bkback]');
      // the Students tab, with the box for pasting IDs open
      await goTo(page, base + '/students'); await page.waitForSelector('#peopleTbl table'); await at('Students', () => page.click('#classPanel [data-ppaste]'));
      // the Attendance tab: a day not taken, a day taken with each way a student can stand, its menu, and Look back
      await goTo(page, base + '/attendance'); await page.waitForSelector('#attList'); await miss(page, 'class page, Attendance', mine);
      await at('Attendance, taken', async () => { for (const [i, k] of [[0, 'l'], [1, 'a'], [2, 'e']]) { await page.click('[data-attrow="' + i + '"] [data-atts="' + k + '"]'); await pause(150); } });
      await at('Attendance, a day’s menu', () => page.click('#classPanel .kdots')); await page.keyboard.press('Escape');
      await goTo(page, base + '/attendance/all'); await page.waitForSelector('#attTab'); await miss(page, 'class page, Attendance, Look back', mine);
      await at('Attendance, all dates', () => page.click('#classPanel [data-attterm="*"]'));
      await page.evaluate(() => document.querySelector('#classPanel [data-attterm]').click()); await pause(200);
      // the Seating tab: choosing a room, the chart with a student picked, its menu, and arranging the room
      await goTo(page, base + '/seating'); await page.waitForSelector('#seatStart'); await miss(page, 'class page, Seating, a new room', mine);
      await at('Seating', () => page.click('#classPanel [data-seatroom]'));
      await at('Seating, a student picked', () => page.click('#classPanel .seatchip'));
      await at('Seating, seated', async () => { await page.click('#classPanel [data-desk]'); await pause(200); await page.click('#classPanel [data-desk][data-n]'); });
      await at('Seating, menu', () => page.click('#classPanel .kdots'));
      await at('Seating, arranging', () => page.click('[data-seat="arrange"]')); await page.click('#classPanel [data-seat="done"]');
      // the Missing work tab, by student and by assignment, and the year
      await goTo(page, base + '/missing'); await page.waitForSelector('#mis'); await miss(page, 'class page, Missing work', mine);
      await at('Missing work, by assignment', () => page.click('#classPanel [data-misview="col"]'));
      await at('Missing work, whole year', () => page.click('#classPanel [data-bkterm="*"]'));
      // a student's own page (one with work missing and a day late), Charts, Goals with none yet, and Report comments with a limit and one done
      await page.click('#classPanel [data-bkterm]:first-child'); await pause(300);
      for (const [t, sel] of [['students/1', '#bkStuTiles'], ['students/5', '#bkStuTiles'], ['charts', '#bkHeat'], ['goals', '#glView'], ['reports', '#rpt']]) { await goTo(page, base + '/' + t); await page.waitForSelector(sel); await pause(400); await miss(page, 'class page, ' + t, mine); }
      await at('Report comments, a limit and one done', async () => { await page.$eval('#rptLimit', e => { e.value = 100; e.dispatchEvent(new Event('change', { bubbles: true })); }); await pause(300); await page.click('[data-rptdoit]'); await pause(300); await page.click('[data-rptstu="0"]'); });
      await goTo(page, base + '/charts'); await page.waitForSelector('#bkHeat'); await at('Charts, whole year', () => page.click('#classPanel [data-bkterm="*"]'));
      await page.click('#classPanel [data-bkterm]:first-child'); await pause(300);
    }
    // every page of Settings
    for (const k of ['saving', 'classes', 'terms', 'marking', 'setup', 'display', 'about']) { await goTo(page, '#/settings/' + k); await pause(500); await miss(page, 'Settings, ' + k, [...own, '{ "gradingStudioSetup": 1, … }']); }
    await goTo(page, '#/'); await openZip(page, zip); await score(page, [3]); await settle(page);
    await page.click('#closeBtn'); await page.waitForSelector('#toMark .krow');
    await miss(page, 'Today, with papers to mark', own);
    await page.click('#findBtn'); await page.waitForSelector('#findDlg .frow'); await miss(page, 'Find anything, with kept papers', own);
    assert.deepEqual(page.errors, []);
    await close();
  }
});

// Learning goals on both rubrics, and two days of attendance, on the made-up class.
function goalsSeed() {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.goals = [{ id: 'g1', name: 'Makes a clear claim', at: 1 }, { id: 'g2', name: 'Uses evidence', at: 1 }, { id: 'g3', name: 'Not used yet', at: 1 }];
  lib.classes[0].att = { '2026-09-01': { t: 1, m: { 'Aria Testwell': 'l', 'Dov Madeup': 'a' }, n: { 'Aria Testwell': 'bus was late' } }, '2026-09-02': { t: 1, m: { 'Dov Madeup': 'e' } } };
  const ls = { ...s.ls, 'gs.lib': JSON.stringify(lib) };
  for (const k of ['gs.b.n1', 'gs.b.n2']) { const w = JSON.parse(ls[k]); w.setup = { ...w.setup, goals: ['g1', 'g2', null] }; ls[k] = JSON.stringify(w); }
  return { ...s, ls };
}
// The made-up MYP class, and beside it a DP class with one paper typed in and one grade predicted.
function ibBoth() {
  const s = ibSeed(), lib = JSON.parse(s.ls['gs.lib']), c = lib.classes[1];
  c.way = 'dp'; c.pred = { t1: { 'Aria Testwell': { g: 6, t: 1 } } };
  c.units = [{ id: 'u9', name: 'Unit 1', items: [{ id: 'd1', name: 'Paper 1', classId: 'c2', type: 'sum', due: '2026-09-20', typed: { max: 20, s: { 'Aria Testwell': { v: 18 }, 'Bram Sample': { v: 11 }, 'Cleo Fixture': { v: null, st: 'missing' } } } }] }];
  return { ...s, ls: { ...s.ls, 'gs.lib': JSON.stringify(lib) } };
}
test('a class with learning goals and attendance, an MYP class and a DP class leave nothing in English either', async () => {
  const own = ['Grade 9 English', 'Grade 10 Literature', 'MYP 3 Sciences', /^Term \d/, /^[A-Z][a-z]{2} \d{1,2}$/];
  {
    const { page, close } = await openApp(browser, { seed: goalsSeed() });
    await page.waitForSelector('#railClasses a');
    const base = await page.$eval('#railClasses a', a => a.getAttribute('href'));
    for (const [t, sel] of [['students/1', '#glStu'], ['students/4', '#attStu'], ['goals', '#glHeat'], ['charts', '#bkHeat']]) { await goTo(page, base + '/' + t); await page.waitForSelector(sel); await pause(400); await miss(page, 'with goals, ' + t, own); }
    assert.deepEqual(page.errors, []);
    await close();
  }
  {
    const { page, close } = await openApp(browser, { seed: ibBoth() });
    await page.waitForSelector('#railClasses a');
    const [myp, dp] = await page.$$eval('#railClasses a', as => as.map(a => a.getAttribute('href')));
    for (const [t, sel] of [['gradebook', '#ibTab'], ['students', '#peopleTbl table'], ['students/1', '#ibFit'], ['students/5', '#ibFit'], ['charts', '#ibTiles'], ['reports', '#rpt'], ['missing', '#mis']]) { await goTo(page, myp + '/' + t); await page.waitForSelector(sel); await pause(400); await miss(page, 'MYP, ' + t, own); }
    await goTo(page, myp + '/gradebook'); await page.waitForSelector('#ibTab');
    await page.click('#classPanel [data-ibfit]'); await page.waitForSelector('#ibFit'); await miss(page, 'MYP, best fit', own);
    await page.click('#classPanel [data-ibback]'); await page.waitForSelector('#ibTab'); await page.click('#classPanel [data-ibadd-lv]'); await page.waitForSelector('#ibAdd'); await miss(page, 'MYP, add levels', own);
    await page.click('#classPanel [data-ibacancel]'); await page.waitForSelector('#ibTab'); await page.click('#classPanel [data-bkterm]:nth-child(2)'); await pause(400); await miss(page, 'MYP, a term with no levels', own);
    await page.click('#classPanel [data-bkterm]:first-child'); await pause(300);
    for (const [t, sel] of [['gradebook', '#classPanel table'], ['students/1', '#bkStuTiles'], ['charts', '#bkTiles'], ['reports', '#rpt']]) { await goTo(page, dp + '/' + t); await page.waitForSelector(sel); await pause(400); await miss(page, 'DP, ' + t, own); }
    await goTo(page, dp + '/gradebook'); await page.waitForSelector('#classPanel table'); await pick(page, '[data-ibpredopen]'); await page.waitForSelector('#ibPred'); await miss(page, 'DP, predicted grades', own);
    assert.deepEqual(page.errors, []);
    await close();
  }
});

test('a student’s page, Charts and Report comments in Spanish: the app’s words change, and names, rubric rows, criteria and the comment itself do not', async () => {
  const { page, close } = await openApp(browser, { seed: inSpanish(goalsSeed()) });
  await page.waitForSelector('#railClasses a');
  const base = await page.$eval('#railClasses a', a => a.getAttribute('href'));
  await goTo(page, base + '/students/4'); await page.waitForSelector('#attStu');
  assert.equal(await text(page, '#bkStuName'), 'Dov Madeup');
  assert.match(await text(page, '#bkStuTiles'), /Nota del periodo .* promedio de la clase: [\d.]+% .* 2 de 3 cuentan .* No entregado 1 Timed paragraph/);
  assert.match(await text(page, '#bkStrip'), /El periodo hasta ahora .* Reading check 1 En clase · 1 sept/);
  assert.match(await page.$eval('#bkStuLine', e => e.getAttribute('aria-label')), /^Reading check 1 60%, mediana de la clase 78%\. .* Timed paragraph no entregado, mediana de la clase 80%$/);
  assert.deepEqual(await page.$$eval('#bkStuRows .chrow > span', xs => xs.map(x => x.textContent)), ['Ideas', 'Organization', 'Language']);
  assert.match(await text(page, '#attStu'), /Días presente: 0 de 2\. Ausentes \(motivo desconocido\): 1 · Justificad[oa]s: 1\./);
  // pointing at a mark of a chart says it in Spanish too, with the assignment's own name left as it is
  const tip = async sel => { await page.$eval(sel, e => e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))); return page.$$eval('#ovTip > *', xs => xs.map(x => x.textContent)); };
  assert.deepEqual(await tip('#bkStuLine .bkdot'), ['60%', 'Reading check 1', 'Evaluación en clase · mitad central de la clase: 63–89 %']);
  assert.deepEqual(await tip('#bkStuRows .chrow'), ['2.5 sobre 4', 'Ideas', '2 sumativas · promedio de la clase: 3.3']);
  await goTo(page, base + '/charts'); await page.waitForSelector('#bkMove');
  assert.match(await page.$eval('#bkMove', e => e.getAttribute('aria-label')), /^Esme Placeholder sube 23\.3, .* Bram Sample baja 22\.3$/);
  assert.match(await page.$eval('#bkStacks', e => e.getAttribute('aria-label')), /^Reading check 1: 1 con menos de 60, 1 de 60 a 69, /);
  assert.equal(await page.$eval('#bkHeat th.chh button', e => e.title), 'Ordenar por Reading check 1');
  assert.equal(await page.$eval('#bkHeat th.chg button', e => e.title), 'Ordenar por la nota');
  assert.match(await text(page, '#bkCmp'), /^Grade 9 English [\d.]+%$/);
  await goTo(page, base + '/reports'); await page.waitForSelector('#rptText');
  assert.match(await page.$eval('#rptText', e => e.value), /^Aria has /, 'the draft is the teacher’s to change: it stays as it was written');
  assert.equal(await page.$eval('#rptText', e => e.getAttribute('aria-label')), 'Comentario de informe de Aria Testwell');
  assert.match(await text(page, '#rptFacts'), /^Nota: 91\.83% Lo más fuerte: Ideas 4 Por mejorar: Language 3$/);
  assert.equal(await page.$eval('#rptDone', e => e.textContent), '0 de 6 hechos');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a word of the language that is also an English word is not put into the language twice (German "Note")', async () => {
  const s = ibSeed(), { page, close } = await openApp(browser, { seed: { ...s, ls: { ...s.ls, 'gs.lang': '"de"' } } });
  await page.waitForSelector('#railClasses a');
  await goTo(page, await page.$eval('#railClasses a', a => a.getAttribute('href')) + '/students/3'); await page.waitForSelector('#ibFit');
  await pause(400);
  assert.equal(await page.$eval('#bkStuTiles .ovl', e => e.textContent), 'Note');
  assert.equal(await page.$eval('#bkStuTiles .ovt:nth-child(3) .ovl', e => e.textContent), 'A Knowing and understanding', 'a criterion’s name is the teacher’s');
  assert.match(await text(page, '#ibFit'), /Stufen Term 1 · wählen Sie die Stufe, die am besten passt · 4 von 4 festgelegt A Knowing and understanding Cells lab report 8 /);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Help is in Spanish, topic for topic, and is found by Spanish or English words', async () => {
  const { page, close } = await openApp(browser, { seed: inSpanish() });
  // the file has every topic, with as many paragraphs, steps and bold names as the English
  const en = await (async () => { const a = await openApp(browser, { seed: gradingSeed() }); const t = await a.page.evaluate(() => window.__gs.helpTopics().map(t => ({ id: t.id, q: t.q, a: t.a, go: t.go || null }))); await a.close(); return t; })();
  const es = await page.evaluate(() => window.__gs.helpTopics().map(t => ({ id: t.id, q: t.q, a: t.a, go: t.go || null })));
  assert.deepEqual(es.map(t => t.id), en.map(t => t.id));
  for (const [i, t] of es.entries()) {
    assert.notEqual(t.q, en[i].q, t.id + ' has a Spanish question');
    assert.equal(t.a.length, en[i].a.length, t.id + ' has the same paragraphs');
    assert.deepEqual(t.a.map(p => /^\d+\. /.test(p)), en[i].a.map(p => /^\d+\. /.test(p)), t.id + ' has the same steps');
    assert.deepEqual(t.a.map(p => (p.match(/\*\*/g) || []).length % 2), t.a.map(() => 0), t.id + ' closes every bold name');
    if (en[i].go) { assert.equal(t.go[1], en[i].go[1]); assert.notEqual(t.go[0], en[i].go[0], t.id + ' has a Spanish button'); }
  }
  await goTo(page, '#/help/where-saved');
  await page.waitForSelector('#hlp-where-saved.on');
  assert.equal(await text(page, '#hlp-where-saved .hlph'), '¿Dónde se guarda mi trabajo?');
  assert.match(await text(page, '#hlp-where-saved .hlpa'), /No hay botón de guardar ni cuenta/);
  assert.equal(await text(page, '#hlp-where-saved .hlpgo'), 'Abrir Ajustes, Guardado');
  assert.equal(await page.$eval('#vHelp .hlpsec h2', e => e.textContent), 'Primeros pasos');
  // a button in Settings has its Spanish name in the answer, as Settings shows it
  await goTo(page, '#/help/tablet'); await page.waitForSelector('#hlp-tablet.on');
  assert.match(await page.$eval('#hlp-tablet .hlpa', e => e.innerHTML), /<b>Tableta y lápiz<\/b>/);
  // a button on a screen that is still in English keeps its English name in the answer, so it can be found
  await goTo(page, '#/help/quick-mark'); await page.waitForSelector('#hlp-quick-mark.on');
  assert.match(await page.$eval('#hlp-quick-mark .hlpa', e => e.innerHTML), /<b>Points to levels<\/b>/);
  for (const [q, id] of [['copia de seguridad', 'where-saved'], ['backup', 'where-saved'], ['rúbrica', 'rubric']]) {
    await page.$eval('#hlpIn', e => { e.value = ''; }); await page.type('#hlpIn', q);
    await page.waitForFunction(id => !!document.querySelector('#hlp-' + id) && /respuestas?$/.test(document.querySelector('#hlpList h2').textContent), {}, id);
  }
  // Find anything finds a row by its Spanish words and by its English ones
  await goTo(page, '#/');
  for (const [q, label] of [['ajustes', 'Ajustes'], ['settings', 'Ajustes'], ['modo osc', 'Modo oscuro'], ['llevarme', 'Llevarme mi trabajo'], ['Grade 9', 'Grade 9 English']]) {
    await page.click('#findBtn'); await page.waitForSelector('#findIn'); await page.type('#findIn', q);
    await page.waitForFunction(l => [...document.querySelectorAll('#findDlg .frow b')].some(b => b.textContent === l), {}, label);
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('the welcome can be put into Spanish before anything else, and works there', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.waitForSelector('#wlLang');
  assert.equal(await text(page, '#welcome h1'), 'Mark papers, plan lessons, hand work back.');
  await Promise.all([page.waitForNavigation(), page.select('#wlLang', 'es')]);
  await page.waitForFunction(() => { const h = document.querySelector('#welcome h1'); return h && /Corrige trabajos/.test(h.textContent); });
  assert.equal(await text(page, '#welcome h1'), 'Corrige trabajos, planifica lecciones, devuelve los trabajos.');
  assert.equal(await page.$eval('#welcome [data-wlc="0"]', e => e.placeholder), 'Una clase, como Biología 2.º B');
  assert.deepEqual(await page.$$eval('#wlSys option', o => [o[0].textContent, o[o.length - 1].textContent, o[1].textContent]), ['En papel, o prefiero no decirlo', 'En otro sitio…', await page.$eval('#wlSys option:nth-child(2)', e => e.value)], 'the systems keep their names');
  await page.type('#welcome [data-wlc="0"]', 'Biología 2');
  await page.click('#welcome [data-wlnext]'); await page.waitForSelector('#welcome [data-wlway]');
  assert.equal(await text(page, '#welcome [data-wlway="rubric"] b'), 'Filas de rúbrica');
  assert.equal(await text(page, '#welcome [data-wlback]'), 'Atrás');
  await page.click('#welcome [data-wlnext]'); await page.waitForFunction(() => /Empezar/.test(document.querySelector('#welcome [data-wlnext]').textContent));
  await page.click('#welcome [data-wlnext]'); await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  assert.deepEqual(await page.$$eval('#railClasses .rname', els => els.map(e => e.textContent)), ['Biología 2']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].name), 'Biología 2');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with the app in Spanish the feedback page in a returned paper is in Spanish', async () => {
  const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], levels: [{ 4: 'A clear claim.' }, {}, {}] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(SETUP), ...ES } }, feedback: true });
  await openZip(page, zip);
  await score(page, [4, 3, 3]);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [220, 300]]);   // a paper goes back when it has a mark on it
  await settle(page);
  const d = await page.evaluate(() => window.__gs.fbData(0));
  assert.match(d.sub, / · devuelto: \d+ [a-zé]+\.?$/i, 'the line under the title: ' + d.sub);
  // every line the page draws, read as it is drawn
  await page.evaluate(() => { window.__drawn = []; const was = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__drawn.push(String(t)); return was.call(this, t, ...a); }; });
  const dl = await catchDownloads(page);
  await page.click('#exportBtn'); await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  const drawn = await page.evaluate(() => window.__drawn);
  for (const s of ['CÓMO SE PUNTUÓ', '4 de 4', 'Tu trabajo corregido empieza en la página siguiente.']) assert.ok(drawn.includes(s), 'the page says “' + s + '”: ' + JSON.stringify(drawn.filter(x => /punt|scored|página|page/i.test(x))));
  for (const s of ['HOW IT WAS SCORED', 'Your marked paper starts on the next page.']) assert.ok(!drawn.includes(s), 'and not “' + s + '”');
  await closeBox(page, '#dlgBox .bf [data-close]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Planner’s sidebar and its Find anything follow the same setting, and the Planner still stores nothing for it', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const g = await openApp(browser, { server: srv, context: ctx, seed: inSpanish() });
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
    await page.goto(srv.url + 'planner.html');
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    assert.equal(await page.evaluate(() => window.__gsLang.lang), 'es');
    assert.deepEqual(await page.$$eval('#rail .rnav .rl, #rail .rcap .rl', els => els.filter(e => e.checkVisibility()).map(e => e.textContent.trim())),
      ['Hoy', 'Pendientes', 'Centro', 'Planificador', 'Calendario', 'Unidades', 'Lecciones anteriores', 'Actividades', 'Rúbricas', 'Clases', 'Configura tu horario', 'Pantalla completa', 'Ayuda', 'Ajustes']);
    assert.match(await text(page, '#railSaved'), /^Sin copia de seguridad\s*Este navegador$/);
    await page.click('#findBtn'); await page.waitForSelector('#findIn'); await page.type('#findIn', 'copia de seg');
    await page.waitForFunction(() => [...document.querySelectorAll('#findDlg .frow b')].some(b => b.textContent === '¿Dónde se guarda mi trabajo?'));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => localStorage.getItem('gs.lang')), '"es"', 'the Planner reads the setting and leaves it as it was');
    assert.deepEqual(page.errors, []); assert.deepEqual(g.page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

// ---------------- Traditional Chinese ----------------
const ZH = { 'gs.lang': '"zh-Hant"' };
const inChinese = () => { const s = gradingSeed(); Object.assign(s.ls, ZH); return s; };
const HAN = /[一-鿿]/;

test('Traditional Chinese: the sidebar, Today and the sentences Today builds, with typed names left alone', async () => {
  const { page, close } = await openApp(browser, { seed: inChinese() });
  await page.waitForFunction(() => window.__gsLang && window.__gsLang.lang === 'zh-Hant' && document.querySelector('#rail [data-nav="home"]').textContent.trim() === '今天');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh-Hant');
  assert.deepEqual(await page.$$eval('#rail .rnav[data-nav]:not([hidden]) .rl:not(.rcnt), #rail #lessonsBtn .rl, #rail .rcap .rl, #rail .rfind .rl:not(kbd), #addClass .rl', els => els.map(e => e.textContent.trim())), ['搜尋', '今天', '待辦事項', '備課', '學校', '班級', '新增班級', '說明', '設定']);
  assert.deepEqual(await page.$$eval('#railClasses .rname', els => els.map(e => e.textContent)), ['Grade 9 English', 'Grade 10 Literature'], 'class names stay as typed');
  assert.equal(await page.$eval('#dropTitle', e => e.textContent), '把新的學生作業拖到這裡');
  assert.equal(await page.$eval('#pickFiles', e => e.textContent), '選擇檔案…');
  assert.match(await page.$eval('#homeDate', e => e.textContent), /\d+月\d+日/, 'the date is written the Chinese way');
  const want = {
    'One class today. One set of papers to mark.': '今天有 1 堂課。1 批作業待批改。',
    'Three classes today. Two sets of papers to mark, one ready to hand back.': '今天有 3 堂課。2 批作業待批改，1 批可以發還。',
    'No classes today. Nothing waiting to be marked.': '今天沒有課。沒有待批改的作業。',
    'One set of papers ready to hand back.': '1 批作業可以發還。',
    '3 of 6 scored · 1 partial · 2 missing or excused': '6 份中已評 3 份 · 1 份評到一半 · 2 份缺交或免交',
    'The river · 12 slides · taught to slide 4 of 12 · and 1 more': 'The river · 12 張投影片 · 上到第 4 張，共 12 張 · 還有 1 項',
    'One student scored 2 or below on Evidence.': '1 位學生在 Evidence 得到 2 分或以下。',
    'Every row came out the same on the last set of papers.': '在最近一批作業中，每個項目的結果都一樣。',
    'Thesis 3 of 4, Evidence 2.5 of 4': 'Thesis 3 / 4、Evidence 2.5 / 4',
    'In this browser and your “Marking” folder': '存在這個瀏覽器和你的 “Marking” 資料夾',
    'Aria Testwell': 'Aria Testwell', 'Narrative essay · Unit 1': 'Narrative essay · Unit 1',
  };
  for (const [en, zh] of Object.entries(want)) assert.equal(await page.evaluate(s => window.__gsLang.tr(s, 'zh-Hant'), en), zh);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Traditional Chinese: Help topic for topic, found by Chinese or English words, and Find anything', async () => {
  const { page, close } = await openApp(browser, { seed: inChinese() });
  const en = await (async () => { const a = await openApp(browser, { seed: gradingSeed() }); const t = await a.page.evaluate(() => window.__gs.helpTopics().map(t => ({ id: t.id, q: t.q, a: t.a, go: t.go || null }))); await a.close(); return t; })();
  const zh = await page.evaluate(() => window.__gs.helpTopics().map(t => ({ id: t.id, q: t.q, a: t.a, go: t.go || null })));
  assert.deepEqual(zh.map(t => t.id), en.map(t => t.id));
  for (const [i, t] of zh.entries()) {
    assert.match(t.q, HAN, t.id + ' has a Chinese question');
    assert.equal(t.a.length, en[i].a.length, t.id + ' has the same paragraphs');
    for (const p of t.a) assert.match(p, HAN, t.id + ' is answered in Chinese');
    assert.deepEqual(t.a.map(p => /^\d+\. /.test(p)), en[i].a.map(p => /^\d+\. /.test(p)), t.id + ' has the same steps');
    assert.deepEqual(t.a.map(p => (p.match(/\*\*/g) || []).length % 2), t.a.map(() => 0), t.id + ' closes every bold name');
    if (en[i].go) { assert.equal(t.go[1], en[i].go[1]); assert.notEqual(t.go[0], en[i].go[0], t.id + ' has a Chinese button'); }
  }
  await goTo(page, '#/help/where-saved');
  await page.waitForSelector('#hlp-where-saved.on');
  assert.equal(await text(page, '#hlp-where-saved .hlph'), '我的工作成果存在哪裡？');
  assert.equal(await text(page, '#hlp-where-saved .hlpgo'), '開啟設定、儲存');
  assert.equal(await page.$eval('#vHelp .hlpsec h2', e => e.textContent), '開始使用');
  for (const [q, id] of [['備份', 'where-saved'], ['backup', 'where-saved'], ['評分規準', 'rubric']]) {
    await page.$eval('#hlpIn', e => { e.value = ''; }); await page.type('#hlpIn', q);
    await page.waitForFunction(id => !!document.querySelector('#hlp-' + id) && /則解答$/.test(document.querySelector('#hlpList h2').textContent), {}, id);
  }
  await goTo(page, '#/');
  for (const [q, label] of [['設定', '設定'], ['settings', '設定'], ['深色', '深色模式'], ['Grade 9', 'Grade 9 English']]) {
    await page.click('#findBtn'); await page.waitForSelector('#findIn'); await page.type('#findIn', q);
    await page.waitForFunction(l => [...document.querySelectorAll('#findDlg .frow b')].some(b => b.textContent === l), {}, label);
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('Traditional Chinese: the feedback page in a returned paper is in Chinese', async () => {
  const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], levels: [{ 4: 'A clear claim.' }, {}, {}] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(SETUP), ...ZH } }, feedback: true });
  await openZip(page, zip);
  await score(page, [4, 3, 3]);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [220, 300]]);
  await settle(page);
  await page.evaluate(() => { window.__drawn = []; const was = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__drawn.push(String(t)); return was.call(this, t, ...a); }; });
  const dl = await catchDownloads(page);
  await page.click('#exportBtn'); await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  const drawn = await page.evaluate(() => window.__drawn);
  for (const s of ['評分方式', '4 / 4', '批改後的作業從下一頁開始。']) assert.ok(drawn.includes(s), 'the page says “' + s + '”: ' + JSON.stringify(drawn.slice(0, 40)));
  for (const s of ['HOW IT WAS SCORED', 'Your marked paper starts on the next page.']) assert.ok(!drawn.includes(s), 'and not “' + s + '”');
  await closeBox(page, '#dlgBox .bf [data-close]');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---- a language is fetched only when it is chosen ---- */
// A server that counts what a page asks for, and can refuse the language files, as with no internet on a computer that never used one.
function serveCounting(html, { noLangs } = {}) {
  const asked = [];
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0]; asked.push(p);
    if (!noLangs && langFile(res, p)) return;
    if (p !== '/' && p !== '/index.html' && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(p === '/blank' ? '<!doctype html><title>blank</title>' : html);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ asked, url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
test('the page at the web address carries no language: English asks for none, and Spanish fetches its one file', async () => {
  const html = builtHtml();
  assert.match(html, /const LANG_PACKED = \{\};/, 'no language is inside the page');
  for (const f of fs.readdirSync(path.join(ROOT, 'lang'))) assert.ok(fs.statSync(path.join(ROOT, 'lang', f)).size < 250e3, f + ' is a small file');
  let srv = await serveCounting(html), o = await openApp(browser, { server: srv, seed: gradingSeed() });
  assert.equal(await o.page.evaluate(() => window.__gsLang.lang), 'en');
  assert.deepEqual(srv.asked.filter(p => p.startsWith('/lang/')), [], 'in English nothing is fetched');
  assert.deepEqual(o.page.errors, []); await o.close(); await srv.close();
  srv = await serveCounting(html); o = await openApp(browser, { server: srv, seed: inSpanish() });
  await o.page.waitForFunction(() => document.querySelector('#rail [data-nav="home"]').textContent.trim() === 'Hoy');
  assert.deepEqual([...new Set(srv.asked.filter(p => p.startsWith('/lang/')))], ['/lang/es.js'], 'Spanish fetches Spanish and no other');
  assert.deepEqual(o.page.errors, []); await o.close(); await srv.close();
});
test('a language that can’t be fetched leaves the app in English for that visit, keeps the choice, and says so in Settings', async () => {
  const srv = await serveCounting(builtHtml(), { noLangs: true }), { page, close } = await openApp(browser, { server: srv, seed: inSpanish() });
  assert.equal(await page.evaluate(() => window.__gsLang.lang), 'en');
  assert.equal(await text(page, '#rail [data-nav="home"]'), 'Today');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lang')), '"es"', 'the choice is kept');
  await goTo(page, '#/settings/display');
  assert.equal(await page.$eval('#setLangPick', e => e.value), 'es', 'and the picker still shows it');
  assert.match(await text(page, '#setLangMiss'), /^Español could not be fetched just now, so this visit is in English\./);
  assert.deepEqual(page.errors.filter(e => !/lang\/es\.js/.test(e)), []);
  await close(); await srv.close();
});
test('the double-click copy has every language inside and fetches nothing', async () => {
  const one = fs.readFileSync(path.join(ROOT, 'Grading Studio.html'), 'utf8');
  assert.ok(!/gsL=JSON\.parse/.test(one), 'it has no fetching step');
  const srv = await serveCounting(one, { noLangs: true }), { page, close } = await openApp(browser, { server: srv, seed: { ...gradingSeed(), ls: { ...gradingSeed().ls, 'gs.lang': '"ja"' } } });
  await page.waitForFunction(() => document.querySelector('#rail [data-nav="home"]').textContent.trim() === '今日');
  assert.equal(await page.evaluate(() => window.__gsLang.lang), 'ja');
  assert.deepEqual(srv.asked.filter(p => p.startsWith('/lang/')), []);
  assert.deepEqual(page.errors, []);
  await close(); await srv.close();
});

// The boxes and questions a class page opens: each one, as a new teacher and an IB teacher meet them, is walked in English
// and what no language file knows is listed. Then one of them in Spanish, with the names typed into it left as they are.
test('the boxes a class page opens leave nothing in English', async () => {
  const own = ['Grade 9 English', 'Grade 10 Literature', 'MYP 3 Sciences', /^Term \d/, /^[A-Z][a-z]{2} \d{1,2}$/];
  const esc = async page => { await page.keyboard.press('Escape'); await pause(250); };
  {
    const { page, close } = await openApp(browser, { seed: gradingSeed() });
    const base = await page.$eval('#railClasses a', a => a.getAttribute('href'));
    const at = async (where, f) => { await f(); await pause(400); assert.ok(await page.$('#dlgBox[data-lg]:not(:empty), #askDlg[data-lg]'), where + ': the box is put into the language'); await miss(page, 'box, ' + where, own); };
    await goTo(page, base); await page.waitForSelector('#vClass .card');
    await at('new assignment', () => page.click('[data-newasg]'));
    await at('new assignment, every class', async () => { for (const x of await page.$$('#aClasses input:not(:checked)')) await x.click(); }); await esc(page);
    await at('edit assignment', async () => { await page.click('#vClass .card .kdots'); await pause(200); await page.click('[data-edit-asg]'); });
    await at('delete an assignment', () => page.click('#dlgBox [data-del]')); await esc(page); await esc(page);
    const unit = async sel => { await page.click('#vClass .uhead .kdots'); await pause(200); await page.click(sel); };
    for (const [w, sel] of [['rename a unit', '[data-urename]'], ['a unit’s link', '[data-uatlas]'], ['delete a unit', '[data-udel]']]) { await at(w, () => unit(sel)); await esc(page); }
    await at('add a unit', () => page.click('.addunit')); await esc(page);
    await at('edit roster', async () => { await page.click('#clsSetup'); await pause(200); await page.click('[data-edit-class]'); });
    await at('delete a class', () => page.click('#dlgBox [data-del]')); await esc(page); await esc(page);
    await at('the class page link', async () => { await page.click('#clsSetup'); await pause(200); await page.click('[data-mbset]'); }); await esc(page);
    await at('how the class is graded', async () => { await page.click('#clsSetup'); await pause(200); await page.click('[data-ib-class]'); });
    for (const w of ['myp', 'dp']) await at('how the class is graded, ' + w, () => page.click('[data-ibway="' + w + '"]'));
    await esc(page);
    await goTo(page, base + '/missing'); await page.waitForSelector('#mis'); await at('email wording', () => page.click('[data-miswords]')); await esc(page);
    await goTo(page, base + '/reports'); await page.waitForSelector('#rpt'); await at('report wording', () => page.click('[data-rptwords]')); await esc(page);
    await goTo(page, base + '/students'); await page.waitForSelector('[data-pssall]'); await at('progress sheets', () => page.click('[data-pssall]')); await esc(page);
    await goTo(page, base + '/students/1'); await page.waitForSelector('[data-pssone]'); await at('one progress sheet', () => page.click('[data-pssone]'));
    await at('one progress sheet, every choice flipped', async () => { for (const k of await page.$$eval('[data-pssopt]', x => x.map(y => y.dataset.pssopt))) { await page.click('[data-pssopt="' + k + '"]'); await pause(150); } }); await esc(page);
    // an assignment made with no papers yet: where they are, matching files to the roster, and notes pages instead
    await goTo(page, base); await page.waitForSelector('#vClass .card');
    await page.click('[data-newasg]'); await pause(300); await page.type('#aName', 'Speech'); await page.click('#dlgBox [data-ok]'); await pause(500);
    const open = () => page.$eval('[data-open-asg]', x => x.click());
    await at('open an assignment', open); await at('match files to a roster', () => page.click('[data-match]')); await esc(page);
    await open(); await pause(300); await at('no papers', () => page.click('[data-nopaper]'));
    await at('no papers, each page', async () => { for (const t of await page.$$('.nptile:not([disabled])')) { await t.click(); await pause(100); } }); await esc(page);
    assert.deepEqual(page.errors, []);
    await close();
  }
  {
    const { page, close } = await openApp(browser, { seed: ibBoth() });
    for (const base of await page.$$eval('#railClasses a', a => a.map(x => x.getAttribute('href')))) {
      await goTo(page, base + '/students'); await page.waitForSelector('[data-pssall]'); await page.click('[data-pssall]'); await pause(500); await miss(page, 'IB progress sheets, ' + base, own); await esc(page);
      await goTo(page, base); await page.waitForSelector('#clsSetup'); await page.click('#clsSetup'); await pause(200); await page.click('[data-ib-class]'); await pause(400); await miss(page, 'IB grading box, ' + base, own); await esc(page);
    }
    assert.deepEqual(page.errors, []);
    await close();
  }
});

test('in Spanish, a class page’s boxes are in Spanish and what was typed into them is not', async () => {
  const { page, close } = await openApp(browser, { seed: inSpanish() });
  const base = await page.$eval('#railClasses a', a => a.getAttribute('href'));
  await goTo(page, base); await page.waitForSelector('#vClass .card');
  await page.click('#vClass .card .kdots'); await pause(200); await page.click('[data-edit-asg]'); await pause(400);
  assert.equal(await text(page, '#dlgBox h2'), 'Editar tarea');
  assert.equal(await page.$eval('#aName', e => e.value), 'Reading check 1');
  assert.ok((await page.$$eval('#aUnit option', o => o.map(x => x.textContent))).includes('Unit 1: Stories'));
  await page.click('#dlgBox [data-del]'); await pause(400);
  assert.equal(await text(page, '#askText'), '¿Eliminar “Reading check 1”?');
  assert.equal(await text(page, '#askDlg [data-ok]'), 'Eliminar');
  await page.keyboard.press('Escape'); await pause(200); await page.keyboard.press('Escape'); await pause(200);
  await goTo(page, base + '/students'); await page.waitForSelector('[data-pssall]'); await page.click('[data-pssall]'); await pause(600);
  assert.equal(await text(page, '#pssTitle'), 'Hojas de progreso');
  assert.equal(await text(page, '.pss h3'), 'Aria Testwell');
  assert.equal(await page.$eval('.psshead small', e => e.textContent), 'Informe de progreso');
  assert.ok((await page.$$eval('.pss .psstab td[data-raw]', t => t.map(x => x.textContent))).includes('Narrative essay'));
  assert.deepEqual(page.errors, []);
  await close();
});

// The marking screen: the top bar, the tools, the student list, the score panel, its menus and the Grades, Insights, Return and
// Rubric setup screens, before anything is scored, part way and with a rubric that says what each score means. Walked in English.
test('the marking screen and its tabs leave nothing in English', async () => {
  const own = [];
  const press = async k => { await page.keyboard.press(k); await pause(200); };
  let page, close;
  const at = async (where, f) => { await f(); await pause(400); await miss(page, 'marking, ' + where, own); };
  const tab = id => () => page.$eval(id, b => b.click());
  ({ page, close } = await openApp(browser, {}));
  await openZip(page, zip);
  await at('nothing scored', async () => {});
  for (const [w, id] of [['Insights, nothing scored', '#insightsTab'], ['Return, nothing scored', '#exportBtn'], ['Grades, nothing scored', '#gradesBtn'], ['Mark', '#markTab']]) await at(w, tab(id));
  await at('one row scored', () => press('3'));
  for (const id of ['#addMenuBtn', '#whoMore', '#gMore', '#cmtMore', '#lfBtn', '#moreBtn']) { await at('menu ' + id, tab(id)); await press('Escape'); }
  for (const [w, id] of [['Grades', '#gradesBtn'], ['Insights', '#insightsTab'], ['Return', '#exportBtn'], ['Mark again', '#markTab']]) await at(w, tab(id));
  await at('every row scored', async () => { await press('3'); await press('2'); });
  await at('missing', () => page.$$eval('#gstat .seg button', b => b[0].click()));
  await at('late', () => page.$$eval('#gstat .seg button', b => b[2].click()));
  await at('list folded', tab('#colL'));
  await at('Grades, grade sheet', async () => { await tab('#gradesBtn')(); await pause(400); await page.$$eval('#dlgBox .vseg a', a => a[1] && a[1].click()); });
  await at('Insights, percents', async () => { await tab('#insightsTab')(); await pause(400); await page.$$eval('#dlgBox .vseg a', a => a[1] && a[1].click()); });
  await at('Insights, consistency', () => page.$$eval('#dlgBox .vseg a', a => a[2] && a[2].click()));
  await at('Return, every row scored', tab('#exportBtn'));
  await tab('#markTab')(); await pause(300);
  await at('Rubric setup', tab('#setupBtn')); await press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
  // a rubric that says what each score means: pointing at a score, the whole row open, and closed again
  const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], levels: [{ 4: 'A clear claim.', 3: 'A claim.' }, {}, {}] };
  ({ page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(SETUP) } } }));
  await openZip(page, zip);
  await at('levels, nothing scored', async () => {});
  const row0 = v => page.$eval('#grade .scores[data-c="0"] button[data-v="' + v + '"]', b => b.click());
  await at('levels, a half point', () => row0('3.5'));
  await at('levels, the whole row', () => page.$eval('#lvBox [data-lvopen]', b => b.click()));
  await at('levels, closed again', () => page.$eval('#lvBox [data-lvopen]', b => b.click()));
  await at('levels, a score with nothing written', () => row0('2'));
  await at('levels, a row with nothing written', () => page.$eval('#grade .scores[data-c="1"] button[data-v="3"]', b => b.click()));
  assert.deepEqual(page.errors, []);
  await close();
});

test('in Spanish the marking screen is in Spanish, and names, rubric rows, comments and what each score means stay as typed', async () => {
  const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], levels: [{ 4: 'A clear claim.' }, {}, {}] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(SETUP), ...ES } } });
  await openZip(page, zip);
  assert.deepEqual(await page.$$eval('#app .atab', a => a.map(x => x.textContent.replace(/\d+$/, '').trim())), ['Corregir', 'Notas', 'Análisis', 'Ejemplos', 'Devolver']);
  assert.equal(await text(page, '#paper .who h2'), 'Aria Testwell');
  assert.deepEqual(await page.$$eval('#grade .cn > span', s => s.map(x => x.textContent)), ['Thesis', 'Evidence', 'Style']);
  await page.$eval('#grade .scores[data-c="0"] button[data-v="4"]', b => b.click()); await pause(300);
  assert.equal(await page.$eval('#lvBox .lvname', e => e.textContent), 'Thesis');
  assert.match(await text(page, '#lvBox .lvtxt'), /A clear claim\./);
  await page.click('#cmtIn'); await page.type('#cmtIn', 'Missing evidence'); await pause(300);
  assert.match(await page.$eval('#cmtIn', e => e.placeholder), /^Comentario para /);
  await page.$eval('#gradesBtn', b => b.click()); await pause(600);
  assert.ok((await page.$$eval('#dlgBox td.cm', t => t.map(x => x.textContent))).includes('Missing evidence'), 'the comment is as typed');
  assert.ok((await page.$$eval('#dlgBox th', t => t.map(x => x.textContent))).some(x => /Thesis/.test(x)), 'a rubric row is as typed');
  assert.deepEqual(page.errors, []);
  await close();
});
