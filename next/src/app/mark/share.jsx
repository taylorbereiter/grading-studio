// Share with your assistant (src/app/claude.js openShare, openBringBack; src/insight.js shareSteps; src/marksout.js): what goes to the
// teacher's own assistant has no names in it. Each student is a random code (S-XXXX) and the list of who is who stays in this
// browser (batch.share, the current app's own record, saved by the marking screen). Papers and marks: every page as a picture with
// names covered, after Check the covers (mark/covers.jsx). Marks only: one file of scores, comments and marks. Bring back: her
// assistant's reply, pasted or as a file, goes to each student's comment box by code. The ZIP, the marks file and reading the reply
// are the current app's own code (engines/gshare.js). Loaded on its own (router.js PARTS.share), from Insights and the Setup menu.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Sheet, Segmented, Checkbox, Progress, toast } from '../../ui/index.js';
import { copyText } from '../../services/clipboard.js';
import { t } from '../../i18n/t.js';
import { state, use, fflate } from '../../engines/gcore.js';
import { shownName, viewable } from '../../engines/gdraw.js';
import { shareState, nameFreeText, nameFindOn } from '../../engines/gexport.js';
import * as N from '../../engines/gnames.js';
import * as G from '../../engines/gshare.js';
import { touchGrade } from '../../engines/gmark.js';
import { libs } from './paper.js';
import { load as outLoad } from './out.js';
import { CheckCovers } from './covers.jsx';
import './paper-lines.js';
import './top-lines.js';

// her assistant ({ name, link }: services/assistant.js), handed in by the marking screen with ctx
let AI = {};
const aiName = () => AI.name || t('assistant.generic');
const when = ms => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const MARKS_OPTS = [['scores', 'paper.sh_mo_scores'], ['comments', 'paper.sh_mo_comments'], ['stamps', 'paper.sh_mo_stamps'], ['words', 'paper.sh_mo_words'], ['ink', 'paper.sh_mo_ink']];
const ready = async () => { use({ aiSay: aiName }); await libs(); await outLoad(); };

