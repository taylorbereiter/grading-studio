// The welcome (src/welcome.js): a browser nobody has used yet opens on three questions, your classes (and where students hand in
// work), how you grade, and where work is kept. The answers become her classes and lib.me, with hi so she isn't asked again. From
// it she can also look around the sample first, bring her work in from another computer, sign in with Google so her work comes
// down from her Drive, or let her AI assistant fill My setup. A browser that already has work is never asked. main.js loads this
// only for a fresh browser on Home, outside the sample and not signed in.
import { h, render, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go } from '../router.js';
import { useSaving } from '../../services/saving.js';
import { enterSample } from '../sample.js';
import { GRADE_WAYS } from '../../engines/gways.js';
import { saveLibrary, saveSetting } from '../../students/write.js';
import { SYS_LIST } from './systems.js';
import './prefs-lines.js';
import '../mark/setup-lines.js';

const WAYS = { rubric: ['setup.sg_way_rubric', 'setup.sg_way_rubric_say'], points: ['setup.sg_way_points', 'setup.sg_way_points_say'], percent: ['setup.sg_way_percent', 'setup.sg_way_percent_say'], letters: ['setup.sg_way_letters', 'setup.sg_way_letters_say'], myp: ['setup.sg_way_myp', 'setup.sg_way_myp_say'], ib7: ['setup.sg_way_ib7', 'setup.sg_way_ib7_say'] };
const uid = () => Math.random().toString(36).slice(2, 10);
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const J = o => JSON.parse(JSON.stringify(o));
const STEPS = ['prefs.wl_s1', 'prefs.wl_s2', 'prefs.wl_s3'];

export function welcome() {
  const box = document.createElement('div'); document.body.appendChild(box);
  const close = () => { render(null, box); box.remove(); document.documentElement.classList.remove('welcoming'); };
  document.documentElement.classList.add('welcoming');
  render(h(Welcome, { close }), box);
}

