// The rest of Settings (stage 6): Working with AI (the assistant, its link, where it opens and the others she switches to: the current
// app's src/welcome.js meSetRender 'claude' and src/beside.js; what it can and can't see), the programme and the places an average is
// shown with (gs.avgDp, src/rubrics.js dpSeg) and her learning goals (src/goals.js goalsDlg) under Grading, what handed-back files are
// called under Marking (gs.xnames, gs.xone, gs.anchorCover, src/app/export.js), where students hand in work under Classes, and the
// app text size and full screen under Display (gs.disp ui, src/app/display.js; src/fullscreen.js). Her own words (lib.me) change as one
// undo step through settings-grading.jsx change(); the goals are the library's (lib.goals, lib.goalsGone) and change the same way.
// Boxes keep what she types while she types (their own state) and save once when she leaves them, so moving quickly from one box to
// the next loses nothing. Loaded with Settings' own pages (PARTS.setmore).
import { SYS_LIST } from './systems.js';
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Select, Switch, TextInput, Segmented, Button, IconButton, Checkbox, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS, href } from '../router.js';
import { prefs } from '../../students/prefs.js';
import * as undoList from '../../services/undo.js';
import { KNOWN } from '../../services/assistant.js';
import { SIZES, uiSize, applySize, fullCan, fullOn, fullToggle } from '../../services/size.js';
import { readLibrary, change, useLibraryPlain as useLibrary, J, meNow } from './settings-me.js';
import './prefs-lines.js';

const meOf = meNow;
// for the sidebar's assistant menu (screens/beside.jsx), which loads with this part
export { readLibrary, change, meNow, KNOWN };
// An address of her own: https only (src/beside.js aiUrlClean).
export function urlClean(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 400); if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
const usual = name => { const a = KNOWN.find(x => x[0].toLowerCase() === String(name || '').trim().toLowerCase()); return a ? a[1] : ''; };
const aiNameOf = m => String(m.ai == null ? (m.scale12 ? KNOWN[1][0] : '') : m.ai).trim().slice(0, 30);
// A box that holds what she types and saves once when she leaves it (or presses Enter). The saved value can change under it (Undo,
// another window): it shows that again only while she is not in the box.
function Box({ value, save, ...rest }) {
  const [v, setV] = useState(value), [on, setOn] = useState(false);
  useEffect(() => { if (!on) setV(value); }, [value, on]);
  return <TextInput value={v} onInput={setV} onFocus={() => setOn(true)} onBlur={e => { setOn(false); if (e.currentTarget.value !== value) save(e.currentTarget.value); }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} {...rest} />;
}

// The window's place on the right of the screen, a little over a third of it wide (src/beside.js besidePlace).
function besidePlace() {
  const s = window.screen || {}, W = s.availWidth || 1280, H = s.availHeight || 800, w = Math.round(Math.min(760, Math.max(420, W * 0.36)));
  return { left: (s.availLeft || 0) + W - w, top: s.availTop || 0, width: w, height: H };
}
// Opens her assistant her way: a window on the right, or a new tab. Opened empty and then sent on, so this page is not its opener.
export function openBeside(link, tab) {
  if (!link) return false;
  const at = besidePlace(); let w = null;
  try { w = window.open('about:blank', '_blank', tab ? '' : 'popup,left=' + at.left + ',top=' + at.top + ',width=' + at.width + ',height=' + at.height); } catch {}
  if (!w) { toast(t('prefs.ai_blocked')); return false; }
  try { w.opener = null; } catch {}
  try { w.location.replace(link); } catch { try { w.close(); } catch {} return false; }
  return true;
}

