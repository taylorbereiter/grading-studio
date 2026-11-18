// Help (src/help.js): every answer the current app has, in its groups, reworded only where a screen moved (help/topics.js), with a
// search (Esc clears), each answer opened at its own address (#/help/<topic>) and in the command bar; then where everything lives
// now, the keyboard shortcuts and what's new. Nothing here is saved: which answers are open lasts for the visit.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { TextInput, Button, Icon } from '../../ui/index.js';
import { t, num } from '../../i18n/t.js';
import { href, go } from '../router.js';
import { SECS, TOPICS, MAP } from '../help/topics.js';
import '../help/lines.js';

// **word** is bold; everything else is plain text.
const rich = s => String(s).split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b>{x}</b> : x));
function Body({ x }) {
  const out = []; let steps = [];
  const flush = () => { if (steps.length) { out.push(<ol>{steps.map(s => <li>{rich(s)}</li>)}</ol>); steps = []; } };
  for (const k of x.a) { const s = t(k), m = /^\d+\.\s+(.*)$/s.exec(s); if (m) steps.push(m[1]); else { flush(); out.push(<p>{rich(s)}</p>); } }
  flush();
  if (x.go) out.push(<p class="hlpgo"><a class="btn sm" href={x.go[1]}>{t(x.go[0])}</a></p>);
  return <div class="hlpa" id={'hlpa-' + x.id}>{out}</div>;
}
const all = x => (t(x.q) + ' ' + x.a.map(k => t(k)).join(' ') + ' ' + (x.w ? t(x.w) : '')).toLowerCase();

function WhatsNew() {
  const [list, setList] = useState(null), [more, setMore] = useState(false);
  useEffect(() => { import('../../../../src/whatsnew.json').then(m => setList(Object.entries(m.default || m)), () => setList([])); }, []);
  if (!list) return <div class="loading" aria-busy="true" />;
  return <>{(more ? list : list.slice(0, 6)).map(([v, notes]) => <section class="hlpnew"><h3>{t('help.version', { v })}</h3><ul data-raw>{notes.map(n => <li>{n}</li>)}</ul></section>)}
    {!more && list.length > 6 && <Button size="sm" onClick={() => setMore(true)}>{t('help.new_more')}</Button>}</>;
}

export default function Help({ route }) {
  const topic = (route.params.topic || '').replace(/-/g, '_'), [q, setQ] = useState(''), [open, setOpen] = useState(() => new Set(topic ? [topic] : [])), [news, setNews] = useState(false);
  const came = useRef('');
  useEffect(() => {
    if (!topic || came.current === topic) return; came.current = topic;
    setQ(''); setOpen(o => new Set([...o, topic]));
    requestAnimationFrame(() => { const el = document.getElementById('hlp-' + topic); if (el) { el.scrollIntoView({ block: 'center' }); const b = el.querySelector('button'); if (b) b.focus({ preventScroll: true }); } });
  }, [topic]);
  const toggle = id => setOpen(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const item = x => { const on = open.has(x.id); return <div class={'hlpq' + (on ? ' on' : '')} id={'hlp-' + x.id} key={x.id}>
    <h3><button type="button" class="hlph" aria-expanded={String(on)} aria-controls={'hlpa-' + x.id} onClick={() => toggle(x.id)} data-hlp={x.id}><span>{t(x.q)}</span><Icon name={on ? 'chu' : 'chd'} /></button></h3>
    {on && <Body x={x} />}</div>; };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), hits = words.length ? TOPICS.filter(x => { const s = all(x); return words.every(w => s.includes(w)); }) : null;
  return <div class="page narrow help" data-help>
    <header class="ph"><div><h1>{t('help.title')}</h1><p>{t('help.about')}</p></div></header>
    <div class="hlpfind"><TextInput icon="search" label={t('help.find')} value={q} onInput={setQ} onKeyDown={e => { if (e.key === 'Escape' && q) { e.preventDefault(); e.stopPropagation(); setQ(''); } }} data-hlpq /></div>
    {hits ? (hits.length ? <section class="hlpsec"><h2>{t('help.n_answers', { n: hits.length })}</h2><div class="card">{hits.map(item)}</div></section> : <p class="mute" role="status">{t('help.none', { q: q.trim() })}</p>)
      : <>
        {SECS.map(([k, line]) => <section class="hlpsec" data-hlpsec={k}><h2>{t(line)}</h2><div class="card">{TOPICS.filter(x => x.sec === k).map(item)}</div></section>)}
        <section class="hlpsec" data-hlpmap><h2>{t('help.map')}</h2><p class="mute">{t('help.map_about')}</p>
          <div class="card"><table class="hlpmap">{MAP.map(([g, rows]) => <><tr class="g"><th colSpan={3} scope="colgroup">{t(g)}</th></tr>
            {rows.map(([f, w, to]) => <tr><td>{t(f)}</td><td class="mute">{t(w)}</td><td>{to && <a class="btn sm quiet" href={to}>{t('help.go')}</a>}</td></tr>)}</>)}</table></div></section>
        <section class="hlpsec"><h2>{t('help.keys')}</h2><p><a class="btn sm" href={href('help', 'keys')}><Icon name="keyboard" />{t('help.keys')}</a></p></section>
        <section class="hlpsec" data-hlpnew><h2>{t('help.new')}</h2><p class="mute">{t('help.new_about')}</p>
          {news ? <WhatsNew /> : <Button size="sm" onClick={() => setNews(true)} data-hlpnewopen>{t('help.new')}</Button>}</section>
      </>}
  </div>;
}