// ctx: { M: the marking code, open, reopen }, as Check the covers takes it
export function Share({ ctx, onClose, back }) {
  AI = ctx.ai || {};
  const sh = shareState(), b = state().batch, ai = AI, name = aiName();
  const [kind, setKindS] = useState(sh.kind === 'marks' ? 'marks' : 'papers'), [, tick] = useState(0), [check, setCheck] = useState(null), [bring, setBring] = useState(!!back);
  const [prog, setProg] = useState(null), [busy, setBusy] = useState(false), [list, setList] = useState(null);
  const save = () => ctx.M.changedNow();
  useEffect(() => { let live = true; (async () => { await ready(); await N.ensureCounts(); if (live) setList(N.coverList(false)); })().catch(e => console.error(e)); return () => { live = false; }; }, [check]);
  const setKind = k => { setKindS(k); sh.kind = k; save(); };
  const copyAsk = (v, k) => copyText(nameFreeText(v)).then(ok => toast(ok ? t(k, { ai: name }) : t('paper.sh_copy_failed')));
  const out = (b.students || []).filter(st => !G.shareDocs(st).length);
  const todo = list ? list.filter(x => !N.coverOk(x.st, x.d)) : [], done = list ? list.filter(x => N.coverOk(x.st, x.d)) : [];
  const zip = async () => {
    setBusy(true); setProg({ n: 0, of: 1 });
    try {
      await ready(); ctx.M.commit();
      await G.makeSharePackage((n, of) => setProg({ n, of }));
      sh.made = Date.now(); sh.madeOpen = todo.length; sh.sent = [...new Set(list.map(x => G.codeOf(x.st)))]; save();
      toast(t('paper.sh_made', { ai: name }), { ms: 6000 });
    } catch (e) { console.error(e); toast(t('paper.sh_wrong', { e: e.message || String(e) })); }
    setBusy(false); setProg(null);
  };
  const marks = async () => {
    setBusy(true); setProg({ n: 0, of: 1 });
    try { await ready(); ctx.M.commit(); const r = await G.makeMarksFile((n, of) => setProg({ n, of })); save(); toast(t('paper.sh_mk_made', { n: r.codes.length, ai: name }), { ms: 6000 }); }
    catch (e) { console.error(e); toast(t('paper.sh_wrong', { e: e.message || String(e) })); }
    setBusy(false); setProg(null);
  };
  if (check) return <CheckCovers ctx={ctx} all={false} start={check.start} onDone={() => setCheck(null)} />;
  if (bring) return <BringBack ctx={ctx} onClose={back ? onClose : () => setBring(false)} />;
  const open = ai.link && <a class="btn sm" href={ai.link} target="_blank" rel="noopener" data-shopen>{t('paper.sh_open', { ai: name })}</a>;
  const row = x => <li><button type="button" class="link" onClick={() => setCheck({ start: list.indexOf(x) })} data-raw data-cc>{N.coverName(x.st, x.k)}</button> <span class="mute">{G.codeOf(x.st) + (x.k ? '-' + (x.k + 1) : '')}</span></li>;
  const ask = (k, def, label) => <textarea class="input" rows="4" aria-label={t('paper.sh_ask_l', { ai: name })} value={sh[k] != null ? sh[k] : def} onInput={e => { sh[k] = e.currentTarget.value; save(); tick(n => n + 1); }} data-shask={label} />;
  const left = todo.length > 0;
  const actions = kind === 'papers'
    ? <><Button variant={left ? 'primary' : undefined} disabled={!list || !list.length || busy} onClick={() => setCheck({ start: Math.max(0, list.indexOf(todo[0])) })} data-check>{left && done.length ? t('paper.sh_check_rest', { n: todo.length }) : list && list.length && !left ? t('paper.sh_check_again') : t('paper.sh_check')}</Button>
      <Button variant={left ? undefined : 'primary'} icon="download" disabled={!list || !list.length || busy} onClick={zip} data-make>{left ? t('paper.sh_zip_anyway') : t('paper.sh_zip', { ai: name })}</Button></>
    : <Button variant="primary" icon="download" disabled={busy} onClick={marks} data-marksdl>{t('paper.sh_mk_dl')}</Button>;
  return <Sheet open wide title={t('paper.sh_h', { ai: name })} onClose={onClose} footer={<><span class="grow" />{actions}</>}>
    <div class="shwrap" data-share>
      <Segmented label={t('paper.sh_kind', { ai: name })} value={kind} onChange={setKind} options={[{ value: 'papers', label: t('paper.sh_papers') }, { value: 'marks', label: t('paper.sh_marks') }]} />
      {kind === 'papers' ? <>
        <p>{t('paper.sh_say', { ai: name })}</p>
        <details class="cclist"><summary>{t('paper.sh_what')}</summary><ul class="dots"><li>{t('paper.sh_w1')}</li><li>{t(nameFindOn() ? 'paper.sh_w2_find' : 'paper.sh_w2')}</li><li>{t('paper.sh_w3')}</li><li>{t('paper.sh_w4')}</li></ul></details>
        {out.length > 0 && <div class="mk-warn" data-shout><b>{t('paper.sh_out', { n: out.length })}</b> <span data-raw>{out.map(st => shownName(st, b.students.indexOf(st))).join(', ')}</span></div>}
        <ol class="shsteps">
          <li><b>{t('paper.sh_s1')}</b> <span class={left ? 'stag' : ''} data-shcount>{list ? t('paper.sh_checked', { n: done.length, of: list.length }) : ''}</span> {t('paper.sh_s1_say')}
            {todo.length > 0 && <details class="cclist" open><summary>{t('paper.sh_todo', { n: todo.length })}</summary><ul>{todo.map(row)}</ul></details>}
            {done.length > 0 && <details class="cclist" open={!left}><summary>{t('paper.sh_done', { n: done.length })}</summary><ul>{done.map(row)}</ul></details>}</li>
          <li><b>{t('paper.sh_s2')}</b> <span data-shmade>{sh.made ? (sh.madeOpen ? t('paper.sh_made_open', { when: when(sh.made), n: sh.madeOpen }) : t('paper.sh_made_at', { when: when(sh.made) })) : t('paper.sh_stays', { ai: name })}</span></li>
          <li><b>{t('paper.sh_s3', { ai: name })}</b> {ask('ask', G.SHARE_ASK, 'papers')}<div class="row gap"><Button size="sm" icon="copy" onClick={() => copyAsk(sh.ask != null ? sh.ask : G.SHARE_ASK, 'paper.sh_copied')} data-shcopy>{t('paper.sh_copy')}</Button>{open}</div></li>
          <li><b>{t('paper.sh_s4')}</b> <Button size="sm" onClick={() => setBring(true)} data-shback>{t('paper.sh_back', { ai: name })}</Button></li>
        </ol></>
      : <>
        <p>{t('paper.sh_mk_say', { ai: name })}</p>
        <div class="mkopts">{MARKS_OPTS.map(([k, line]) => <Checkbox label={t(line)} checked={G.marksOpts()[k]} onChange={v => { G.marksOpts()[k] = v; save(); tick(n => n + 1); }} />)}</div>
        {(n => n > 0 && <p class="mk-warn" data-mkleft={n}>{t('top.sh_mk_left', { n })}</p>)(state().batch.students.filter(G.marksEmpty).length)}
        <ol class="shsteps">
          <li><b>{t('paper.sh_mk_s1')}</b> <span data-mkmade>{sh.marksMade ? t('paper.sh_made_at', { when: when(sh.marksMade) }) : t('paper.sh_stays', { ai: name })}</span></li>
          <li><b>{t('paper.sh_s3', { ai: name })}</b> {ask('marksAsk', G.MARKS_ASK, 'marks')}<div class="row gap"><Button size="sm" icon="copy" onClick={() => copyAsk(sh.marksAsk != null ? sh.marksAsk : G.MARKS_ASK, 'paper.sh_mk_copied')} data-mkcopy>{t('paper.sh_copy')}</Button>{open}</div></li>
          <li><b>{t('paper.sh_mk_s3')}</b> <Button size="sm" onClick={() => setBring(true)} data-shback>{t('paper.sh_back', { ai: name })}</Button></li>
        </ol></>}
      {prog && <Progress value={prog.n} max={Math.max(1, prog.of)} label={t(kind === 'papers' ? 'paper.sh_making' : 'paper.sh_reading', { n: prog.n, of: prog.of })} />}
      {prog && <p class="mute small" role="status">{t(kind === 'papers' ? 'paper.sh_making' : 'paper.sh_reading', { n: prog.n, of: prog.of })}</p>}
    </div>
  </Sheet>;
}

