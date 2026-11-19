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
import { Button, IconButton, Icon, Select, TextInput, Menu, toast } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import { register } from '../../services/shortcuts.js';
import { engine } from '../../planning/engine.js';
import { Slide } from '../plan/slide.jsx';
import { Talk } from '../plan/talk.jsx';
import { RichBox } from '../plan/richbox.jsx';
import * as T from '../../engines/plantools.js';
import { saveKv } from '../../planning/write.js';
import '../plan/lines.js';
import '../plan/edit-lines.js';
import { usePart } from '../parts.js';

const PIC = ['picture', 'fullpic', 'textpic', 'picprompt'];
// The boxes each layout has beyond its title and text (src/planner/looks.js teachBoxes).
const MORE = { warmup: ['tag'], exit: ['tag'], steps: ['foot'], discuss: ['foot'], twocol: ['h1', 'h2', 'body2'], passage: ['cite', 'foot'], vocab: ['word', 'pos', 'foot'] };
// Every line named in full (next/test/lines.test.js).
const LAYOUT_LINE = { title: 'plan.layout_title', agenda: 'plan.layout_agenda', objectives: 'plan.layout_objectives', warmup: 'plan.layout_warmup', exit: 'plan.layout_exit', steps: 'plan.layout_steps', discuss: 'plan.layout_discuss', content: 'plan.layout_content', twocol: 'plan.layout_twocol', text: 'plan.layout_text', passage: 'plan.layout_passage', vocab: 'plan.layout_vocab', picture: 'plan.layout_picture', fullpic: 'plan.layout_fullpic', textpic: 'plan.layout_textpic', picprompt: 'plan.layout_picprompt', video: 'plan.layout_video' };
const BOX_LINE = { tag: 'plan.box_tag', foot: 'plan.box_foot', h1: 'plan.box_h1', h2: 'plan.box_h2', body2: 'plan.box_body2', cite: 'plan.box_cite', word: 'plan.box_word', pos: 'plan.box_pos' };
const NO_BODY = ['picture', 'fullpic', 'video'];
// The looks (src/planner/looks.js LOOKS), each name a line of its own.
const LOOK_LINE = { wood: 'edit.look_wood', white: 'edit.look_white', cream: 'edit.look_cream', sage: 'edit.look_sage', sky: 'edit.look_sky', blush: 'edit.look_blush', charcoal: 'edit.look_charcoal', navy: 'edit.look_navy',
  stripe: 'edit.look_stripe', band: 'edit.look_band', bigtype: 'edit.look_bigtype', framed: 'edit.look_framed', notebook: 'edit.look_notebook', chalk: 'edit.look_chalk' };
// Each box's name (src/planner/boxes.js BOX_NAME).
const BOXN = { title: 'edit.box_title', body: 'edit.box_body', body2: 'edit.box_body2', sub: 'edit.box_sub', tag: 'edit.box_tag', foot: 'edit.box_foot', h1: 'edit.box_h1', h2: 'edit.box_h2', cite: 'edit.box_cite', word: 'edit.box_word', pos: 'edit.box_pos' };

const copy = x => JSON.parse(JSON.stringify(x));