// Settings > Working with AI
export function AiSettings() {
  const L = useLibrary(), m = meOf(L), a = aiNameOf(m), known = KNOWN.some(x => x[0] === a), link = a ? urlClean(m.aiUrl) || usual(a) : '';
  const [other, setOther] = useState(!!a && !known);
  const meDrop = (label, k, v) => change(label, me => { if (v) me[k] = v; else delete me[k]; });
  // Another assistant: the link she gave the last one is remembered under its name, and the new one's comes back (src/beside.js besideUse).
  const use = name => {
    name = String(name || '').trim().slice(0, 30); if (name === a) return;
    change(t('prefs.ai_step'), me => {
      const was = aiNameOf(me), urls = { ...(me.aiUrls && typeof me.aiUrls === 'object' ? me.aiUrls : {}) };
      if (was) { if (urlClean(me.aiUrl)) urls[was] = urlClean(me.aiUrl); else delete urls[was]; }
      const u = urlClean(urls[name]); delete urls[name];
      me.ai = name; if (u) me.aiUrl = u; else delete me.aiUrl;
      if (Object.keys(urls).length) me.aiUrls = urls; else delete me.aiUrls;
    }, name ? t('prefs.ai_now', { name }) : t('prefs.ai_none_now'));
  };
  const pick = v => { if (v === 'other') { setOther(true); if (known || !a) use(t('prefs.ai_mine')); return; } setOther(false); use(v); };
  const saveUrl = v => { const u = urlClean(v); if (String(v).trim() && !u) { toast(t('prefs.ai_https')); return; } meDrop(t('prefs.ai_step_link'), 'aiUrl', u); };
  const off = new Set(Array.isArray(m.aiOff) ? m.aiOff : []), others = [...new Set(KNOWN.map(x => x[0]).concat(Object.keys(m.aiUrls || {})))].filter(n => n !== a);
  const flip = (n, on) => { const s = new Set(off); if (on) s.delete(n); else s.add(n); meDrop(t('prefs.ai_step_list'), 'aiOff', s.size ? [...s] : null); };
  return <>
    <Card title={t('prefs.ai_h')}>
      <p class="mute">{t('prefs.ai_about')}</p>
      <div class="st-col">
        <span data-stai><Select label={t('prefs.ai_which')} value={other ? 'other' : a} onChange={pick}
          options={[{ value: '', label: t('prefs.ai_none') }, ...KNOWN.map(([n]) => ({ value: n, label: n })), { value: 'other', label: t('prefs.ai_other') }]} data-raw /></span>
        {other && <Box label={t('prefs.ai_its_name')} value={a} maxLength={30} save={use} data-raw data-staiother />}
        {a && <Box label={t('prefs.ai_url')} hint={t('prefs.ai_url_about')} type="url" spellcheck="false" placeholder={usual(a) || 'https://'} value={urlClean(m.aiUrl)} maxLength={400} save={saveUrl} data-raw data-staiurl />}
        {a && <div class="st-line"><span>{t('prefs.ai_opens')}</span><Segmented label={t('prefs.ai_opens')} value={m.aiOpen === 'tab' ? 'tab' : 'side'} onChange={v => meDrop(t('prefs.ai_step_open'), 'aiOpen', v === 'tab' ? 'tab' : '')}
          options={[{ value: 'side', label: t('prefs.ai_side') }, { value: 'tab', label: t('prefs.ai_tab') }]} /></div>}
        {link && <div><Button size="sm" onClick={() => openBeside(link, m.aiOpen === 'tab')} data-staiopen>{t('prefs.ai_open_now', { name: a })}</Button></div>}
      </div>
      {link && others.length > 0 && <div class="st-others" role="group" aria-label={t('prefs.ai_others')}><b>{t('prefs.ai_others')}</b>
        {others.map(n => <span data-raw data-stailist={n}><Checkbox label={n} checked={!off.has(n)} onChange={v => flip(n, v)} /></span>)}
        <p class="hint">{t('prefs.ai_others_about')}</p></div>}
      {link && <p class="hint">{t('prefs.ai_side_about')}</p>}
    </Card>
    <PlannerFolder />
    <Card title={t('prefs.see_h')} data-stsee>
      <p>{t('prefs.see_1')}</p>
      <p>{t('prefs.see_2')}</p>
      <p>{t('prefs.see_3')}</p>
      <p class="mute">{t('prefs.see_4')}</p>
      <div class="row gap"><a class="btn sm" href={href('settings', 'classes')} data-stmysetup>{t('prefs.mysetup_go')}</a><a class="btn sm quiet" href={href('help', 'privacy')}>{t('prefs.see_more')}</a></div>
    </Card>
  </>;
}

