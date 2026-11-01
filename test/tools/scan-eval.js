// How well the scan rules do on made-up scans. Run: node test/tools/scan-eval.js [seed] [perKind] [px]
// Prints, per kind of page and in all, how many pages were turned rightly, turned wrongly, asked about or left alone.
const { launch } = require('../helpers/chrome');
const { openApp } = require('../helpers/app');
const { PAGE_SRC, tally } = require('../helpers/scans');

(async () => {
  const seed = +(process.argv[2] || 1), perKind = +(process.argv[3] || 2), px = +(process.argv[4] || 1000);
  const browser = await launch();
  try {
    const { page, close } = await openApp(browser);
    await page.evaluate(PAGE_SRC);
    const t0 = Date.now();
    const rows = await page.evaluate((seed, perKind, px) => window.gsScan.run({ seed, perKind, px }), seed, perKind, px);
    const blanks = await page.evaluate((seed, px) => window.gsScan.runBlank({ seed, px }), seed, px);
    const t = tally(rows);
    console.log('seed', seed, 'pages', rows.length, 'px', px, 'ms', Date.now() - t0);
    console.log('kind'.padEnd(24), 'pages need | right wrong ask askWrong sideAsk missed | skewNeed auto wrong ask');
    for (const [k, v] of Object.entries(t.byKind)) console.log(k.padEnd(24), String(v.pages).padStart(5), String(v.need).padStart(4), '|', String(v.autoRight).padStart(5), String(v.autoWrong).padStart(5), String(v.askRight).padStart(3), String(v.askWrong).padStart(8), String(v.sideAsk).padStart(7), String(v.missed).padStart(6), '|', String(v.skewNeed).padStart(8), String(v.skewAuto).padStart(4), String(v.skewWrong).padStart(5), String(v.skewAsk).padStart(3));
    const { byKind, wrong, skewWrong, ...sum } = t;
    console.log(JSON.stringify(sum));
    const small = r => [r.kind, 'o' + r.o, r.wear, 'skew' + r.skew.toFixed(1), 'got', r.turn, r.gotSkew, JSON.stringify(r.why, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v)].join(' ');
    if (wrong.length) console.log('WRONG TURNS\n' + wrong.map(small).join('\n'));
    if (skewWrong.length) console.log('WRONG STRAIGHTENING\n' + skewWrong.map(small).join('\n'));
    const bs = {}; for (const b of blanks) { const k = bs[b.how] ||= { n: 0, blank: 0, faint: 0 }; k.n++; if (b.blank) k.blank++; if (b.faint) k.faint++; }
    console.log('blank paper', JSON.stringify(bs));
    const notBlank = rows.filter(r => r.blank), faint = {}; for (const r of rows) { const k = faint[r.wear] ||= { n: 0, faint: 0 }; k.n++; if (r.faint) k.faint++; }
    console.log('written pages called blank:', notBlank.length, notBlank.slice(0, 5).map(r => r.kind + '/' + r.wear).join(', '));
    console.log('faint by wear', JSON.stringify(faint));
    if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, JSON.stringify(rows));
    await close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