// Bring back from her assistant: the reply, pasted or as a file (CSV, text, JSON or a ZIP), matched to students by code.
export function BringBack({ ctx, onClose }) {
  const b = state().batch, sh = shareState(), name = aiName();
  const byCode = useRef(null);
  if (!byCode.current) {
    const m = new Map(b.students.map(st => [G.codeOf(st), st]));
    for (const [c, k] of Object.entries(sh.also || {})) { const st = b.students.find(s => s.key === k); if (st && !m.has(c)) m.set(c, st); }   // made on another computer
    byCode.current = m;
  }
  const by = byCode.current;
  const [text, setText] = useState(''), [fb, setFb] = useState(new Map()), [papers, setPapers] = useState([]), [add, setAdd] = useState(true), file = useRef(null), tm = useRef(0);
  const read = s => setFb(G.parseFeedback(s));
  const typed = v => { setText(v); clearTimeout(tm.current); tm.current = setTimeout(() => read(v), 400); };
  const take = async f => {
    const data = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) {
      await ready(); let z; try { z = fflate.unzipSync(data); } catch { return toast(t('paper.bb_bad_zip')); }
      const ps = []; let txt = '';
      for (const [p, bytes] of Object.entries(z)) {
        const base = p.split('/').pop(); if (!base || base.startsWith('.') || p.includes('__MACOSX')) continue;
        const m = base.match(/^(S-[A-Z0-9]{4})(?:-(\d+))?.*\.pdf$/i);
        if (m) ps.push({ code: m[1].toUpperCase(), n: +(m[2] || 1), data: bytes });
        else if (/\.(csv|txt|json|md)$/i.test(p) && !/readme/i.test(p)) txt += '\n' + new TextDecoder().decode(bytes);
      }
      setPapers(ps); setText(txt.trim()); read(txt);
    } else { const s = new TextDecoder().decode(data); setText(s); read(s); }
  };
  const ok = [...fb.keys()].filter(c => by.has(c)), nP = papers.filter(p => by.has(p.code)).length;
  const sent = sh.sent || [], got = new Set(ok.map(c => by.get(c))), miss = sent.filter(c => by.has(c) && !got.has(by.get(c))), who = [...new Set(miss.map(c => by.get(c)))];
  const nm = [...fb].filter(([c, v]) => by.has(c) && /\[name\]/i.test(v)).length, nSent = new Set(sent.map(c => by.get(c)).filter(Boolean)).size;
  const apply = () => {
    let n = 0;
    for (const [c, v] of fb) {
      const st = by.get(c), was = st ? String(st.grade.comment || '') : '';
      if (!st || !v || (add && ('\n\n' + was.trim() + '\n\n').includes('\n\n' + v.trim() + '\n\n'))) continue;
      ctx.M.wordGrade(st, () => { st.grade.comment = add && was.trim() ? was.replace(/\s+$/, '') + '\n\n' + v : v; touchGrade(st); }); n++;
    }
    ctx.reopen && ctx.reopen();
    toast(t('paper.bb_put', { n }));
    onClose();
  };
  const folders = async () => {
    await ready(); const files = {};
    for (const p of papers) {
      const st = by.get(p.code); if (!st) continue;
      const real = st.files.find(f => !f.virtual && viewable(f)) || st.files[0];
      const dir = real && real.path.includes('/') ? real.path.slice(0, real.path.lastIndexOf('/') + 1) : st.key + '/';
      files[(dir + t('paper.bb_feedback_file') + (p.n > 1 ? ' ' + p.n : '') + '.pdf').replace(/[\\:*?"<>|]+/g, '-')] = [p.data, { level: 0 }];
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
    a.download = t('paper.bb_zip_name', { ai: name, name: b.name }).replace(/[\\/:*?"<>|]+/g, '-') + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  return <Sheet open wide title={t('paper.bb_h', { ai: name })} onClose={onClose}
    footer={<><Checkbox label={t('paper.bb_add')} checked={add} onChange={setAdd} /><span class="grow" />
      {nP > 0 && <Button onClick={folders} data-bbpapers>{t('paper.bb_papers')}</Button>}
      <Button variant="primary" disabled={!ok.length} onClick={apply} data-bbapply>{t('paper.bb_apply')}</Button></>}>
    <div class="bbwrap" data-bring onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) take(f); }}>
      <p>{t('paper.bb_say', { ai: name })}</p>
      <textarea class="input" rows="7" value={text} onInput={e => typed(e.currentTarget.value)} aria-label={t('paper.bb_paste_l', { ai: name })} placeholder={'S-7QK4\n…'} data-bbtext data-raw />
      <div class="row gap"><Button size="sm" icon="upload" onClick={() => file.current.click()} data-bbfile>{t('paper.bb_open')}</Button><Button size="sm" onClick={() => read(text)} data-bbread>{t('paper.bb_match')}</Button>
        <input ref={file} type="file" accept=".csv,.txt,.json,.md,.zip" hidden onChange={e => { const f = e.currentTarget.files[0]; if (f) take(f); e.currentTarget.value = ''; }} /></div>
      {fb.size > 0 && miss.length > 0 && <div class="mk-warn" data-bbmiss><b>{t('paper.bb_miss', { n: who.length })}</b> <span data-raw>{who.map(st => shownName(st, b.students.indexOf(st))).join(', ')}</span>{' '}
        <button type="button" class="link" onClick={() => copyText(t('paper.bb_more_ask', { codes: miss.join(', ') })).then(o => toast(o ? t('paper.bb_more_copied', { ai: name }) : t('paper.sh_copy_failed')))} data-bbmore>{t('paper.bb_more', { ai: name })}</button></div>}
      {nm > 0 && <p class="mute small" data-bbnm>{t('paper.bb_name_left', { n: nm })}</p>}
      {fb.size > 0 && <><p data-bbcount><b>{t('paper.bb_matched', { n: ok.length, of: nSent || b.students.length })}</b>{fb.size > ok.length ? ' ' + t('paper.bb_not_here', { n: fb.size - ok.length }) : ''} {t('paper.bb_read_over')}</p>
        <table class="gl"><thead><tr><th>{t('paper.bb_code')}</th><th>{t('paper.bb_student')}</th><th>{t('paper.bb_fb')}</th></tr></thead><tbody>
          {[...fb].map(([c, v]) => { const st = by.get(c); return <tr><td class="n">{c}</td><td data-raw>{st ? shownName(st, b.students.indexOf(st)) : <span class="warn">{t('paper.bb_not_in')}</span>}</td><td class="cm" data-raw>{v}</td></tr>; })}</tbody></table></>}
      {papers.length > 0 && <p class="mute small">{t('paper.bb_papers_n', { n: nP })}</p>}
      {!fb.size && !papers.length && <p class="mute small">{t('paper.bb_none')}</p>}
    </div>
  </Sheet>;
}
