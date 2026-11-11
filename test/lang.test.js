// Languages: English unless the teacher picks another in Settings or on the welcome; Spanish for the sidebar, Today, the welcome,
// Find anything, Help and the feedback page in a returned paper. Names a teacher typed are never translated, and the choice is one
// setting that touches no saved work. The coverage test is the one a new language file has to pass. Everyone here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { ROOT, builtHtml, openApp, openZip, goTo, score, settle, setTool, drag, catchDownloads, closeBox } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const ES = { 'gs.lang': '"es"' };
const inSpanish = s => { const o = s || gradingSeed(); return { ...o, ls: { ...o.ls, ...ES } }; };
const text = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const tr = (page, s) => page.evaluate(s => window.__gsLang.tr(s, 'es'), s);
function serveBoth() {
  builtHtml();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
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
  assert.deepEqual(await page.$$eval('#setLangPick option', o => o.map(x => x.value + ' ' + x.textContent)), ['en English', 'zh-Hant 繁體中文', 'es Español']);
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
  assert.deepEqual(await page.$$eval('#rail .rnav[data-nav] .rl:not(.rcnt), #rail #lessonsBtn .rl, #rail .rcap .rl, #rail .rfind .rl:not(kbd), #addClass .rl', els => els.map(e => e.textContent.trim())), ['Buscar', 'Hoy', 'Pendientes', 'Planificador', 'Clases', 'Añadir una clase', 'Ayuda', 'Ajustes']);
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
  // a screen that is not translated yet is simply still in English, and works
  await page.click('#railClasses a'); await page.waitForFunction(() => location.hash.startsWith('#/class'));
  assert.match(await text(page, '#vClass'), /Gradebook/);
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
    // what the app doesn't know is left exactly as it is
    'Aria Testwell': 'Aria Testwell', 'Narrative essay · Unit 1': 'Narrative essay · Unit 1', '  Today  ': '  Hoy  ',
  };
  for (const [en, es] of Object.entries(want)) assert.equal(await tr(page, en), es);
  await close();
});

test('every word on the covered screens is in each language file (run in English, the screens are walked and what is missing is listed)', async () => {
  const miss = async (page, where, own) => { for (const k of await page.evaluate(() => window.__gsLang.packs)) { const m = (await page.evaluate(k => window.__gsLang.missing(k), k)).filter(s => !own.some(o => o === s || (o instanceof RegExp && o.test(s)))); assert.deepEqual(m, [], where + ': not in the ' + k + ' language file'); } };
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
    await goTo(page, '#/settings/display'); await miss(page, 'Settings, Display', own);
    await goTo(page, '#/'); await openZip(page, zip); await score(page, [3]); await settle(page);
    await page.click('#closeBtn'); await page.waitForSelector('#toMark .krow');
    await miss(page, 'Today, with papers to mark', own);
    await page.click('#findBtn'); await page.waitForSelector('#findDlg .frow'); await miss(page, 'Find anything, with kept papers', own);
    assert.deepEqual(page.errors, []);
    await close();
  }
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
  // a button on a screen that is still in English keeps its English name in the answer, so it can be found
  await goTo(page, '#/help/tablet'); await page.waitForSelector('#hlp-tablet.on');
  assert.match(await page.$eval('#hlp-tablet .hlpa', e => e.innerHTML), /<b>Tablet and pencil<\/b>/);
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
      ['Hoy', 'Pendientes', 'Planificador', 'Calendario', 'Unidades', 'Lecciones anteriores', 'Actividades', 'Rúbricas', 'Clases', 'Configura tu horario', 'Ayuda', 'Ajustes']);
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
  assert.deepEqual(await page.$$eval('#rail .rnav[data-nav] .rl:not(.rcnt), #rail #lessonsBtn .rl, #rail .rcap .rl, #rail .rfind .rl:not(kbd), #addClass .rl', els => els.map(e => e.textContent.trim())), ['搜尋', '今天', '待辦事項', '備課', '班級', '新增班級', '說明', '設定']);
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
