// See the paper, on a phone's Scores (src/phone.js phSee): one student's paper from a download kept in this browser, read only, its
// pages as pictures down the screen, with the score at the top. Close or Esc puts it away (A-129). A file that isn't a PDF or a
// picture says it opens on a computer. Papers not kept here say so; nothing is fetched or saved.
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Sheet } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { papers } from '../../students/index.js';
import { engine as B } from '../../students/book.js';
import './lines.js';

// A kept file's bytes: whole, or put together from its pieces (a big download, "id|file|piece"), as students/write.js keeps them.
async function bytesOf(id, i, e) {
  if (e.parts == null) return e.data || null;
  const out = new Uint8Array(e.size);
  for (let n = 0, at = 0; n < e.parts; n++) { const p = await papers.get(id + '|' + i + '|' + n); if (!p) throw new Error('A piece of a kept file is missing'); out.set(p, at); at += p.length; }
  return out;
}
export function PhSee({ col, c, n, score, onClose }) {
  const body = useRef(null), [say, setSay] = useState(t('class.ph_getting'));
  useEffect(() => {
    let live = true; const urls = [];
    (async () => {
      const d = col.d || {}, key = B.rosterPairs(c.names, Object.keys({ ...(d.s || {}), ...(d.read || {}) })).get(n) || n;
      const rec = await papers.get(col.dl);
      const mine = rec && Array.isArray(rec.entries) ? rec.entries.map((e, i) => [e, i]).filter(([e]) => e && (e.path.split('/')[0] === key || e.path.replace(/\.[^.]+$/, '') === key)) : [];
      if (!live) return;
      if (!mine.length) return setSay(t(rec ? 'class.ph_nopaper' : 'class.ph_notkept'));
      setSay('');
      let pdfjs = null;
      for (const [e, i] of mine) {
        const data = await bytesOf(col.dl, i, e), ext = (e.path.match(/\.([^./]+)$/) || [, ''])[1].toLowerCase(), el = body.current;
        if (!live || !el || !data) return;
        if (ext === 'pdf') {
          if (!pdfjs) pdfjs = (await PARTS.pdf()).pdfjs();
          const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
          for (let p = 1; p <= doc.numPages; p++) {
            const pg = await doc.getPage(p), w = el.clientWidth || 360, k = w / pg.getViewport({ scale: 1 }).width * Math.min(2, devicePixelRatio || 1), vp = pg.getViewport({ scale: k });
            const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.className = 'phvpage'; cv.setAttribute('aria-label', t('class.ph_page', { n: p }));
            await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            if (!live) { doc.destroy(); return; } el.appendChild(cv);
          }
          doc.destroy();
        } else if (/^(png|jpe?g|gif|webp)$/.test(ext)) {
          const img = document.createElement('img'), u = URL.createObjectURL(new Blob([data])); urls.push(u); img.className = 'phvpage'; img.alt = e.path.split('/').pop(); img.src = u; el.appendChild(img);
        } else { const p = document.createElement('p'); p.className = 'mute'; p.textContent = t('class.ph_elsewhere', { name: e.path.split('/').pop() }); el.appendChild(p); }
      }
    })().catch(e => { console.error(e); if (live) setSay(t('class.ph_cant')); });
    return () => { live = false; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, []);
  return <Sheet open wide title={score ? t('class.ph_see_t', { name: n, score }) : n} onClose={onClose}>
    <div class="phvbody" data-phview={n}>{say && <p class="mute" data-phsay>{say}</p>}<div ref={body} /></div>
  </Sheet>;
}
