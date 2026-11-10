// npm run speed: how fast the three things a teacher feels are, measured in the real built app.
//
//   Pen          from a move of the pointer to red ink on the page under it
//   Next student from asking for the next paper to its first page being drawn
//   30 papers    from picking a ZIP of 30 students' papers to the first one being drawn
//
// Each is measured several times and the middle value is reported beside its target. The targets are what the app is
// being built towards (ink within one frame, the next student in under 150 ms, a class of 30 in under 3 seconds).
// A run fails only past the ceiling, which is set well above today's numbers so that a slow computer doesn't fail it
// and a change that makes the app several times slower does. --strict fails past the targets instead.
// The numbers go to out/speed.json too. Made-up students only.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { openApp, openZip, goToStudent, setTool, toScreen, pickFile, waitPaper } = require('../helpers/app');
const { makePaper, zipOf } = require('../helpers/fixtures');

const LIMITS = {
  pen: { say: 'Pen: pointer move to ink on the page', unit: 'ms', target: 16.7, ceiling: 50 },
  penWork: { say: 'Pen: the app’s own work per move', unit: 'ms', target: 4, ceiling: 16.7 },
  next: { say: 'Next student: to the first page drawn', unit: 'ms', target: 150, ceiling: 900 },
  open30: { say: 'Opening 30 papers: to the first one drawn', unit: 'ms', target: 3000, ceiling: 12000 },
  load: { say: 'Opening the app: to Home ready', unit: 'ms', target: 1000, ceiling: 6000 },
};
const mid = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const p95 = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * .95))] : NaN; };

// The pen. A listener ahead of the app's own notes when each move arrives, one after it notes when the app is done with it,
// and a look at the page under the pointer says whether the ink is there yet, or how many frames later it comes.
async function pen(page) {
  await setTool(page, 'pen');
  await page.evaluate(() => {
    const S = window.__speed = { rows: [], on: false };
    let t0 = 0;
    const inked = (x, y) => {
      const pg = window.__gs.state().pages[0], c = pg.canvas, r = c.getBoundingClientRect(), q = c.width / r.width;
      const px = Math.round((x - r.left) * q), py = Math.round((y - r.top) * q), d = c.getContext('2d', { willReadFrequently: true }).getImageData(px - 3, py - 3, 7, 7).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 110) return true;
      return false;
    };
    window.addEventListener('pointermove', e => { if (S.on) t0 = performance.now(); }, true);
    window.addEventListener('pointermove', e => {
      if (!S.on) return;
      const t1 = performance.now(), row = { work: t1 - t0, wait: Math.max(0, t0 - e.timeStamp), ink: null, frames: 0 }, x = e.clientX, y = e.clientY;
      S.rows.push(row);
      const look = () => { if (inked(x, y)) row.ink = performance.now() - t0; else if (row.frames < 6) { row.frames++; requestAnimationFrame(look); } };
      look();
    }, false);
  });
  const from = await toScreen(page, 0, 120, 200);
  for (let stroke = 0; stroke < 6; stroke++) {
    const y = from.y + stroke * 34;
    await page.mouse.move(from.x, y); await page.mouse.down();
    await page.evaluate(() => { window.__speed.on = true; });
    for (let i = 1; i <= 40; i++) await page.mouse.move(from.x + i * 7, y + Math.sin(i / 3) * 9);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { window.__speed.on = false; r(); }))));
    await page.mouse.up();
  }
  const rows = await page.evaluate(() => window.__speed.rows), seen = rows.filter(r => r.ink != null);
  await setTool(page, 'select');
  return { moves: rows.length, inked: seen.length, pen: mid(seen.map(r => r.ink)), pen95: p95(seen.map(r => r.ink)), penWork: mid(rows.map(r => r.work)), penWork95: p95(rows.map(r => r.work)), sameFrame: seen.length ? seen.filter(r => r.frames === 0).length / seen.length : 0 };
}
// The next student: timed inside the page, from the call to the first page having its picture.
const nextOnce = (page, i) => page.evaluate(i => new Promise(res => {
  const t0 = performance.now(), G = window.__gs;
  G.openStudent(i);
  const look = () => { const s = G.state(); if (s.cur === i && s.pages.length && s.pages[0].s > 0 && s.pages[0].bmp) res(performance.now() - t0); else requestAnimationFrame(look); };
  look();
}), i);

(async () => {
  const strict = process.argv.includes('--strict'), t00 = Date.now();
  const names = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example', 'Gus Invented', 'Hana Pretend', 'Ivo Notreal', 'Juno Stand-in'];
  const files = {};
  for (let i = 0; i < 30; i++) { const n = names[i % 10] + (i < 10 ? '' : ' ' + (Math.floor(i / 10) + 1)); files[n + '/Essay.pdf'] = await makePaper({ title: n + ' essay', pages: 2 }); }
  const zip = zipOf(files), browser = await launch(), got = {};
  try {
    const loads = [], opens = [];
    for (let k = 0; k < 3; k++) {
      const t0 = Date.now(), { page, close } = await openApp(browser);
      loads.push(Date.now() - t0);
      await page.setViewport({ width: 1366, height: 768 });
      const t1 = Date.now(), clean = await pickFile(page, '#fileIn', zip, 'Thirty papers.zip');
      await waitPaper(page); opens.push(Date.now() - t1); clean();
      if (k === 2) {
        Object.assign(got, await pen(page));
        const ns = [];
        for (let r = 0; r < 3; r++) for (let i = 1; i <= 6; i++) ns.push(await nextOnce(page, i));
        await goToStudent(page, 0);
        got.next = mid(ns); got.next95 = p95(ns);
      }
      await close();
    }
    got.load = mid(loads); got.open30 = mid(opens);
  } finally { await browser.close(); }
  let failed = false, report = 'Speed, in the built app (' + ((Date.now() - t00) / 1000).toFixed(0) + ' s to measure)\n\n' + 'What'.padEnd(46) + 'Now'.padStart(9) + 'Target'.padStart(9) + 'Ceiling'.padStart(9) + '\n';
  for (const [k, L] of Object.entries(LIMITS)) {
    const v = got[k], over = !(v <= (strict ? L.target : L.ceiling));
    if (over) failed = true;
    report += L.say.padEnd(46) + (v.toFixed(v < 20 ? 1 : 0) + ' ' + L.unit).padStart(9) + (L.target + ' ' + L.unit).padStart(9) + (L.ceiling + ' ' + L.unit).padStart(9) + (over ? '   OVER' : v <= L.target ? '   meets the target' : '') + '\n';
  }
  report += '\nPen: ' + got.inked + ' of ' + got.moves + ' moves checked, ink in the same frame for ' + Math.round(got.sameFrame * 100) + '%; slowest 1 in 20: ' + got.pen95.toFixed(1) + ' ms to ink, ' + got.penWork95.toFixed(1) + ' ms of work.\nNext student, slowest 1 in 20: ' + got.next95.toFixed(0) + ' ms.';
  if (!got.inked) { failed = true; report += '\nNo ink was seen under the pointer, so the pen was not measured.'; }
  console.log(report);
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'speed.json'), JSON.stringify(got, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Speed\n```\n' + report + '\n```\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
