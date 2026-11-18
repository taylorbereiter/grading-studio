// One slide, drawn by the current Planner's own drawing code (engines/planner.js slideHtml) with its own stylesheet, scaled to the
// width asked for. Read only: the teacher's words in it are escaped by slideHtml and marked as hers (data-raw).
import { h } from 'preact';
import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import CSS from '../../engines/slidecss.js';
import { engine } from '../../planning/engine.js';
import { isExample, exampleUrl, loadExample } from './examples.js';

// The current Planner's page sets p{margin:0 0 6px}; slides drawn here need the same, or a short box like the exit ticket's tag clips.
export const SLIDE_CSS = CSS + '.ls-slide p{margin:0 0 6px}';
let put = false;
function sheet() { if (put) return; put = true; const s = document.createElement('style'); s.dataset.slides = ''; s.textContent = SLIDE_CSS; document.head.appendChild(s); }
// fill: as wide as the space it is in (up to width), measured, so the scale always matches the box.
export function Slide({ slide, lesson, plan, width = 320, label, fill, ...rest }) {
  sheet();
  const box = useRef(null), [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    if (!fill || !box.current || !box.current.parentNode) return;
    const el = box.current.parentNode, m = () => setRoom(Math.floor(el.clientWidth));
    m(); if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [fill]);
  if (fill && room) width = Math.min(width, room);
  // A strong example is drawn from the examples database, never kept in the lesson (plan/examples.js).
  const ex = slide && slide.img && isExample(slide.img.src) ? slide.img.src : '', [, redraw] = useState(0);
  useLayoutEffect(() => { if (ex && exampleUrl(ex) == null) loadExample(ex).then(() => redraw(n => n + 1)); }, [ex]);
  const shown = ex ? { ...slide, img: { ...slide.img, src: exampleUrl(ex) || '' } } : slide;
  const E = engine(plan), k = width / 1280;
  let html = ''; try { html = shown ? E.slideHtml(shown, lesson, false) : ''; } catch (e) { console.error(e); }
  return <div class="slidebox" ref={box} style={{ width: width + 'px', height: Math.round(width * 720 / 1280) + 'px' }} role="img" aria-label={label} {...rest}>
    <div class="ls-slide" data-raw style={{ transform: 'scale(' + k + ')', transformOrigin: '0 0' }} dangerouslySetInnerHTML={{ __html: html }} />
  </div>;
}