// The library's learning goals, as one undo step (src/goals.js goalsDlg finish): a removed goal is remembered as gone, so another
// computer removes it too, and it comes off whatever was tagged with it.
// edit(list) gives the new list from the goals as they are when the change is saved, so two changes made one after the other (a goal
// renamed, then the next one before the first has saved) both stay.
async function goalsPut(edit, label) {
  const W = await PARTS.write(), J2 = v => (v == null ? undefined : J(v));
  let before, after;
  const put = s => W.saveLibrary(l => { if (s.goals) l.goals = J(s.goals); else delete l.goals; if (s.gone) l.goalsGone = J(s.gone); else delete l.goalsGone; });
  await W.saveLibrary(l => {
    before = { goals: J2(l.goals), gone: J2(l.goalsGone) };
    const was = goalList(l), next = edit(was), now = Date.now(), gone = { ...(l.goalsGone || {}) };
    for (const g of was) if (!next.some(x => x.id === g.id)) gone[g.id] = now;
    after = { goals: next.length ? J(next) : undefined, gone: Object.keys(gone).length ? gone : undefined };
    if (after.goals) l.goals = J(after.goals); else delete l.goals;
    if (after.gone) l.goalsGone = J(after.gone); else delete l.goalsGone;
  });
  undoList.record({ label, undo: () => put(before), redo: () => put(after) });
}
const goalList = L => (Array.isArray(L.goals) ? L.goals.filter(g => g && g.id && String(g.name || '').trim()) : []);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function Goals() {
  const L = useLibrary(), list = goalList(L), [add, setAdd] = useState('');
  const tidy = v => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const twice = (l, id, v) => l.some(x => x.id !== id && x.name.toLowerCase() === v.toLowerCase());
  const rename = (g, v) => { v = tidy(v); if (!v || v === g.name) return; if (twice(list, g.id, v)) return toast(t('prefs.goal_twice')); goalsPut(l => (twice(l, g.id, v) ? l : l.map(x => (x.id === g.id ? { ...x, name: v, at: Date.now() } : x))), t('prefs.goal_step_name')); };
  const remove = g => { goalsPut(l => l.filter(x => x.id !== g.id), t('prefs.goal_step_rm')); toast(t('prefs.goal_gone', { name: g.name }), { undo: () => undoList.undo() }); };
  const up = g => goalsPut(l => { const n = l.slice(), i = n.findIndex(x => x.id === g.id); if (i > 0) [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; }, t('prefs.goal_step_move'));
  const plus = () => { const v = tidy(add); if (!v) return; setAdd(''); if (twice(list, '', v)) return toast(t('prefs.goal_twice')); goalsPut(l => (twice(l, '', v) ? l : [...l, { id: gid(), name: v, at: Date.now() }]), t('prefs.goal_step_add')); };
  return <Card title={t('prefs.goal_h')} data-stgoals>
    <p class="mute">{t(list.length ? 'prefs.goal_about' : 'prefs.goal_none')}</p>
    {list.length > 0 && <ol class="sg-cb">{list.map((g, i) => <li key={g.id} data-stgoal={g.id}>
      <Box label={t('prefs.goal_n', { n: i + 1 })} value={g.name} maxLength={80} save={v => rename(g, v)} data-raw />
      <IconButton icon="chu" label={t('prefs.goal_up')} disabled={i === 0} onClick={() => up(g)} />
      <IconButton icon="trash" label={t('prefs.goal_rm')} onClick={() => remove(g)} data-stgoalrm={g.id} /></li>)}</ol>}
    <div class="sg-cbadd"><TextInput label={t('prefs.goal_add')} value={add} maxLength={80} onInput={setAdd} onKeyDown={e => { if (e.key === 'Enter') plus(); }} data-raw data-stgoalnew /><Button onClick={plus} data-stgoaladd>{t('prefs.goal_add_btn')}</Button></div>
    {list.length > 0 && <p class="hint">{t('prefs.goal_tags')}</p>}
  </Card>;
}

// Settings > Grading: the programme (lib.me.prog, which My setup also brings in: an MYP teacher's new classes start with MYP criteria,
// src/ib.js classNewWay), how many places an average has, and her learning goals.
export function GradingMore() {
  const L = useLibrary(), m = meOf(L), [, again] = useState(0);
  const dp = (d => (d === 0 || d === 1 ? d : 2))(+prefs.get('gs.avgDp', 2));
  const saveProg = v => { v = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 24); change(t('prefs.prog_step'), me => { if (v) me.prog = v; else delete me.prog; }, v ? t('prefs.prog_done', { name: v }) : t('prefs.prog_none')); };
  return <>
    <Card title={t('prefs.prog_h')}>
      <Box label={t('prefs.prog_label')} hint={t('prefs.prog_about')} value={String(m.prog || '')} maxLength={24} save={saveProg} data-raw data-stprog />
    </Card>
    <Card title={t('prefs.dp_h')}>
      <p class="mute">{t('prefs.dp_about')}</p>
      <span data-stdp><Segmented label={t('prefs.dp_h')} value={String(dp)} onChange={v => { if (+v === 2) prefs.del('gs.avgDp'); else prefs.set('gs.avgDp', +v); again(n => n + 1); }}
        options={[{ value: '0', label: t('prefs.dp_0') }, { value: '1', label: t('prefs.dp_1') }, { value: '2', label: t('prefs.dp_2') }]} /></span>
    </Card>
    <Goals />
  </>;
}

