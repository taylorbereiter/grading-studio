// What a class's tabs read: the gradebook's columns (students/book.js readBook, the current app's bkLoad) read once and read again
// after every save on the students' side, so a change made here, in another window or in the current app shows.
import { useState, useEffect } from 'preact/hooks';
import { readBook, classCols, classIn, conf, termNow, fullLibrary } from '../../students/book.js';
import { onSaved } from '../../shared/saved.js';
import * as tabs from '../../shared/tabs.js';
import { engine as B } from '../../students/book.js';
import { use } from '../../engines/gcore.js';
import { getLocale } from '../../i18n/t.js';
// Dates the gradebook writes (bkDay: columns, charts, goals, missing work) in the app's language from the first page, not only once
// a paper has been opened (app/engine-lines.js does the same for the marking screens; audit H-028).
use({ LANG_LOCALE: getLocale() === 'en' ? undefined : getLocale() });

export function useBook() {
  const [v, set] = useState(null);
  useEffect(() => {
    let live = true, tok = 0;
    const read = () => { const k = ++tok; readBook().then(b => { if (live && k === tok) set(b); }, e => { console.error(e); if (live) set({ error: true }); }); };
    read();
    const off = onSaved(e => { if (e.side === 'students' && (e.kind === 'library' || e.kind === 'work')) read(); });
    // another window: its library, and marks it saved in a download (src/saving.js gsc.saved.*, audit H-063)
    const offs = [tabs.on('library', k => { if (k === 'gs.lib') read(); }), tabs.on('saved', read)];
    return () => { live = false; off(); offs.forEach(f => f()); };
  }, []);
  return v;
}
// One class's part of the book: the class as saved, its columns (each with its cells and term), the terms, and the term now.
export function classBook(b, id) {
  if (!b || b.error) return null;
  const c = classIn(b.lib, id); if (!c) return null;
  return { c, lib: b.lib, cols: classCols(b.lib, c, b.cols), conf: B.ibConf(c, conf(b.lib)), now: termNow(b.lib), way: B.classWay(c) };   // a DP class can weigh its components its own way (src/ib.js ibConf)
}
export { fullLibrary };
// Scores waiting to be imported into a class just made from a Google Classroom file (class/classroom.jsx): its Grades tab opens
// Import a gradebook with them.
export const handoff = { rows: null, cls: '' };
// The test seam (next/test/browser/class-book.test.js): the same table of terms and scores is run through main's functions and these.
if (typeof window !== 'undefined') window.__class = { readBook, B };
