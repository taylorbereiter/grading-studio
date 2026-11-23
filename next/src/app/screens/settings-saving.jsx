// Settings > Saving and sync (src/app.html setSaving, setGoogle; src/app/drive.js renderGoogle; src/folder.js whereSay, openWhere,
// folderGoBackAsk; src/migrate.js the safety copies list): where her work is saved, the linked folder and its dated copies, Google
// Drive sign-in and the sync, and this browser's safety copies. The controls are whole/'s, reached through services/saving.js.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button, Checkbox, Dialog, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { useSaving } from '../../services/saving.js';
import { sampleOn } from '../sample.js';
import { finish, over } from '../../shared/tabs.js';
import { Conflicts } from '../saving/conflicts.jsx';
import { CarryCard, YearCard } from '../saving/carry.jsx';
import { MoveCard } from '../saving/moving.jsx';
import './prefs-lines.js';
import '../saving/lines.js';

const STATE = { synced: 'prefs.sv_st_synced', syncing: 'prefs.sv_st_syncing', saving: 'prefs.sv_st_saving', not: 'prefs.sv_st_not', signin: 'prefs.sv_st_signin', away: 'prefs.sv_st_away', offline: 'prefs.sv_st_offline', papers_sending: 'prefs.sv_st_sending', papers_full: 'prefs.sv_st_full', papers_notsent: 'prefs.sv_st_notsent' };
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
// Use on your phone (src/phone.js phoneHowTo): a QR code of this page's own address, the steps to put it on a phone's Home Screen and
// sign in with the same account. The code is drawn here from the address (engines/gqr.js), so nothing is sent anywhere to make it.
export function PhoneHow({ onClose }) {
  const url = location.origin + location.pathname.replace(/index\.html$/, ''), [qr, setQr] = useState('');
  useEffect(() => { import('../../engines/gqr.js').then(m => setQr(m.qrSvg(url, t('prefs.ph_qr'))), () => {}); }, []);
  return <Dialog open title={t('prefs.ph_use')} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>{t('common.close')}</Button>}>
    <div class="phhow" data-phhow>{qr && <div class="phqr" dangerouslySetInnerHTML={{ __html: qr }} />}<p class="phurl" data-raw>{url}</p>
      <ol>{['prefs.ph_s1', 'prefs.ph_s2', 'prefs.ph_s3', 'prefs.ph_s4'].map(k => <li>{t(k)}</li>)}</ol>
      <p class="mute">{t('prefs.ph_unverified')}</p><p class="mute">{t('prefs.ph_then')}</p></div>
  </Dialog>;
}
const FAIL = { closed: 'prefs.sv_closed', offline: 'prefs.sv_offline', setup: 'prefs.sv_none' };
export function GoogleCard() {
  const S = useSaving(), [busy, setBusy] = useState(false), [how, setHow] = useState(false);
  if (!S) return null;
  const g = S.google();
  // Sync now stays pressable while a sync runs by itself (as in the current app): pressed then, one more round follows (whole/drive.js
  // syncNow). Turned off for that sync, a press in the moment it began was lost.
  const go = async f => { setBusy(true); try { await f(); } catch (e) { console.error(e); toast(t(FAIL[e && e.why] || 'prefs.sv_failed')); } finally { setBusy(false); } };
  const inn = () => go(async () => { const r = await S.signIn(); if (r === 'sample') toast(t('prefs.sv_sample')); else if (r && r !== 'setup') toast(t('prefs.sv_signed_toast', { email: r })); });
  const state = g.state ? t(STATE[g.state] || 'prefs.sv_st_synced') : g.at ? t('prefs.sv_st_synced') : '';
  return <Card title={t('prefs.sv_google_h')} data-svgoogle>{how && <PhoneHow onClose={() => setHow(false)} />}
    <p class="mute">{t('prefs.sv_google_about')}</p>
    {!g.can ? <p class="hint" data-svnog>{t('prefs.sv_none')}</p> : !g.email
      ? <Button variant="primary" disabled={busy} onClick={inn} data-svin>{t('prefs.sv_sign_in')}</Button>
      : <>
        <p data-svacct><span data-raw>{t('prefs.sv_signed', { email: g.email })}</span>{state && <> · <span data-svstate>{state}</span></>}</p>
        {g.at > 0 && <p class="hint" data-svat>{t('prefs.sv_last', { when: date(new Date(g.at), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>}
        <div class="row gap">
          {g.paused ? <Button variant="primary" disabled={busy} onClick={inn} data-svagain>{t('prefs.sv_again')}</Button>
            : <Button disabled={busy} onClick={() => go(() => S.syncNow())} data-svsync>{t('prefs.sv_sync_now')}</Button>}
          <Button variant="quiet" disabled={busy} onClick={() => { S.signOut(); toast(t('prefs.sv_out_toast')); }} data-svout>{t('prefs.sv_sign_out')}</Button>
          {!narrow() && <Button icon="phone" onClick={() => setHow(true)} data-gphone>{t('prefs.ph_use')}</Button>}
        </div>
        {!g.redirect && <><span data-svauto><Checkbox label={t('prefs.sv_auto')} checked={g.auto} onChange={v => { S.setAuto(v); if (v && g.paused) S.syncNow(); }} /></span>
          <p class="hint">{t('prefs.sv_auto_about')}</p></>}
      </>}
  </Card>;
}
// Home on a phone that isn't signed in, or that Google wants again (src/phone.js phSignRender): the one thing that brings her work here.
export function PhoneSign() {
  const S = useSaving(), [busy, setBusy] = useState(false);
  const g = S ? S.google() : {};
  if (!S || !g.can || (g.email && !g.paused)) return null;
  const inn = async () => { setBusy(true); try { await S.signIn(); } catch (e) { console.error(e); toast(t(FAIL[e && e.why] || 'prefs.sv_failed')); } finally { setBusy(false); } };
  return <div class="card pad phsign" data-phsign><b>{t(g.email ? 'prefs.ps_again_h' : 'prefs.ps_bring_h')}</b><p class="mute">{t(g.email ? 'prefs.ps_again' : 'prefs.ps_bring')}</p>
    <Button variant="primary" disabled={busy} onClick={inn} data-phsignin>{t(g.email ? 'prefs.ps_again_b' : 'prefs.ps_bring_b')}</Button></div>;
}
const at = v => date(new Date(v), { dateStyle: 'medium', timeStyle: 'short' });
// What every place that says where her work is says (src/folder.js whereSay). Until a folder or Drive holds a second copy, it says
// not backed up, in amber.
export function whereSay(S) {
  const f = S.folder(), g = S.google(), name = f.name;
  if (sampleOn()) return { safe: true, text: t('saving.w_sample'), tip: t('saving.w_sample_tip') };
  switch (f.state) {
    case 'ok': return { safe: true, text: t('saving.w_ok', { name }), tip: f.at ? t('saving.w_ok_at', { time: date(new Date(f.at), { hour: 'numeric', minute: '2-digit' }) }) : t('saving.w_ok_tip') };
    case 'saving': return { safe: true, text: f.prog ? t('saving.w_saving_n', { name, prog: f.prog }) : t('saving.w_saving', { name }), tip: t('saving.w_saving_tip') };
    case 'ask': return { warn: true, text: t('saving.w_ask', { name }), tip: t('saving.w_ask_tip'), act: 'reconnect' };
    case 'lost': return { warn: true, text: t(f.why === 'full' ? 'saving.w_full' : f.why === 'room' ? 'saving.w_room' : 'saving.w_lost', { name }), tip: t('saving.w_lost_tip') };
    case 'decide': return { safe: true, warn: true, text: t('saving.w_decide', { n: (f.asks || []).length }), tip: t('saving.w_decide_tip'), act: 'decide' };
    default: return !f.booted ? { safe: true, text: t('saving.w_checking'), tip: '' }
      : g.email ? { safe: true, text: t('saving.w_drive'), tip: t('saving.w_drive_tip') }
      : { warn: true, text: t('saving.w_none'), tip: t(f.canPick ? 'saving.w_none_tip' : 'saving.w_none_nopick') };
  }
}
// Replacing everything: the other windows finish and stop first, and this one reloads after (src/folder.js folderGoBackAsk).
async function replaceAll(fn) {
  try { await finish(); over('go'); await fn(); over('done'); toast(t('saving.reloading')); setTimeout(() => location.reload(), 700); }
  catch (e) { console.error(e); over('done'); toast(t('saving.hist_failed'), { ms: 15000 }); }
}
// Where your work is saved, and the linked folder (row 438).
export function FolderCard() {
  const S = useSaving(), [ask, setAsk] = useState(null), [busy, setBusy] = useState(false);
  if (!S || !S.folder) return null;
  const f = S.folder(), w = whereSay(S), linked = f.state !== 'none';
  const pick = async () => {
    setBusy(true);
    try { const st = await S.folderPick(); if (st === 'ok' || st === 'decide') toast(t('saving.f_done', { name: S.folder().name })); }
    catch (e) { if (!e || e.name !== 'AbortError') { console.error(e); toast(t('saving.f_bad')); } }
    finally { setBusy(false); }
  };
  const stop = async () => { setAsk(null); await S.folderStop(); toast(t('saving.f_stopped')); };
  const decided = ans => { setAsk(null); if (ans) S.folderDecide(ans); };
  return <Card title={t('saving.where_h')} data-svwhere>
    <p class={w.warn ? 'sv-warn' : ''} data-svsay={f.state}>{w.tip ? t('saving.w_line2', { text: w.text, tip: w.tip }) : t('saving.w_line', { text: w.text })}</p>
    {w.act === 'reconnect' && <p><Button variant="primary" onClick={() => S.folderResume()} data-svreconnect>{t('saving.reconnect')}</Button></p>}
    {w.act === 'decide' && <p><Button variant="primary" onClick={() => setAsk('decide')} data-svdecide>{t('saving.decide')}</Button></p>}
    {!sampleOn() && <>
      <p class="mute">{linked ? t('saving.f_linked_about') : t('saving.f_about')}{linked && f.root && f.root !== f.name ? ' ' + t('saving.f_inside', { root: f.root, name: f.name }) : ''}</p>
      <div class="row gap">
        {(linked || f.canPick) && <Button variant={linked ? 'plain' : 'primary'} disabled={busy || !f.canPick} onClick={pick} data-svpick>{t(linked ? 'saving.f_other' : 'saving.f_choose')}</Button>}
        {linked && <Button variant="quiet" onClick={() => setAsk('stop')} data-svstop>{t('saving.f_stop')}</Button>}
      </div></>}
    {ask === 'stop' && <Dialog open title={t('saving.f_stop_q', { name: f.name })} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={stop} data-ok>{t('saving.f_stop_ok')}</Button></>}><p>{t('saving.f_stop_text')}</p></Dialog>}
    {ask === 'decide' && <Conflicts asks={f.asks || []} onDone={decided} />}
  </Card>;
}
// Looking at one dated copy (src/safe.js gbLook, gbDetail, gbRestoreOne): how each assignment kept here stood then and stands now,
// Restore this assignment (how things are now is kept first, and Undo puts it back), and taking everything back from it (all, asked
// first by its card). m: { src: 'f', name, t } for the folder's, { src: 'b', id, t } for this browser's.
function Moment({ S, m, all, allLabel }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(false), [busy, setBusy] = useState(false);
  const read = () => S.goback().then(G => G.look(m)).then(r => { setRows(r); setErr(false); }, e => { console.error(e); setErr(true); });
  useEffect(() => { read(); }, []);
  const one = async r => {
    setBusy(true);
    try {
      const undo = await (await S.goback()).restoreOne(m, r.id);
      toast(t('saving.gb_done', { name: r.name, when: at(m.t) }), { undo: async () => { try { await undo(); toast(t('saving.gb_undone', { name: r.name })); } catch (e) { console.error(e); toast(t('saving.gb_undo_bad'), { ms: 9000 }); } read(); } });
      await read();
    } catch (e) { console.error(e); toast(t(e && e.name === 'QuotaExceededError' ? 'saving.gb_room' : 'saving.gb_failed'), { ms: 8000 }); }
    setBusy(false);
  };
  const cnt = (n, of) => (of ? t('saving.gb_of', { n, of }) : t('saving.gb_n', { n }));
  return <div class="sv-moment" data-svmoment>
    {err ? <p class="hint">{t('saving.gb_cant')}</p> : !rows ? <p class="hint">{t('saving.gb_reading')}</p>
      : !rows.length ? <p class="hint">{t('saving.gb_none')}</p>
      : <><p class="mute">{t('saving.gb_how', { when: at(m.t) })}</p><ul class="sv-list">{rows.map(r => { const same = !r.students && !r.set; return <li data-gbrow={r.id}>
        <span><b data-raw>{r.name || t('saving.gb_asg')}</b> <span class="mute">{same ? t('saving.gb_same') : t('saving.gb_then', { then: cnt(r.then, r.of), now: cnt(r.now, r.of) }) + ' · ' + (r.students ? t('saving.gb_diff', { n: r.students }) : t('saving.gb_setup'))}</span></span>
        {!same && <Button size="sm" disabled={busy} onClick={() => one(r)} data-gbone>{t('saving.gb_one')}</Button>}</li>; })}</ul></>}
    <p class="mute">{t('saving.gb_all')} <button type="button" class="link" onClick={all} data-gball>{allLabel}</button></p>
  </div>;
}
// One dated copy in a list, with Look and Close.
function MomentRow({ S, m, open, setOpen, when, why, all, allLabel, data }) {
  return <li {...data} class={open ? 'on' : ''}><span><b>{when}</b> {why}</span>
    <Button size="sm" aria-expanded={String(open)} onClick={() => setOpen(open ? null : m)} data-svlook>{t(open ? 'common.close' : 'saving.gb_look')}</Button>
    {open && <Moment S={S} m={m} all={all} allLabel={allLabel} />}</li>;
}
// Go back in time: the folder's dated copies (src/app.html #/settings/history).
export function HistoryCard() {
  const S = useSaving(), [list, setList] = useState(null), [ask, setAsk] = useState(null), [open, setOpen] = useState(null);
  const f = S && S.folder ? S.folder() : null, on = f && f.state !== 'none' && !!f.root;
  useEffect(() => { let live = true; if (on) S.snapList().then(l => live && setList(l), e => { console.error(e); live && setList([]); }); return () => { live = false; }; }, [on, f && f.at]);
  if (!f || sampleOn()) return null;
  const pick = async () => { try { await S.folderPick(); } catch (e) { if (!e || e.name !== 'AbortError') { console.error(e); toast(t('saving.f_bad')); } } };
  return <Card title={t('saving.hist_h')} data-svhist>
    <p class="mute">{on ? t('saving.hist_about') : t('saving.hist_nofolder')}</p>
    {!on && f.state === 'none' && f.canPick && <p><Button onClick={pick} data-svhistpick>{t('saving.f_choose')}</Button></p>}
    {on && list && !list.length && <p class="hint">{t('saving.hist_none')}</p>}
    {on && list && list.length > 0 && <ul class="sv-list">{list.map(s => { const m = { src: 'f', name: s.name, t: s.t }; return <MomentRow S={S} m={m} open={open && open.name === s.name} setOpen={setOpen} data={{ 'data-svsnap': s.name }}
      when={at(s.t)} why={<span class="mute">{s.why === 'daily' ? t('saving.hist_daily') : <span data-raw>{s.why}</span>}</span>} all={() => setAsk(s)} allLabel={t('saving.hist_go')} />; })}</ul>}
    {ask && <Dialog open title={t('saving.hist_q', { when: at(ask.t) })} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => { const n = ask.name; setAsk(null); replaceAll(() => S.goBack(n)); }} data-ok>{t('saving.hist_go')}</Button></>}><p>{t('saving.hist_text')}</p></Dialog>}
  </Card>;
}
// Safety copies in this browser (src/migrate.js snapshots, putBack): the newest three, made before anything risky.
export function SafetyCard() {
  const S = useSaving(), [list, setList] = useState(null), [ask, setAsk] = useState(null), [open, setOpen] = useState(null);
  useEffect(() => { let live = true; if (S && S.safetyList) S.safetyList().then(l => live && setList(l), e => { console.error(e); live && setList([]); }); return () => { live = false; }; }, [S]);
  if (!S || !S.safetyList || sampleOn()) return null;
  return <Card title={t('saving.safe_h')} data-svsafe>
    <p class="mute">{t('saving.safe_about')}</p>
    {list && !list.length && <p class="hint">{t('saving.safe_none')}</p>}
    {list && list.length > 0 && <ul class="sv-list">{list.map(c => { const m = { src: 'b', id: c.id, t: c.t }; return <MomentRow S={S} m={m} open={open && open.id === c.id} setOpen={setOpen} data={{ 'data-svcopy': c.id }}
      when={at(c.t)} why={<><span class="mute" data-raw>{c.why}</span>{c.app !== 'new app' && <span class="mute"> · {t('saving.safe_app_old')}</span>}</>} all={() => setAsk(c)} allLabel={t('saving.safe_put')} />; })}</ul>}
    {ask && <Dialog open title={t('saving.safe_q', { when: at(ask.t) })} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => { const id = ask.id; setAsk(null); replaceAll(() => S.putBack(id)); }} data-ok>{t('saving.safe_put')}</Button></>}><p>{t('saving.safe_text')}</p></Dialog>}
  </Card>;
}
// School year comes last: it is drawn once the year is read (a part loaded later), and above the others it moved them down under
// her pointer as it arrived.
export function SavingSettings() {
  return <><MoveCard /><FolderCard /><GoogleCard /><CarryCard /><HistoryCard /><SafetyCard /><YearCard /></>;
}