// Settings > Marking: what handed-back files are called and how many there are (the Return box starts from these each time).
export function MarkingMore() {
  const [, again] = useState(0), re = () => again(n => n + 1);
  const on = k => prefs.get(k, true) !== false, set = (k, v) => { if (v) prefs.del(k); else prefs.set(k, false); re(); };
  const touch = prefs.get('gs.touch', 'auto');
  return <><Card title={t('prefs.back_h')}>
    <p class="mute">{t('prefs.back_about')}</p>
    <div class="st-col">
      <span data-stxnames><Switch label={t('prefs.back_names')} checked={on('gs.xnames')} onChange={v => set('gs.xnames', v)} /></span>
      <span data-stxone><Switch label={t('prefs.back_one')} checked={on('gs.xone')} onChange={v => set('gs.xone', v)} /></span>
      <span data-stcover><Switch label={t('prefs.back_cover')} checked={on('gs.anchorCover')} onChange={v => set('gs.anchorCover', v)} /></span>
    </div>
  </Card>
  {/* Tablet and pencil (src/touch.js, src/app.html setTouch): what a finger does on the paper, and the pencil's wider line (gs.touch, gs.press) */}
  <Card title={t('prefs.tch_h')}>
    <p class="mute">{t('prefs.tch_about')}</p>
    <span data-sttouch><Select label={t('prefs.tch_finger')} value={touch === 'move' || touch === 'draw' ? touch : 'auto'} onChange={v => { if (v === 'auto') prefs.del('gs.touch'); else prefs.set('gs.touch', v); re(); }}
      options={[{ value: 'auto', label: t('prefs.tch_auto') }, { value: 'move', label: t('prefs.tch_move') }, { value: 'draw', label: t('prefs.tch_draw') }]} /></span>
    <span data-stpress><Switch label={t('prefs.tch_press')} checked={on('gs.press')} onChange={v => set('gs.press', v)} /></span>
    <p class="hint">{t('prefs.tch_two')}</p>
  </Card></>;
}

