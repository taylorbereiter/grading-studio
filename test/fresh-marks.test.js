// A fresh download isn't marked: marks that came inside her own rubric page aren't marks on any student's paper. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, markPage, settle } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// A PDF with a highlight and a typed comment saved into it, the way Preview, Acrobat or Kami leave one.
async function withMarks(bytes) {
  const d = await PDFDocument.load(bytes), pg = d.getPage(0);
  const hl = d.context.obj({ Type: 'Annot', Subtype: 'Highlight', Rect: [60, 600, 300, 620], QuadPoints: [60, 620, 300, 620, 60, 600, 300, 600], C: [1, 1, 0], F: 4 });
  const note = d.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [400, 700, 420, 720], Contents: d.context.obj('Fill in each box'), F: 4 });
  pg.node.set(PDFName.of('Annots'), d.context.obj([d.context.register(hl), d.context.register(note)]));
  return d.save();
}
const marked = page => page.evaluate(async () => {
  const gs = window.__gs, b = gs.state().batch;
  for (let i = 0; i < 40 && !b.students.every(st => st.files.every(f => f.kind !== 'pdf' || f.kami !== undefined)); i++) await new Promise(r => setTimeout(r, 250));
  return Object.fromEntries([...document.querySelectorAll('#stuList button')].map(e => [e.textContent.replace(/^\d+/, '').trim().split(/[?+]/)[0].trim(), !!e.querySelector('.dot')]));
});

test('A rubric page with marks saved in it leaves a fresh download unmarked, and a real mark still counts', async () => {
  const rubric = await withMarks(await makePaper({ title: 'Rubric' }));
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify({ mode: 'rubric', criteria: ['A', 'B', 'C'], rubricPage: { id: 'r1', name: 'Rubric page.pdf' }, rubricPos: 'end' }), 'gs.rp.r1': JSON.stringify(Buffer.from(rubric).toString('base64')) } } });
  await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students[0].files.some(f => f.virtual)), 'the rubric page is added');
  const before = await marked(page);
  assert.equal(before['Aria Testwell'], false);
  assert.equal(before['Bram Sample'], false);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.filter(st => st.files.some(f => f.virtual && f.kami && Object.keys(f.kami).length)).length), 0, 'the rubric page’s own marks aren’t counted');

  // Marking Aria's essay makes her the only marked student, and only her files go in the export.
  await goToStudent(page, 0);
  await markPage(page, 0);
  await settle(page);
  const after = await marked(page);
  assert.equal(after['Aria Testwell'], true);
  assert.equal(after['Bram Sample'], false);
  const plan = await page.evaluate(() => window.__gs.exportPlan(true).map(x => x.st.key + '/' + x.path));
  assert.ok(!plan.some(k => /Bram Sample/.test(k)), 'Bram has nothing marked, so he is left out: ' + JSON.stringify(plan));
  await close();
});