export default function Editor({ p, l, cur, setCur, save, ai, onAsk = () => {} }) {
  const E = engine(p);
  const [d, setD] = useState(() => copy(l)), timer = useRef(0), last = useRef(l.updated), stage = useRef(null);
  const [over, setOver] = useState(false), [box, setBox] = useState(''), [keys, setKeys] = useState([]), [looking, setLooking] = useState(false), [tips, setTips] = useState(false), host = useRef(null), X = usePart('edit2'), [vid, setVid] = useState(false), [saving, setSaving] = useState(false);
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
    setSaving(true); const go = async () => { timer.current = 0; const s = await save(next); if (s) last.current = s.updated; setSaving(false); };
    if (now) go(); else timer.current = setTimeout(go, 400);
  };
  const n = d.slides.length, i = Math.max(0, Math.min(cur, n - 1)), s = d.slides[i];
  const setSlide = (patch, now) => { let next = copy(d); next.slides[i] = { ...next.slides[i], ...patch }; for (const k in patch) if (patch[k] === undefined) delete next.slides[i][k]; if ('title' in patch && X) next = X.linkTitles(next, i); put(next, now, 'slide:' + (next.slides[i].id || i) + ':' + Object.keys(patch).join(',')); };
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
  useLayoutEffect(() => { const el = stage.current && stage.current.querySelector('.ls-slide'); let o = []; try { o = el ? E.slideFit(el, 'edit') : []; } catch { } setOver(o.length > 0 ? (o.includes('body') ? 'body' : o[0]) : false);
    // The boxes on the slide that can be sized and moved, the title first (src/planner/boxes.js sizable).
    const ks = el ? [...el.querySelectorAll('[data-k]')].map(e => e.dataset.k).filter((k, j, a) => T.BOX_KEYS.includes(k) && a.indexOf(k) === j) : [];
    if (ks.join() !== keys.join()) setKeys(ks);
  });
  // The box the size and place are about: the one last clicked on the slide, or the slide's main text.
  const k = keys.includes(box) ? box : '';
  const sizeOf = kk => kk === 'body' ? s.size : (s.fs && s.fs[kk]) || 0;
  const setSize = (kk, v) => {
    if (v === 'fit') return fit(kk);
    if (kk === 'body') return setSlide({ size: +v }, true);
    const fs = { ...(s.fs || {}) }; if (v) fs[kk] = +v; else delete fs[kk]; setSlide({ fs: Object.keys(fs).length ? fs : undefined }, true);
  };
  // The biggest size in the list at which the box's words fit, tried on the slide itself (src/planner/boxes.js fitBox).
  const fit = kk => {
    const el = stage.current && stage.current.querySelector('.ls-slide [data-k="' + kk + '"]'); if (!el) return;
    const list = T.boxSizes(s, kk).slice().sort((a, b) => b - a), was = el.style.fontSize; let pick = 0;
    for (const v of list) { el.style.fontSize = (v * T.PT).toFixed(1) + 'px'; if (!T.boxOver(el)) { pick = v; break; } }
    el.style.fontSize = was;
    if (!pick) { pick = list[list.length - 1]; toast(t('edit.fit_none', { n: pick }), { ms: 7000 }); }
    if (kk === 'body') setSlide({ size: pick }, true); else setSlide({ fs: { ...(s.fs || {}), [kk]: pick } }, true);
  };
  const placeBox = (kk, r) => setSlide({ box: { ...(s.box || {}), [kk]: r } }, true);
  const boxBack = kk => { const b = { ...(s.box || {}) }; delete b[kk]; setSlide({ box: Object.keys(b).length ? b : undefined }, true); };
  useEffect(() => {
    const offs = [
      register({ id: 'edit-next', keys: ['alt+arrowdown'], label: 'plan.next_slide', run: () => setCur(Math.min(n - 1, i + 1)) }),
      register({ id: 'edit-prev', keys: ['alt+arrowup'], label: 'plan.prev_slide', run: () => setCur(Math.max(0, i - 1)) }),
      // Listed in Help; the slide's text box itself does them (plan/richbox.jsx), so they never run from here.
      register({ id: 'edit-bullets', keys: ['mod+shift+8'], label: 'edit.rt_bullets_tip', when: () => false, run: () => {} }),
      register({ id: 'edit-numbers', keys: ['mod+shift+7'], label: 'edit.rt_numbers_tip', when: () => false, run: () => {} }),
    ];
    return () => offs.forEach(f => f());
  }, [i, n]);
  const layouts = Object.keys(E.LAYOUTS).map(k => ({ value: k, label: LAYOUT_LINE[k] ? t(LAYOUT_LINE[k]) : k }));
  return <div class="editor">
    <div class="ed-top"><TextInput label={t('plan.lesson_title')} value={d.title} onInput={v => { const n = copy(d); n.title = v; put(X ? X.linkTitles(n) : n); }} />
      <Button icon="image" onClick={() => setLooking(true)} data-focus="look">{t('edit.look_n', { name: t(LOOK_LINE[T.lookOf(d)] || 'edit.look') })}</Button>
      <Button variant="quiet" icon="info" onClick={() => setTips(true)} data-focus="tips">{t('edit.tips')}</Button>
      {X && <X.TopExtras d={d} saving={saving} />}</div>
    {X && looking && <X.LookSheet k={{ p, E, T, Slide, saveKv, LOOK_LINE }} d={d} s={s} onPick={lk => put({ ...d, look: lk }, true)} onClose={() => setLooking(false)} />}
    {X && tips && <X.Tips onClose={() => setTips(false)} />}
    <div class="ed-grid">
      <ol class="ed-list" aria-label={t('plan.all_slides')}>{d.slides.map((x, j) => <li><button type="button" class={'th' + (j === i ? ' on' : '')} aria-current={j === i ? 'true' : undefined} onClick={() => setCur(j)} aria-label={t('plan.slide_n', { n: j + 1 })} data-slide-i={j}>
        <span class="n">{j + 1}</span><Slide slide={x} lesson={d} plan={p} width={132} />{(x.talk || []).some(c => !c.done) && <Icon name="comment" size="xs" />}</button></li>)}
        <li><Button size="sm" icon="plus" onClick={add} data-focus="add-slide">{t('plan.add_slide')}</Button></li></ol>
      <div class="ed-stage" ref={stage}>
        <div class="ed-stagewrap" ref={host} onClick={e => { const b = e.target.closest && e.target.closest('.ls-slide [data-k]'); if (b && b.dataset.k === 'video') setVid(true); if (b && T.BOX_KEYS.includes(b.dataset.k)) setBox(b.dataset.k); }}>
          <Slide slide={s} lesson={d} plan={p} width={900} fill label={t('plan.slide_of', { n: i + 1, of: n })} />
          {X && k && <X.Frame key={i + ':' + k} host={host} k={k} name={t(BOXN[k])} moved={!!(s.box && s.box[k])} onDone={r => placeBox(k, r)} onBack={() => boxBack(k)} />}</div>
        {over && <p class="ed-warn" role="status"><Icon name="warn" size="sm" /><span>{over === 'body' ? t('plan.too_much', { n: s.size }) : t('plan.box_over')}</span>
          {over === 'body' && <Button size="sm" onClick={split}>{t('plan.split_slide')}</Button>}</p>}
        <div class="ed-bar"><span class="num">{t('plan.slide_of', { n: i + 1, of: n })}</span><span class="grow" />
          <IconButton icon="chu" label={t('plan.move_up')} disabled={i === 0} onClick={() => move(-1)} />
          <IconButton icon="chd" label={t('plan.move_down')} disabled={i >= n - 1} onClick={() => move(1)} />
          <Menu label={t('plan.slide_actions')} items={[{ id: 'dup', label: t('plan.duplicate'), icon: 'copy', onSelect: dup }, { id: 'ask', label: t('plan.redo_with', { name: ai }), icon: 'assist', onSelect: () => onAsk(i) }, { id: 'del', label: t('common.delete'), icon: 'trash', disabled: n < 2, onSelect: del }]}
            trigger={q => <IconButton icon="dots" label={t('plan.slide_actions')} {...q} />} /></div>
      </div>
      <div class="ed-form">
        {k && <div class="boxtools" role="group" aria-label={t('edit.box_tools')}>
          <Select label={t('edit.box_pick')} value={k} options={keys.map(x => ({ value: x, label: t(BOXN[x]) }))} onChange={setBox} data-focus="box-pick" />
          <Select label={t('plan.text_size')} value={String(sizeOf(k) || '')} data-focus="box-size" onChange={v => setSize(k, v)}
            options={[...(k === 'body' ? [] : [{ value: '', label: T.boxUsual(s, k) ? t('edit.size_usual_n', { n: T.boxUsual(s, k) }) : t('edit.size_usual') }]), ...T.boxSizes(s, k).map(z => ({ value: String(z), label: t('plan.pt', { n: z }) })), { value: 'fit', label: t('edit.size_fit') }]} />
          {s.box && s.box[k] && <Button size="sm" variant="quiet" onClick={() => boxBack(k)}>{t('edit.box_back')}</Button>}
          <small class="hint">{t('edit.box_hint')}</small></div>}
        {!k && keys.length > 0 && <p class="hint">{t('edit.box_hint')}</p>}
        <Select label={t('plan.layout')} value={s.layout} options={layouts} onChange={v => setSlide({ layout: v }, true)} data-focus="layout" />
        <TextInput label={t('plan.slide_title')} value={s.title} onInput={v => setSlide({ title: v })} />
        {(MORE[s.layout] || []).map(x => x === 'body2' ? <RichBox key={i + x} label={t(BOX_LINE[x])} value={s[x] || ''} onInput={v => setSlide({ [x]: v })} />
          : <TextInput label={t(BOX_LINE[x])} value={s[x] || ''} onInput={v => setSlide({ [x]: v })} />)}
        {X && PIC.includes(s.layout) && <X.PictureField s={s} setSlide={setSlide} />}
        {X && s.layout === 'video' && <X.VideoRow s={s} T={T} onOpen={() => setVid(true)} />}
        {X && vid && <X.VideoSheet s={s} T={T} onPatch={p2 => setSlide(p2, true)} onClose={() => setVid(false)} />}
        {!NO_BODY.includes(s.layout) && (s.layout === 'title' ? <TextBox label={t('plan.box_sub')} hint={t('plan.sub_hint')} value={s.body} onInput={v => setSlide({ body: v })} rows={3} />
          : <RichBox key={i + 'body'} label={t('plan.box_body')} hint={t('edit.body_hint')} value={s.body} onInput={v => setSlide({ body: v })} data-focus="slide-body" />)}
        <TextBox label={t('plan.speaker_notes')} value={s.notes} onInput={v => setSlide({ notes: v })} rows={3} />
        <h3 class="sub">{t('plan.comments_slide', { name: ai })}</h3>
        <Talk talk={s.talk} ai={ai} label={t('plan.comments_slide', { name: ai })} onChange={v => setSlide({ talk: v }, true)} />
      </div>
    </div>
  </div>;
}