// Settings > Classes: where students hand in work (lib.me.sys). Only words on screen: nothing is connected to it.
export function ClassesMore() {
  const L = useLibrary(), s = String(meOf(L).sys || '').trim(), known = SYS_LIST.includes(s), [other, setOther] = useState(!!s && !known);
  const save = v => { v = String(v || '').trim().slice(0, 40); if (v === s) return; change(t('prefs.sys_step'), me => { if (v) me.sys = v; else delete me.sys; }); };
  return <Card title={t('prefs.sys_h')}>
    <p class="mute">{t('prefs.sys_about')}</p>
    <span data-stsys><Select label={t('prefs.sys_h')} value={other ? 'other' : s} onChange={v => { if (v === 'other') { setOther(true); if (known || !s) save(t('prefs.sys_mine')); } else { setOther(false); save(v); } }}
      options={[{ value: '', label: t('prefs.sys_none') }, ...SYS_LIST.map(n => ({ value: n, label: n })), { value: 'other', label: t('prefs.sys_other') }]} data-raw /></span>
    {other && <Box label={t('prefs.sys_its_name')} value={s} maxLength={40} save={save} data-raw data-stsysother />}
  </Card>;
}
// The Planner folder's card loads on its own (PARTS.pfolder): it is on the planning side.
function PlannerFolder() {
  const [P, setP] = useState(null);
  useEffect(() => { PARTS.pfolder().then(setP); }, []);
  return P ? <P.FolderCard /> : null;
}
// My setup loads with its card (PARTS.mysetup): it brings the reading and the preview.
export function ClassesSetup() {
  const [P, setP] = useState(null);
  useEffect(() => { PARTS.mysetup().then(setP); }, []);
  return P ? <P.MySetup /> : null;
}

// Settings > Display: the app's text size, and full screen.
// The phone version on a computer: a narrow window of this app, with the same work (two windows share it as the current app's do).
const phoneWindow = () => { try { window.open(location.href.split('#')[0] + '#/', 'gsphone', 'popup,width=400,height=860'); } catch {} };
export function DisplayMore() {
  const [size, setSize] = useState(uiSize()), [full, setFull] = useState(fullOn());
  useEffect(() => { const f = () => setFull(fullOn()); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const pickSize = v => { v = +v; const d = { ...(prefs.get('gs.disp', null) || {}) }; if (v === 1) delete d.ui; else d.ui = v; prefs.set('gs.disp', d); applySize(v); setSize(v); };
  // Phone layout (gs.phone, as the current app keeps it): no key or 1 is on, 0 keeps a phone's page laid out as a computer's
  const [phone, setPhone] = useState(prefs.get('gs.phone', null) !== 0);
  const pickPhone = on => { if (on) prefs.del('gs.phone'); else prefs.set('gs.phone', 0); setPhone(on); toast(t('prefs.phone_next')); };
  const NAMES = { 0.9: 'prefs.size_s', 1: 'prefs.size_m', 1.15: 'prefs.size_l', 1.3: 'prefs.size_xl' };
  return <>
    <Card title={t('prefs.size_h')}>
      <p class="mute">{t('prefs.size_about')}</p>
      <span data-stsize><Segmented label={t('prefs.size_h')} value={String(size)} onChange={pickSize} options={SIZES.map(v => ({ value: String(v), label: t(NAMES[v]) }))} /></span>
    </Card>
    <Card title={t('prefs.phone_h')}>
      <p class="mute">{t('prefs.phone_about')}</p>
      <span data-stphone><Switch label={t('prefs.phone_on')} checked={phone} onChange={pickPhone} /></span>
      <p class="mute">{t('prefs.phone_try_about')}</p>
      <Button icon="phone" onClick={phoneWindow} data-stphonewin>{t('prefs.phone_try')}</Button>
    </Card>
    {fullCan() && <Card title={t('prefs.full_h')}>
      <p class="mute">{t('prefs.full_about')}</p>
      <Button onClick={fullToggle} aria-pressed={String(full)} data-stfull>{t(full ? 'prefs.full_leave' : 'prefs.full_go')}</Button>
    </Card>}
  </>;
}
