// The lesson editor (design screenshot 13): the slides down the side, the slide as it will show in the middle, and its words beside
// it. Every box is a plain text box (long ones can be dictated), and the slide is drawn by the current Planner's own code as she types.
// Text that runs past its box is marked, as the current Planner marks it, with one way out: move the extra lines to a new slide. Text
// is never made smaller to fit (slides stay 28 to 36 pt unless her timetable says any size).
//
// Changes are kept in the lesson's own fields as the current Planner keeps them (src/planner/lessons.js normSlide: layout, title,
// body, size, notes, talk, and the layout's extra boxes), and saved 400 ms after the last key, as the current Planner does.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import * as undo from '../../services/undo.js';
import { Button, IconButton, Icon, Select, TextInput, Menu, Checkbox } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import { register } from '../../services/shortcuts.js';
import { engine } from '../../planning/engine.js';
import { Slide } from '../plan/slide.jsx';
import { ExamplePicker } from '../plan/example-pick.jsx';
import { Talk } from '../plan/talk.jsx';
import { isExample, exampleSize } from '../plan/examples.js';
import '../plan/lines.js';

const PIC = ['picture', 'fullpic', 'textpic', 'picprompt'];
// A picture from this computer, made small enough to keep in a lesson as the current Planner does (src/planner/lessons.js shrinkPic):
// 1600 px is plenty for a slide.
async function shrinkPic(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
function PictureField({ s, setSlide }) {
  const [picking, setPicking] = useState(false);
  const file = async e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (!f) return; try { setSlide({ img: { ...(await shrinkPic(f)), source: s.img ? s.img.source : '' } }, true); } catch { } };
  const ex = s.img && isExample(s.img.src);
  return <div class="picfield"><span class="lab">{t('plan.picture')}</span>
    {ex && <p class="mute">{t('plan.example_ref')}</p>}
    <div class="row"><label class="btn sm"><Icon name="upload" />{s.img ? t('plan.replace_picture') : t('plan.choose_picture')}<input type="file" accept="image/*" class="vh" onChange={file} /></label>
      <Button size="sm" icon="image" onClick={() => setPicking(true)} data-focus="add-example">{t('plan.add_example')}</Button>
      {s.img && <Button size="sm" variant="quiet" icon="trash" onClick={() => setSlide({ img: undefined }, true)}>{t('plan.remove_picture')}</Button>}</div>
    {s.img && !ex && <TextInput label={t('plan.picture_source')} value={s.img.source || ''} onInput={v => setSlide({ img: { ...s.img, source: v.replace(/\n+/g, ' ') } })} />}
    <ExamplePicker open={picking} onClose={() => setPicking(false)} onPick={async ref => { setPicking(false); const z = await exampleSize(ref); setSlide({ img: { src: ref, w: z.w, h: z.h, source: '' } }, true); }} />
  </div>;
}

// The boxes each layout has beyond its title and text (src/planner/looks.js teachBoxes).
const MORE = { warmup: ['tag'], exit: ['tag'], steps: ['foot'], discuss: ['foot'], twocol: ['h1', 'h2', 'body2'], passage: ['cite', 'foot'], vocab: ['word', 'pos', 'foot'] };
// Every line named in full (next/test/lines.test.js).
const LAYOUT_LINE = { title: 'plan.layout_title', agenda: 'plan.layout_agenda', objectives: 'plan.layout_objectives', warmup: 'plan.layout_warmup', exit: 'plan.layout_exit', steps: 'plan.layout_steps', discuss: 'plan.layout_discuss', content: 'plan.layout_content', twocol: 'plan.layout_twocol', text: 'plan.layout_text', passage: 'plan.layout_passage', vocab: 'plan.layout_vocab', picture: 'plan.layout_picture', fullpic: 'plan.layout_fullpic', textpic: 'plan.layout_textpic', picprompt: 'plan.layout_picprompt', video: 'plan.layout_video' };
const BOX_LINE = { tag: 'plan.box_tag', foot: 'plan.box_foot', h1: 'plan.box_h1', h2: 'plan.box_h2', body2: 'plan.box_body2', cite: 'plan.box_cite', word: 'plan.box_word', pos: 'plan.box_pos' };
const NO_BODY = ['picture', 'fullpic', 'video'];
const copy = x => JSON.parse(JSON.stringify(x));

