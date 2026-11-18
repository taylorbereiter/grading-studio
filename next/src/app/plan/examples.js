// Strong examples on slides, by reference. A slide that shows one keeps img.src = 'gsex:<example id>|<page>' and nothing of the
// picture: the picture stays in the grading side's examples database (src/examples.js) and is drawn from there each time
// (crossings.js examplePictureForSlide). So the lesson's file in the Planner folder, the message for the assistant, the .pptx and a
// shared lesson carry only the reference, and show no picture. The current Planner draws such a slide with an empty picture
// (src/planner/lessons.js imgSrc gives '' for it) and writes the reference on unchanged. next/docs/saved-work.md has the shape.
import { examplePictureForSlide } from '../../crossings.js';

export const isExample = src => typeof src === 'string' && src.startsWith('gsex:');
export const exampleRef = (id, page) => 'gsex:' + id + '|' + (+page || 0);
const parse = src => { const m = /^gsex:([^|]+)\|(\d+)$/.exec(src || ''); return m ? { id: m[1], page: +m[2] } : null; };

const urls = new Map(), waiting = new Map();
// The picture's blob: address when it is loaded (null while loading, '' when the example is gone), and a promise for it.
export function exampleUrl(src) { return urls.has(src) ? urls.get(src) : null; }
export function loadExample(src) {
  if (urls.has(src)) return Promise.resolve(urls.get(src));
  if (waiting.has(src)) return waiting.get(src);
  const r = parse(src);
  const p = (r ? examplePictureForSlide(r.id, r.page) : Promise.resolve(null)).then(b => b ? URL.createObjectURL(b) : '', () => '')
    .then(u => { urls.set(src, u); waiting.delete(src); return u; });
  waiting.set(src, p); return p;
}
// Its size, for a slide's img.w and img.h.
export async function exampleSize(src) {
  const u = await loadExample(src); if (!u) return { w: 0, h: 0 };
  return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = u; });
}
