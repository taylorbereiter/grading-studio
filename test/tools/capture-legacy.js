// Run once, against a build of the code as it was before saved-data versions existed:
//   node test/tools/capture-legacy.js path/to/old/index.html [fixture-folder-name]
// It grades a made-up stack in that old build with real gestures, makes a real backup, and freezes what the old code wrote.
// The frozen text lives in test/fixtures/<name>/. The papers themselves aren't kept: bins.json names the generated file behind
// each one, so test/legacy.test.js rebuilds the exact ZIP the old code made, without a binary in the repo.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { unzipSync, strFromU8 } = require('fflate');
const { launch } = require('../helpers/chrome');
const { openApp, openZip, goToStudent, markPage, setTool, drag, score, settle, catchDownloads, idbRead } = require('../helpers/app');
const { standardFiles, extraFiles, quizFiles, zipOf } = require('../helpers/fixtures');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const CRITERIA = ['Ideas', 'Organization', 'Language'], ROSTER = ['Cleo Fixture', 'Aria Testwell', 'Dov Madeup', 'Bram Sample', 'Esme Notyet'];

const snapshotOf = page => page.evaluate(() => {
  const s = window.__gs.state(), b = s.batch;
  return { id: b.id, name: b.name, setup: { mode: s.setup.mode, criteria: s.setup.criteria, outOf: s.setup.outOf }, students: b.students.map(st => ({
    key: st.key, grade: st.grade, computed: window.__gs.gradeOf(st), inc: st.inc, layout: st.layout,
    files: st.files.map(f => ({ path: f.path, kind: f.kind, marks: f.marks, rot: f.rot || null, added: !!f.added, edited: !!f.edited })),
  })) };
});

