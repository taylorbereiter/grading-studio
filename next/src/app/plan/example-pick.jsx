// Choosing a strong example for a slide (src/planner/plexamples.js plxPick): the examples kept while marking, by assignment, named
// the way grading names them (Example A, Question 3), never after the student. Choosing puts a reference on the slide, not the picture.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Sheet, Button, Icon, TextInput, EmptyState } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { examplesForPlanning } from '../../crossings.js';
import { exampleRef, loadExample } from './examples.js';
import './lines.js';
import './les-lines.js';

export const exampleName = r => r.kind === 'answer' ? t('plan.ex_question', { q: r.q || '?' }) : r.kind === 'paper' ? t('plan.ex_example', { x: r.letter || 'A' })
  : r.kind === 'shot' ? t('plan.ex_shot', { x: r.letter || '1' }) : t('plan.ex_part');

function Thumb({ src }) {
  const [u, setU] = useState('');
  useEffect(() => { let on = true; loadExample(src).then(x => { if (on) setU(x); }); return () => { on = false; }; }, [src]);
  return <span class="exth">{u ? <img src={u} alt="" /> : <Icon name="image" />}</span>;
}

// many: several pages at once, one slide each (plxPick's Pages and Put on slides); onPick then gets (refs, example, pages, its name).
export function ExamplePicker({ open, onClose, onPick, many }) {
  const [list, setList] = useState(null), [q, setQ] = useState(''), [pick, setPick] = useState(null), [page, setPage] = useState(0), [pages, setPages] = useState([]);
  useEffect(() => { if (open) { setPick(null); setPage(0); setPages([]); examplesForPlanning().then(setList, () => setList([])); } }, [open]);
  const choose = r => { setPick(r); setPage(0); setPages(Array.from({ length: r.pages || 1 }, (_, n) => n)); };
  const flip = n => setPages(ps => ps.includes(n) ? ps.filter(x => x !== n) : [...ps, n].sort((a, b) => a - b));
  const go = () => many ? onPick(pages.map(n => exampleRef(pick.id, n)), pick, pages, exampleName(pick)) : onPick(exampleRef(pick.id, page), pick, page);
  const hit = r => !q.trim() || [r.title, exampleName(r), r.why, ...r.tags].some(x => x.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = []; for (const r of (list || []).filter(hit)) { let g = groups.find(x => x[0] === r.title); if (!g) groups.push(g = [r.title, []]); g[1].push(r); }
  return <Sheet open={open} wide title={t('plan.add_example')} icon={<Icon name="image" />} onClose={onClose}
    footer={<><Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={!pick || (many && !pages.length)} onClick={go} data-focus="use-example">{many ? t('les.put_on_slides') : t('plan.use_example')}</Button></>}>
    {list && !list.length ? <EmptyState icon="image" title={t('plan.no_examples')} text={t('plan.no_examples_text')} />
      : <div class="expick"><p class="mute">{t('plan.example_stays')}</p>
        <TextInput label={t('plan.find_example')} icon="search" value={q} onInput={setQ} />
        {groups.map(([title, rs]) => <section><h3 class="sub" data-raw>{title}</h3><div class="exgrid">{rs.map(r => <button type="button" class={'excard' + (pick && pick.id === r.id ? ' on' : '')} aria-pressed={String(!!pick && pick.id === r.id)} onClick={() => choose(r)}>
          <Thumb src={exampleRef(r.id, 0)} /><b>{exampleName(r)}</b>{r.why && <small class="mute" data-raw>{r.why}</small>}{r.pages > 1 && <small class="mute">{t('plan.n_pages', { n: r.pages })}</small>}</button>)}</div></section>)}
        {pick && pick.pages > 1 && <div class="expages" role="group" aria-label={many ? t('les.pages') : t('plan.which_page')}>{Array.from({ length: pick.pages }, (_, n) => { const on = many ? pages.includes(n) : n === page; return <button type="button" class={on ? 'on' : ''} aria-pressed={String(on)} onClick={() => many ? flip(n) : setPage(n)} data-page={n}>
          <Thumb src={exampleRef(pick.id, n)} /><small>{t('plan.page_n', { n: n + 1 })}</small></button>; })}</div>}
      </div>}
  </Sheet>;
}
