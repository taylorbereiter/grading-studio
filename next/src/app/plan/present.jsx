// Present: the lesson's slides on the whole screen, one at a time, as the current Planner shows them (src/planner/present.js).
// Arrow keys, Page Up and Down, the space bar and a click move; Home and End go to the first and last slide; Esc ends. The browser's
// full screen is asked for when the teacher starts; a slide is drawn as large as the screen allows.
import { h } from 'preact';
import { useState, useLayoutEffect, useRef } from 'preact/hooks';
import { IconButton } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { Slide } from './slide.jsx';

export function Present({ p, l, start = 0, onClose }) {
  const [i, setI] = useState(Math.max(0, Math.min(start, l.slides.length - 1)));
  const [size, setSize] = useState(() => fit());
  const box = useRef(null), at = useRef(i); at.current = i;
  function fit() { const w = window.innerWidth, hh = window.innerHeight; return Math.floor(Math.min(w, hh * 1280 / 720)); }
  // Before the first paint, so a key pressed as soon as Present shows is not lost.
  useLayoutEffect(() => {
    const n = l.slides.length, go = d => setI(x => Math.max(0, Math.min(n - 1, x + d)));
    const key = e => {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); end(); }
      else if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); go(-1); }
      else if (k === 'Home') { e.preventDefault(); setI(0); } else if (k === 'End') { e.preventDefault(); setI(n - 1); }
    };
    const rs = () => setSize(fit());
    window.addEventListener('keydown', key, true); window.addEventListener('resize', rs);
    try { if (box.current && box.current.requestFullscreen && !document.fullscreenElement) box.current.requestFullscreen().catch(() => {}); } catch {}
    const fs = () => { if (!document.fullscreenElement) setSize(fit()); };
    document.addEventListener('fullscreenchange', fs);
    if (box.current) box.current.focus();
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', rs); document.removeEventListener('fullscreenchange', fs); };
  }, [l.id]);
  function end() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {} onClose(at.current); }
  return <div class="present" ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('plan.presenting', { title: l.title })}
    onClick={e => { if (!e.target.closest('button')) setI(x => Math.min(l.slides.length - 1, x + 1)); }}>
    <Slide slide={l.slides[i]} lesson={l} plan={p} width={size} label={t('plan.slide_of', { n: i + 1, of: l.slides.length })} />
    <div class="prbar"><span class="num">{t('plan.slide_of', { n: i + 1, of: l.slides.length })}</span>
      <IconButton icon="chl" label={t('plan.prev_slide')} onClick={() => setI(x => Math.max(0, x - 1))} />
      <IconButton icon="chr" label={t('plan.next_slide')} onClick={() => setI(x => Math.min(l.slides.length - 1, x + 1))} />
      <IconButton icon="x" label={t('plan.end_present')} onClick={end} /></div>
  </div>;
}