async function main() {
  const [oldHtml, name = 'legacy-v1'] = process.argv.slice(2);
  if (!oldHtml) throw new Error('Give the path to the old index.html');
  const browser = await launch();
  const { page, close } = await openApp(browser, { html: fs.readFileSync(oldHtml, 'utf8') });
  const dl = await catchDownloads(page);
  await page.evaluate(CRITERIA => { const s = JSON.parse(localStorage.getItem('gs.setup') || '{}'); s.criteria = CRITERIA; localStorage.setItem('gs.setup', JSON.stringify(s)); localStorage.setItem('gs.bank', JSON.stringify(['Check your citations.'])); }, CRITERIA);
  await page.reload(); await page.waitForFunction(() => window.__gs && window.__gs.state);

  // First download: rubric scoring, every kind of mark, a turned page, a left-out file, a late file, a reading, a Word edit.
  await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
  await page.evaluate(() => window.__gs.scanAll());
  await markPage(page, 0);
  await score(page, [3.5, 3.5, 3.5]);
  await page.type('#cmtIn', 'Strong ideas. Watch your commas.');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-rot="1"]')][1]; b.click(); });
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.rot && f.rot[1]; });
  await page.waitForFunction(() => { const p = window.__gs.state().pages[1]; return p.W > 700 && p.s > 0; });
  await setTool(page, 'pen'); await drag(page, 1, [[500, 120], [560, 150], [620, 120]]);
  await settle(page);

  await goToStudent(page, 1);
  await score(page, [4]);
  await page.evaluate(() => document.querySelector('[data-inout="1"]').click());
  await page.waitForFunction(() => { const st = window.__gs.state().batch.students[1]; return Object.keys(st.inc || {}).length > 0; }).catch(() => {});
  await settle(page);

  await goToStudent(page, 2);
  await page.type('#cmtIn', 'The grade on the paper stands.');
  await settle(page);

  await goToStudent(page, 3);
  const extras = await extraFiles();
  const asFile = (nm, u) => [nm, Buffer.from(u).toString('base64')];
  await page.evaluate(async (late, reading) => {
    const file = ([n, b]) => new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], n, { type: 'application/pdf' });
    const G = window.__gs, st = G.state().batch.students[3];
    await G.addFiles(st, [{ path: late[0], file: file(late) }], true);
    await G.addRefs([file(reading)]);
  }, asFile('Late page.pdf', extras['Late page.pdf']), asFile('Reading.pdf', extras['Reading.pdf']));
  await page.type('#cmtIn', 'Late page added.');
  await settle(page);
  // A Word edit, written as keepEdit writes it: { data, orig, t } under "<download id>|<path>".
  const files = await standardFiles();
  await page.evaluate(async (edited, orig) => {
    const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), id = window.__gs.state().batch.id;
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise((res, rej) => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ data: bytes(edited), orig: bytes(orig), t: 1788000000000 }, id + '|Dov Madeup/Essay.docx'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, Buffer.from(extras['Essay edited.docx']).toString('base64'), Buffer.from(files['Dov Madeup/Essay.docx']).toString('base64'));
  await goToStudent(page, 0);
  const river = await snapshotOf(page);

  // Second download: plain points out of 20.
  await page.click('#closeBtn');
  await page.waitForFunction(() => !document.querySelector('#start').hidden);
  await openZip(page, zipOf(await quizFiles()), 'Quiz.zip');
  await page.evaluate(() => { const s = window.__gs.state().setup; s.mode = 'points'; s.outOf = 20; s.scale = null; });
  await goToStudent(page, 1); await goToStudent(page, 0);
  await page.waitForSelector('#ptsIn');
  await page.type('#ptsIn', '17');
  await settle(page);
  const quiz = await snapshotOf(page);
  await page.click('#closeBtn');
  await page.waitForFunction(() => !document.querySelector('#start').hidden);

  // Units and rosters, in the shape the Classes screen keeps them.
  await page.evaluate((ROSTER, id) => {
    const l = JSON.parse(localStorage.getItem('gs.lib')), c = l.classes[0];
    c.names = ROSTER; c.units.push({ id: 'unit0001', name: 'River unit', items: [{ id: 'asgn0001', name: 'River essay', classId: c.id, batchId: id, opened: 1788000000000 }] });
    localStorage.setItem('gs.lib', JSON.stringify(l));
  }, ROSTER, river.id);
  await page.reload(); await page.waitForFunction(() => window.__gs && window.__gs.state);
  await page.waitForFunction(() => window.__gs.kept().size === 2);

  const backup = await dl.next(() => page.click('#backupBtn'));
  const un = unzipSync(backup.bytes);
  const json = strFromU8(un['backup.json']), known = new Map();
  for (const [k, v] of Object.entries({ ...files, ...extras, ...await quizFiles() })) known.set(sha(v), k);
  const bins = Object.keys(un).filter(k => k.startsWith('bin/')).sort((a, b) => a.slice(4) - b.slice(4)).map(k => {
    const h = sha(un[k]); if (!known.has(h)) throw new Error('Not a generated file: ' + k + ' (' + un[k].length + ' bytes)');
    return { entry: k, file: known.get(h), sha256: h };
  });
  const ls = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  const stores = {};
  for (const [db, list] of [['grading-studio-keep', ['papers', 'work', 'meta', 'edits']], ['grading-studio-added', ['files']]]) for (const n of list) stores[db + '/' + n] = (await idbRead(page, db, n)).k.length;

  const out = path.join(__dirname, '..', 'fixtures', name);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'backup.json'), json);
  fs.writeFileSync(path.join(out, 'bins.json'), JSON.stringify(bins, null, 1));
  fs.writeFileSync(path.join(out, 'localstorage.json'), JSON.stringify(ls, null, 1));
  fs.writeFileSync(path.join(out, 'expected.json'), JSON.stringify({ river, quiz, roster: ROSTER, stores, capturedFrom: path.basename(path.dirname(oldHtml)), errors: page.errors }, null, 1));
  console.log('Wrote', out, '| bins', bins.length, '| stores', JSON.stringify(stores), '| page errors', page.errors.length);
  if (page.errors.length) console.log(page.errors.join('\n'));
  await dl.close(); await close(); await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
