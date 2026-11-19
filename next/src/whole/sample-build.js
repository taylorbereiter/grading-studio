// The new app's own sample builder (src/sample.js sampleBuild, sampleKit): what fills the sample is the same src/sample-data.js the
// current app uses (sample.js beside the pages), run here with the new app's own parts handed to it, so both apps make the same sample
// and mark it made with the same stamp (gs.sampleBuilt). Every paper goes in through the marking screen's own opening (mark/open.js
// bringIn) and every save through students/write.js and planning/write.js, with nothing on screen. Everything in it is invented.
import { use, state, gradeOf, totalInk, COLORS, HL } from '../engines/gcore.js';
import { scoreStampText } from '../engines/gmark.js';
import { groupSync } from '../engines/ggroup.js';
import { quizSet } from '../engines/gquiz.js';
import { seatRoom } from '../engines/gbook.js';
import { uid } from '../engines/gmedia.js';
import { library } from '../students/index.js';
import { saveLibrary, migrateLib } from '../students/write.js';
import { savePref, takePlan } from '../planning/write.js';
import { setText } from '../shared/ls.js';
import { start as lockStart } from '../shared/lock.js';
import { startMarking, changedNow, saveNowDone } from '../app/mark/marking.js';
import { bringIn, findIn } from '../app/mark/open.js';
import { libs } from '../app/mark/paper.js';
import { setOpenWork } from '../app/openwork.js';
import { PARTS } from '../app/router.js';

// sample.js, beside the previous version's pages (classic/, beside this page at the root).
function sampleData() {
  if (window.__gsSampleData) return Promise.resolve(window.__gsSampleData);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'classic/sample.js?' + Date.now();
    s.onload = () => window.__gsSampleData ? res(window.__gsSampleData) : rej(new Error('sample.js held nothing'));
    s.onerror = () => rej(new Error('sample.js could not be fetched'));
    document.head.appendChild(s);
  });
}
// The Planner's records as the builder writes them (one transaction of lessons and kv), put in through planning/write.js takePlan.
function planShim() {
  const put = [], keys = [];
  const tx = { error: null, objectStore: n => ({ put: (v, k) => { if (n === 'lessons') put.push(v); else keys.push([k, v]); } }) };
  Object.defineProperty(tx, 'oncomplete', { set(f) { Promise.resolve().then(() => takePlan({ put, keys })).then(() => f(), e => { tx.error = e; if (tx.onerror) tx.onerror(); }); } });
  return { transaction: () => tx, close() {} };
}

export async function buildHere(say = () => {}) {
  await lockStart();   // only the window that writes may fill it
  const D = await sampleData();
  await libs();
  const [pl, ex] = await Promise.all([PARTS.pdflib(), PARTS.exsave()]);
  use({ PDFLib: pl });
  startMarking({});
  const L = migrateLib(library.json(null) || { classes: [], loose: { id: '', units: [] } });
  let saving = Promise.resolve();
  const saveLib = () => { const copy = JSON.parse(JSON.stringify(L)); saving = saving.then(() => saveLibrary(l => { for (const k of Object.keys(l)) delete l[k]; Object.assign(l, copy); })); return saving; };
  const kit = {
    say, uid, tr: s => s,
    store: { set: (k, v) => savePref(k, v), get: () => null },
    get lib() { return L; }, saveLib,
    get batch() { return state().batch; },
    async intake(files, label, card) {
      await saveLib();
      await bringIn(files, { label, assignment: card });
      // opening links the card to its papers (batchId), as the current page's intake does to the same library object
      const now = library.json(null), f = now && findIn(now, card.id), mine = findIn(L, card.id);
      if (f && mine) { mine.batchId = f.batchId; mine.opened = f.opened; if (f.setup) mine.setup = f.setup; }
    },
    papersKept: async () => {},
    saveNow: async () => { changedNow(); await saveNowDone(); },
    settle: async () => { await saveNowDone(); await saving; },
    closeDownload: () => { use({ batch: null }); setOpenWork(null); },
    groupSync, quizSet, gradeOf, scoreStampText, totalInk, seatRoom,
    example: (st, o) => ex.examplePaper(st, o),
    planDb: async () => planShim(),
    PDFLib: pl, COLORS, HL, CHECK_INK: () => state().CHECK_INK,
  };
  await D.build(kit);
  await saveLib();
  setText('gs.sampleBuilt', JSON.stringify(D.api));
}
