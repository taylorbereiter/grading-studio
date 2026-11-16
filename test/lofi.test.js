// Lo-fi music for the focus timer (src/lofi.js): tracks are written from a seed and played with Web Audio, so nothing is fetched.
// It is off until a teacher turns it on, plays only while a session's clock runs, and its settings travel with My setup.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const meFocus = page => page.evaluate(() => { const f = (window.__gs.state().lib.me || {}).focus; return f === undefined ? undefined : JSON.parse(JSON.stringify(f)); });
const playing = page => page.evaluate(() => window.__gs.lofi.on);

test('a seed always writes the same track, every mood stays in its key, and the quiet mood has no drums', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const out = await page.evaluate(() => {
    const G = window.__gs, SC = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10] }, bad = [], seen = new Set();
    for (const s of G.LOFI_STYLES) for (const seed of [1, 7, 4242, 987654321]) {
      const a = G.lofiCompose(seed, s.id), b = G.lofiCompose(seed, s.id);
      if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(s.id + ' ' + seed + ': two different tracks from one seed');
      if (a.style !== s.id) bad.push(s.id + ': wrong mood');
      const secs = a.beats * 60 / a.bpm; if (secs < 90 || secs > 240) bad.push(s.id + ' ' + seed + ': ' + Math.round(secs) + ' seconds long');
      const scale = SC[a.mode].map(x => (a.tonic + x) % 12);
      for (const e of a.ev) {
        if (!(e[0] >= 0 && e[0] < a.beats)) bad.push(s.id + ' ' + seed + ': a note outside the track');
        // the walking bass may pass through a note between two chords; everything else stays in the scale
        if ('kmp'.includes(e[1]) && !scale.includes(e[2] % 12)) bad.push(s.id + ' ' + seed + ': a note outside the key');
      }
      const drums = a.ev.filter(e => 'KSHO'.includes(e[1])).length;
      if (s.id === 'quiet' ? drums : !drums) bad.push(s.id + ' ' + seed + ': ' + drums + ' drum hits');
      for (const k of ['k', 'b', 'm']) if (!a.ev.some(e => e[1] === k)) bad.push(s.id + ' ' + seed + ': no ' + k);
      seen.add(a.bpm + ' ' + a.tonic + ' ' + a.mode + ' ' + a.keys + ' ' + a.mel);
    }
    return { bad: bad.slice(0, 8), kinds: seen.size, moods: G.LOFI_STYLES.length };
  });
  assert.deepEqual(out.bad, []);
  assert.equal(out.moods, 8);
  assert.ok(out.kinds >= 24, 'the tracks differ from each other: ' + out.kinds + ' of 32');
  await close();
});

test('a track makes sound that is neither silent nor clipped', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const r = await page.evaluate(async () => {
    const G = window.__gs, ctx = new OfflineAudioContext(2, 44100 * 30, 44100);
    G.lofiRender(ctx, G.lofiCompose(11, 'library'));
    const d = (await ctx.startRendering()).getChannelData(0); let pk = 0, sq = 0, bad = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (!(a >= 0)) bad++; if (a > pk) pk = a; sq += d[i] * d[i]; }
    return { pk, rms: Math.sqrt(sq / d.length), bad };
  });
  assert.equal(r.bad, 0);
  assert.ok(r.pk > 0.05 && r.pk < 0.99, 'peak ' + r.pk);
  assert.ok(r.rms > 0.01 && r.rms < 0.3, 'level ' + r.rms);
  await close();
});

test('music is off until it is turned on, plays only while the clock runs, and its choices are kept', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.waitForSelector('#railFocus'); await page.click('#railFocus');
  await page.waitForSelector('#fcPanel [data-fcstart]'); await page.click('#fcPanel [data-fcstart]');
  await page.waitForSelector('#fcPanel [data-fcmus]');
  assert.equal(await playing(page), false, 'nothing plays for a teacher who has not asked for music');
  assert.equal(await page.$('#fcPanel [data-fcmood]'), null);
  assert.equal((await meFocus(page) || {}).music, undefined);
  await page.click('#fcPanel [data-fcmus]'); await page.waitForSelector('#fcPanel [data-fcmood]');
  await page.waitForFunction(() => window.__gs.lofi.on && window.__gs.lofi.E.ctx.state === 'running' && window.__gs.lofi.cur);
  assert.deepEqual(await meFocus(page), { music: true }, 'only what differs from the usual is kept');
  // a mood, the next track, the volume
  await page.select('#fcPanel [data-fcmood]', 'garden');
  await page.waitForFunction(() => window.__gs.lofi.cur.tr.style === 'garden');
  const seed = await page.evaluate(() => window.__gs.lofi.seed);
  await page.click('#fcPanel [data-fcskip]');
  await page.waitForFunction(s => window.__gs.lofi.seed !== s && window.__gs.lofi.cur.tr.style === 'garden', {}, seed);
  await page.$eval('#fcPanel [data-fcvol]', e => { e.value = 0.3; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.deepEqual(await meFocus(page), { music: true, mood: 'garden', mvol: 0.3 });
  assert.equal(await page.evaluate(() => window.__gs.lofi.vol), 0.3);
  // the music stops with the clock and comes back with it
  await page.click('#fcPanel [data-fcpause]'); await page.waitForFunction(() => !window.__gs.lofi.on);
  await page.click('#fcPanel [data-fcresume]'); await page.waitForFunction(() => window.__gs.lofi.on);
  await page.click('#fcPanel [data-fcstop]'); await page.waitForFunction(() => !window.__gs.lofi.on && !window.__gs.lofi.E, {}, 'the player is put away when the session ends');
  // Settings shows the same choices, and turning it off there keeps the mood for next time
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#fcMusic');
  assert.equal(await page.$eval('#fcMusic', e => e.checked), true);
  assert.equal(await page.$eval('#fcMood', e => e.value), 'garden');
  await page.click('#fcAmb'); await page.waitForFunction(() => (window.__gs.state().lib.me.focus || {}).mamb === false);
  await page.click('#fcMusic'); await page.waitForFunction(() => !document.querySelector('#fcMood'));
  assert.deepEqual(await meFocus(page), { mood: 'garden', mvol: 0.3, mamb: false });
  await close();
});

test('My setup carries the music choices out and back in', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const r = await page.evaluate(async () => {
    const G = window.__gs, S = G.stpRead({ gradingStudioSetup: 1, focus: { music: true, musicMood: 'rain', musicVolume: 35, musicBackground: false } });
    const odd = G.stpRead({ gradingStudioSetup: 1, focus: { music: 'yes', musicMood: 'polka', musicVolume: 900 } });
    return { focus: S.focus, odd: odd.focus || null };
  });
  assert.deepEqual(r.focus, { music: true, mood: 'rain', mvol: 0.35, mamb: false });
  assert.equal(r.odd, null, 'a mood or a volume the app does not have is left out');
  await close();
});