function Welcome({ close }) {
  const S = useSaving(), [step, setStep] = useState(0), [classes, setClasses] = useState(['', '', '']), [sys, setSys] = useState(''), [other, setOther] = useState('');
  const [way, setWay] = useState('rubric'), [busy, setBusy] = useState(false), sheet = useRef(null);
  useEffect(() => { const f = sheet.current && sheet.current.querySelector('.wlbody input:not([disabled]), .wlbody button'); if (f) f.focus(); }, [step]);
  // The screen behind is drawn after the questions open, and moves focus to itself: it comes back here, as it does in any dialog.
  useEffect(() => { const back = e => { const s = sheet.current; if (s && !s.contains(e.target)) { const f = s.querySelector('.wlbody input:not([disabled]), .wlbody button'); if (f) f.focus(); } }; document.addEventListener('focusin', back); return () => document.removeEventListener('focusin', back); }, []);
  const f = S ? S.folder() : null, g = S ? S.google() : {};
  const typed = (i, v) => setClasses(l => { const n = l.slice(); n[i] = v; if (n.length < 12 && n[n.length - 1].trim()) n.push(''); return n; });
  const save = async () => {
    const w = GRADE_WAYS.find(x => x[0] === way) || GRADE_WAYS[0], said = (sys === 'other' ? other : sys).trim().slice(0, 40);
    await saveLibrary(l => {
      l.classes ||= []; l.loose ||= { id: '', units: [] };
      const seen = new Set(l.classes.map(c => norm(c.name)));
      for (const raw of classes) {
        const name = raw.trim().replace(/\s+/g, ' ').slice(0, 60); if (!name || seen.has(norm(name))) continue;
        seen.add(norm(name)); l.classes.push({ id: uid(), name, names: [], units: [], ...(w[0] === 'myp' ? { way: 'myp' } : {}) });   // MYP teachers start with MYP classes
      }
      l.me = { sys: said, unit: '', ai: '', grade: { way: w[0], setup: J(w[3]), ...(w[4] ? { bands: w[4].map(b => b.slice()) } : {}) }, hi: Date.now() };
    });
    saveSetting('gs.setup', null);   // nothing scored yet in this browser: her answer is what the next assignment starts with
  };
  const next = async () => {
    if (step < 2) return setStep(step + 1);
    setBusy(true);
    try { await save(); } catch (e) { console.error(e); setBusy(false); return toast(t('prefs.wl_cant')); }
    close(); go('home');
    toast(classes.some(c => c.trim()) ? t('prefs.wl_done_cls') : t('prefs.wl_done'), { ms: 7000 });
  };
  const away = (fn) => { close(); fn(); };
  const key = e => {
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); next(); }
    if (e.key === 'Escape') e.preventDefault();   // the questions keep the screen until they are answered or left by a button
    if (e.key === 'Tab') {   // and the keyboard
      const all = [...sheet.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select')].filter(el => el.tabIndex >= 0);
      const a = all[0], z = all[all.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  const wayKey = e => {
    if (!/^Arrow/.test(e.key)) return;
    e.preventDefault(); const i = GRADE_WAYS.findIndex(w => w[0] === way), d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1, k = GRADE_WAYS[(i + d + GRADE_WAYS.length) % GRADE_WAYS.length][0];
    setWay(k); setTimeout(() => { const b = sheet.current.querySelector('[data-wlway="' + k + '"]'); if (b) b.focus(); }, 0);
  };
  let body;
  if (step === 0) body = <>
    <label class="wlq" for="wlC0">{t('prefs.wl_teach')}</label>
    <div class="wlfields">{classes.map((c, i) => <input class="input" type="text" id={'wlC' + i} data-wlc={i} value={c} maxLength={60} autocomplete="off" data-raw
      placeholder={t(i ? 'prefs.wl_another' : 'prefs.wl_class_ph')} aria-label={i ? t('prefs.wl_another_l') : undefined} onInput={e => typed(i, e.currentTarget.value)} />)}</div>
    <p class="hint">{t('prefs.wl_names_later')}</p>
    <label class="wlq" for="wlSys">{t('prefs.wl_hand_in')}</label>
    <div class="wlfields"><select id="wlSys" class="input" value={sys} onChange={e => setSys(e.currentTarget.value)} data-wlsys>
      <option value="">{t('prefs.wl_paper')}</option>{SYS_LIST.map(n => <option value={n}>{n}</option>)}<option value="other">{t('prefs.sys_other')}</option></select>
      {sys === 'other' && <input class="input" type="text" value={other} maxLength={40} placeholder={t('prefs.wl_its_name')} aria-label={t('prefs.wl_its_name_l')} onInput={e => setOther(e.currentTarget.value)} data-raw />}</div>
    <p class="hint">{t('prefs.wl_sys_why')}</p></>;
  else if (step === 1) body = <>
    <div class="wlq" id="wlWayQ">{t('prefs.wl_grade_q')}</div>
    <div class="sg-ways" role="radiogroup" aria-labelledby="wlWayQ" onKeyDown={wayKey}>{GRADE_WAYS.map(([k]) => <button type="button" class={'sg-way' + (way === k ? ' on' : '')} role="radio" aria-checked={way === k} tabIndex={way === k ? 0 : -1} onClick={() => setWay(k)} data-wlway={k}>
      <b>{t(WAYS[k] ? WAYS[k][0] : k)}</b><span>{WAYS[k] ? t(WAYS[k][1]) : ''}</span></button>)}</div>
    <p class="hint">{t('prefs.wl_grade_why')}</p></>;
  else body = <>
    <div class="wlq">{t('prefs.wl_kept_q')}</div>
    {f && f.state !== 'none' && f.name ? <p class="wlsafe" data-wlsafe><span data-raw>{t('prefs.wl_folder_on', { name: f.name })}</span></p>
      : f && f.canPick ? <><p>{t('prefs.wl_kept_say')}</p><p class="row gap"><Button icon="folder" disabled={busy} onClick={async () => { setBusy(true); try { await S.folderPick(); } catch (e) { console.error(e); } finally { setBusy(false); } }} data-wlfolder>{t('prefs.wl_folder')}</Button>
        <span class="mute">{t('prefs.wl_later')}</span></p></>
      : <p>{t('prefs.wl_kept_nopick')}</p>}</>;
  return <div class="wlwrap" onKeyDown={key}><div class="wlsheet" role="dialog" aria-modal="true" aria-labelledby="wlH" ref={sheet} data-welcome>
    <h1 id="wlH">{t('prefs.wl_h')}</h1>
    <p class="mute">{t('prefs.wl_lead')}</p>
    <ol class="wlsteps" aria-label={t('prefs.wl_step_of', { n: step + 1 })}>{STEPS.map((k, i) => <li class={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><b>{i + 1}</b>{t(k)}</li>)}</ol>
    <div class="wlbody">{body}</div>
    <div class="wlact">{step > 0 && <Button onClick={() => setStep(step - 1)} data-wlback>{t('prefs.wl_back')}</Button>}
      <Button variant="primary" disabled={busy} onClick={next} data-wlnext>{t(step === 2 ? 'prefs.wl_start' : 'prefs.wl_continue')}</Button>
      <button type="button" class="link" onClick={() => away(() => { if (!enterSample()) toast(t('sample.cant')); })} data-wlsample>{t('prefs.wl_sample')}</button></div>
    {step === 0 && <div class="wlfoot">
      <p>{t('prefs.wl_other_pc')} <button type="button" class="link" onClick={() => away(() => { go('settings', 'saving'); toast(t('prefs.wl_bring_say'), { ms: 8000 }); })} data-wlbring>{t('prefs.wl_bring')}</button></p>
      {g.can && <p><Button size="sm" onClick={() => away(() => { go('home'); S.signIn().catch(e => console.error(e)); })} data-wlg>{t('prefs.sv_sign_in')}</Button></p>}
      <p>{t('prefs.wl_ai_q')} <button type="button" class="link" onClick={() => away(() => go('settings', 'classes'))} data-wlai>{t('prefs.wl_ai')}</button></p></div>}
  </div></div>;
}