export default function Editor({ p, l, cur, setCur, save, ai }) {
  const E = engine(p);
  const [d, setD] = useState(() => copy(l)), timer = useRef(0), last = useRef(l.updated), stage = useRef(null);
  const [over, setOver] = useState(false);
  // Another window saved this lesson while it is open here: take it, unless she is typing.
  useEffect(() => { if (l.updated !== last.current && !timer.current) { setD(copy(l)); last.current = l.updated; } }, [l.updated]);
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); save(dRef.current); } }, []);
  const dRef = useRef(d); dRef.current = d;
  // Each change is one step back with Ctrl+Z (src/planner/lessons.js slide editing undo); typing in one box is one step.
  const put = (next, now, group) => {
    const before = dRef.current;
    if (JSON.stringify(before.slides) !== JSON.stringify(next.slides)) undo.record({ label: t('plan.slide_change'), group, undo: () => keep(copy(before)), redo: () => keep(copy(next)) });
    keep(next, now);
  };
  const keep = (next, now) => {
    setD(next); clearTimeout(timer.current);
    const go = async () => { timer.current = 0; const s = await save(next); if (s) last.current = s.updated; };
    if (now) go(); else timer.current = setTimeout(go, 400);
  };
  const n = d.slides.length, i = Math.max(0, Math.min(cur, n - 1)), s = d.slides[i];
  const setSlide = (patch, now) => { const next = copy(d); next.slides[i] = { ...next.slides[i], ...patch }; for (const k in patch) if (patch[k] === undefined) delete next.slides[i][k]; put(next, now, 'slide:' + (next.slides[i].id || i) + ':' + Object.keys(patch).join(',')); };
  const at = (k, j) => { const next = copy(d); k(next.slides, next); put(next, true); if (typeof j === 'number') setCur(j); };
  const add = () => at(sl => sl.splice(i + 1, 0, E.normSlide({ layout: E.deckAdd(), fmt: 2 })), i + 1);
  const dup = () => at(sl => sl.splice(i + 1, 0, { ...copy(sl[i]), id: E.lid(), talk: [] }), i + 1);
  const del = () => n > 1 && at(sl => sl.splice(i, 1), Math.max(0, i - 1));
  const move = k => { const j = i + k; if (j < 0 || j >= n) return; at(sl => { const [x] = sl.splice(i, 1); sl.splice(j, 0, x); }, j); };
  // The extra lines of a slide's text go to a new slide after it (src/planner/lessons.js splitOverflow).
  const split = () => {
    const box = stage.current && stage.current.querySelector('.ls-body'); if (!box) return;
    const items = [...box.querySelectorAll('.rt')], lim = box.getBoundingClientRect().bottom;
    let k = items.findIndex(it => it.getBoundingClientRect().bottom > lim + 1); if (k <= 0) k = Math.max(1, Math.ceil(items.length / 2));
    const lines = s.body.split('\n'), cut = Math.min(k, lines.length);
    at(sl => { sl[i] = { ...sl[i], body: lines.slice(0, cut).join('\n').replace(/\n+$/, '') };
      sl.splice(i + 1, 0, E.normSlide({ layout: s.layout, title: s.title + (/\(continued\)/i.test(s.title) ? '' : ' ' + t('plan.continued')), body: lines.slice(cut).join('\n'), size: s.size, fmt: 2 })); }, i);
  };
  // Measured after each drawing, on the slide at its full size (offsets are not scaled).
  useLayoutEffect(() => { const el = stage.current && stage.current.querySelector('.ls-slide'); let o = []; try { o = el ? E.slideFit(el, 'edit') : []; } catch { } setOver(o.length > 0 ? (o.includes('body') ? 'body' : o[0]) : false); });
  useEffect(() => {
    const offs = [
      register({ id: 'edit-next', keys: ['alt+arrowdown'], label: 'plan.next_slide', run: () => setCur(Math.min(n - 1, i + 1)) }),
      register({ id: 'edit-prev', keys: ['alt+arrowup'], label: 'plan.prev_slide', run: () => setCur(Math.max(0, i - 1)) }),
    ];
    return () => offs.forEach(f => f());
  }, [i, n]);
  const sizes = E.deckSizes();
  const layouts = Object.keys(E.LAYOUTS).map(k => ({ value: k, label: LAYOUT_LINE[k] ? t(LAYOUT_LINE[k]) : k }));
  return <div class="editor">
    <div class="ed-top"><TextInput label={t('plan.lesson_title')} value={d.title} onInput={v => put({ ...d, title: v })} /></div>
    <div class="ed-grid">
      <ol class="ed-list" aria-label={t('plan.all_slides')}>{d.slides.map((x, j) => <li><button type="button" class={'th' + (j === i ? ' on' : '')} aria-current={j === i ? 'true' : undefined} onClick={() => setCur(j)} aria-label={t('plan.slide_n', { n: j + 1 })}>
        <span class="n">{j + 1}</span><Slide slide={x} lesson={d} plan={p} width={132} />{(x.talk || []).some(c => !c.done) && <Icon name="comment" size="xs" />}</button></li>)}
        <li><Button size="sm" icon="plus" onClick={add} data-focus="add-slide">{t('plan.add_slide')}</Button></li></ol>
      <div class="ed-stage" ref={stage}>
        <Slide slide={s} lesson={d} plan={p} width={900} fill label={t('plan.slide_of', { n: i + 1, of: n })} />
        {over && <p class="ed-warn" role="status"><Icon name="warn" size="sm" /><span>{over === 'body' ? t('plan.too_much', { n: s.size }) : t('plan.box_over')}</span>
          {over === 'body' && <Button size="sm" onClick={split}>{t('plan.split_slide')}</Button>}</p>}
        <div class="ed-bar"><span class="num">{t('plan.slide_of', { n: i + 1, of: n })}</span><span class="grow" />
          <IconButton icon="chu" label={t('plan.move_up')} disabled={i === 0} onClick={() => move(-1)} />
          <IconButton icon="chd" label={t('plan.move_down')} disabled={i >= n - 1} onClick={() => move(1)} />
          <Menu label={t('plan.slide_actions')} items={[{ id: 'dup', label: t('plan.duplicate'), icon: 'copy', onSelect: dup }, { id: 'del', label: t('common.delete'), icon: 'trash', disabled: n < 2, onSelect: del }]}
            trigger={q => <IconButton icon="dots" label={t('plan.slide_actions')} {...q} />} /></div>
      </div>
      <div class="ed-form">
        <Select label={t('plan.layout')} value={s.layout} options={layouts} onChange={v => setSlide({ layout: v }, true)} />
        <TextInput label={t('plan.slide_title')} value={s.title} onInput={v => setSlide({ title: v })} />
        {(MORE[s.layout] || []).map(k => k === 'body2' ? <TextBox label={t(BOX_LINE[k])} value={s[k] || ''} onInput={v => setSlide({ [k]: v })} rows={4} />
          : <TextInput label={t(BOX_LINE[k])} value={s[k] || ''} onInput={v => setSlide({ [k]: v })} />)}
        {PIC.includes(s.layout) && <PictureField s={s} setSlide={setSlide} />}
        {!NO_BODY.includes(s.layout) && <TextBox label={t(s.layout === 'title' ? 'plan.box_sub' : 'plan.box_body')} hint={t(s.layout === 'title' ? 'plan.sub_hint' : 'plan.body_hint')} value={s.body} onInput={v => setSlide({ body: v })} rows={7} />}
        {s.layout !== 'title' && <Select label={t('plan.text_size')} value={String(s.size)} options={sizes.map(z => ({ value: String(z), label: t('plan.pt', { n: z }) }))} onChange={v => setSlide({ size: +v }, true)} />}
        <TextBox label={t('plan.speaker_notes')} value={s.notes} onInput={v => setSlide({ notes: v })} rows={3} />
        <h3 class="sub">{t('plan.comments_slide', { name: ai })}</h3>
        <Talk talk={s.talk} ai={ai} label={t('plan.comments_slide', { name: ai })} onChange={v => setSlide({ talk: v }, true)} />
      </div>
    </div>
  </div>;
}
