// The linked folder's plain copies: Papers/<class>/<assignment>/<the student's own files>, and Videos/ with each video file as it is.
// Made-up students only. The folder is one from the browser's private file system (see helpers/carry.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openOwn, closeOwn, openZip, settle } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { linkFolder, folderWait } = require('./helpers/carry');

let zip;
before(async () => { zip = zipOf(await standardFiles()); });
after(closeOwn);

// Every file under a folder of the linked folder, as 'a/b/c.pdf' -> size.
const tree = (page, top) => page.evaluate(async top => {
  const out = {};
  const walk = async (d, at) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, at + n + '/'); else out[at + n] = (await h.getFile()).size; } };
  try { await walk(await window.__gs.folderState().root.getDirectoryHandle(top), ''); } catch {}
  return out;
}, top);
const until = async (page, fn, what) => { for (let i = 0; i < 200; i++) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); } assert.fail('waited for ' + what); };

test('papers are copied under their plain names by class and assignment, healed when deleted, and gone when the download is forgotten', async () => {
  const { page, close } = await openOwn();
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Plain');
  await settle(page); await folderWait(page);
  const t = await tree(page, 'Papers'), names = Object.keys(t).sort();
  const sizes = await page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.flatMap(s => s.files.filter(f => !f.added).map(f => [f.path, f.data.length]))));
  assert.equal(names.length, 6, names.join(', '));
  const dir = names[0].split('/').slice(0, 2).join('/');
  assert.ok(names.every(n => n.startsWith(dir + '/')), 'one class, one assignment');
  assert.ok(names.includes(dir + '/Aria Testwell/Essay.pdf') && names.includes(dir + '/Dov Madeup/Essay.docx'), names.join(', '));
  for (const [p, n] of Object.entries(sizes)) if (t[dir + '/' + p] !== undefined) assert.equal(t[dir + '/' + p], n, p);
  // deleted by hand: the next full pass puts it back
  await page.evaluate(async d => { let h = await window.__gs.folderState().root.getDirectoryHandle('Papers'); for (const p of d.split('/').concat('Aria Testwell')) h = await h.getDirectoryHandle(p); await h.removeEntry('Essay.pdf'); }, dir);
  await page.evaluate(() => window.__gs.folderReconcile()); await folderWait(page);
  assert.ok((await tree(page, 'Papers'))[dir + '/Aria Testwell/Essay.pdf'] > 0, 'healed');
  // forgotten: its copies go too
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#closeBtn'); await folderWait(page);
  await page.evaluate(i => window.__gs.forgetKept(i), id); await folderWait(page);
  assert.deepEqual(await tree(page, 'Papers'), {});
  assert.deepEqual(page.errors, []);
  await close();
});

test('a video file goes to Videos/ as it is, and comes back into an empty browser from there', async () => {
  const { page, close } = await openOwn();
  await openZip(page, zip, 'Talks.zip');
  await linkFolder(page, 'Vids');
  const vid = await page.evaluateHandle(async () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
    rec.start(); await new Promise(r => setTimeout(r, 2000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
    return new File(parts, 'Aria talk.webm', { type: 'video/webm' });
  });
  const size = await page.evaluate(v => v.size, vid);
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[0], { file: v, name: 'Presentation video', kind: '' }); }, vid);
  await settle(page); await folderWait(page);
  const t = await until(page, async () => { const x = await tree(page, 'Videos'); return Object.keys(x).length && x; }, 'the video in the folder');
  const [name] = Object.keys(t);
  assert.match(name, /^Aria talk \[[\w-]+\]\.webm$/);
  assert.equal(t[name], size);
  // the browser loses its videos: linking again brings the file back in
  await page.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos', 1); r.onsuccess = () => { const tx = r.result.transaction('v', 'readwrite'); tx.objectStore('v').clear(); tx.oncomplete = () => { r.result.close(); res(); }; }; }));
  await page.evaluate(() => window.__gs.folderReconcile()); await folderWait(page);
  const back = await until(page, () => page.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos', 1); r.onsuccess = () => { const q = r.result.transaction('v').objectStore('v').getAll(); q.onsuccess = () => { r.result.close(); res(q.result.length ? q.result[0].size : 0); }; }; })), 'the video back in the browser');
  assert.equal(back, size);
  assert.deepEqual(page.errors, []);
  await close();
});
