// One slide, drawn by the current Planner's own drawing code (engines/planner.js slideHtml) with its own stylesheet, scaled to the
// width asked for. Read only: the teacher's words in it are escaped by slideHtml and marked as hers (data-raw).
import { h } from 'preact';
import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import CSS from '../../engines/slidecss.js';
import { engine } from '../../planning/engine.js';

let put = false;
function sheet() { if (put) return; put = true; const s = document.createElement('style'); s.dataset.slides = ''; s.textContent = CSS; document.head.appendChild(s); }
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
  const E = engine(plan), k = width / 1280;
  let html = ''; try { html = slide ? E.slideHtml(slide, lesson, false) : ''; } catch (e) { console.error(e); }
  return <div class="slidebox" ref={box} style={{ width: width + 'px', height: Math.round(width * 720 / 1280) + 'px' }} role="img" aria-label={label} {...rest}>
    <div class="ls-slide" data-raw style={{ transform: 'scale(' + k + ')', transformOrigin: '0 0' }} dangerouslySetInnerHTML={{ __html: html }} />
  </div>;
}
