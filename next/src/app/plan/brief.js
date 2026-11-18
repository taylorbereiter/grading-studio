// The lesson as one message for the teacher's assistant, and the .zip it sends back, read as the current Planner reads them
// (src/planner/review.js sendToClaude, lessonZipAsk, lessonContext; src/planner/finished.js lessonZip, lessonBack). See plan/assistant.jsx.
import { engine } from '../../planning/engine.js';

export const copy = x => JSON.parse(JSON.stringify(x));
export const same = (a, b) => JSON.stringify(a && { l: a.layout, t: a.title, b: a.body, z: a.size, n: a.notes, x: [a.tag, a.foot, a.h1, a.h2, a.body2, a.cite, a.word, a.pos] }) ===
  JSON.stringify(b && { l: b.layout, t: b.title, b: b.body, z: b.size, n: b.notes, x: [b.tag, b.foot, b.h1, b.h2, b.body2, b.cite, b.word, b.pos] });

// The message, as the current Planner writes it. English, as the assistant reads it; nothing about a student is in a lesson.
export async function briefFor(p, l) {
  const E = engine(p), c = copy(l);
  const asks = c.slides.filter(s => (s.ask || '').trim()).length, talks = c.slides.filter(s => (s.talk || []).some(x => x.by === 'you' && !x.done)).length;
  return 'Here is a lesson from my Planner. Everything you need is in this message. Don\'t look for, open or ask for any folder or file on my computer.\n\n' +
    (asks ? asks + ' slide' + (asks === 1 ? ' has' : 's have') + ' a "What I want on this slide" note. ' : '') + (talks ? talks + ' slide' + (talks === 1 ? ' has' : 's have') + ' comments from me. ' : '') +
    'Build the lesson out from my outline and those notes. Keep my wording where I wrote it. Slide 1 stays the title slide' + (E.deckAgenda() ? ' and slide 2 the agenda' : '') + ', and slide text stays ' + E.deckSizeSay() + ' pt; keep my simple bullet style.\n\n' +
    E.lessonZipAsk() + '\n\n' + await E.lessonContext(c) + E.lessonText(c);
}

// The .zip read: { lesson (as it would be kept), files: [{ name, bytes }], big: [names], none }.
export async function readZip(p, l, file) {
  const E = engine(p), fflate = await import('fflate');
  const z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(z).filter(n => !n.endsWith('/') && !E.ZIP_SKIP(n) && z[n].length);
  let man = {}; const mf = names.find(n => E.baseName(n).toLowerCase() === 'lesson.json');
  if (mf) { try { man = JSON.parse(fflate.strFromU8(z[mf])) || {}; } catch { } }
  const files = names.filter(n => n !== mf), byBase = b => files.find(n => E.baseName(n).toLowerCase() === E.baseName(b || '').toLowerCase());
  const back = man.lesson && Array.isArray(man.lesson.slides) && man.lesson.slides.length ? man.lesson : null;
  let mats = Array.isArray(man.materials) ? [...(back && man.preview ? [man.preview] : []), ...man.materials].map(byBase).filter(Boolean) : files;
  mats = mats.filter((n, i) => mats.indexOf(n) === i);
  const big = mats.filter(n => z[n].length > E.MAX_FILE).map(E.baseName); mats = mats.filter(n => z[n].length <= E.MAX_FILE);   // not-words
  let next = null;
  if (back) { next = copy(l); E.lessonBack(next, back); }
  return { lesson: next, files: mats.map(n => ({ name: E.baseName(n), bytes: z[n] })), big, none: !back && !mats.length };
}

