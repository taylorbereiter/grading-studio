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
import './prefs-lines.js';
import '../saving/lines.js';

const STATE = { synced: 'prefs.sv_st_synced', syncing: 'prefs.sv_st_syncing', saving: 'prefs.sv_st_saving', not: 'prefs.sv_st_not', signin: 'prefs.sv_st_signin', away: 'prefs.sv_st_away', offline: 'prefs.sv_st_offline', papers_sending: 'prefs.sv_st_sending', papers_full: 'prefs.sv_st_full', papers_notsent: 'prefs.sv_st_notsent' };
const FAIL = { closed: 'prefs.sv_closed', offline: 'prefs.sv_offline', setup: 'prefs.sv_none' };
export function GoogleCard() {
  const S = useSaving(), [busy, setBusy] = useState(false);
  if (!S) return null;
  const g = S.google();
  const go = async f => { setBusy(true); try { await f(); } catch (e) { console.error(e); toast(t(FAIL[e && e.why] || 'prefs.sv_failed')); } finally { setBusy(false); } };
  const inn = () => go(async () => { const r = await S.signIn(); if (r === 'sample') toast(t('prefs.sv_sample')); else if (r && r !== 'setup') toast(t('prefs.sv_signed_toast', { email: r })); });
  const state = g.state ? t(STATE[g.state] || 'prefs.sv_st_synced') : g.at ? t('prefs.sv_st_synced') : '';
  return <Card title={t('prefs.sv_google_h')} data-svgoogle>
    <p class="mute">{t('prefs.sv_google_about')}</p>
    {!g.can ? <p class="hint" data-svnog>{t('prefs.sv_none')}</p> : !g.email
      ? <Button variant="primary" disabled={busy} onClick={inn} data-svin>{t('prefs.sv_sign_in')}</Button>
      : <>
        <p data-svacct><span data-raw>{t('prefs.sv_signed', { email: g.email })}</span>{state && <> · <span data-svstate>{state}</span></>}</p>
        {g.at > 0 && <p class="hint" data-svat>{t('prefs.sv_last', { when: date(new Date(g.at), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>}
        <div class="row gap">
          {g.paused ? <Button variant="primary" disabled={busy} onClick={inn} data-svagain>{t('prefs.sv_again')}</Button>
            : <Button disabled={busy || g.state === 'syncing'} onClick={() => go(() => S.syncNow())} data-svsync>{t('prefs.sv_sync_now')}</Button>}
          <Button variant="quiet" disabled={busy} onClick={() => { S.signOut(); toast(t('prefs.sv_out_toast')); }} data-svout>{t('prefs.sv_sign_out')}</Button>
        </div>
        {!g.redirect && <><span data-svauto><Checkbox label={t('prefs.sv_auto')} checked={g.auto} onChange={v => { S.setAuto(v); if (v && g.paused) S.syncNow(); }} /></span>
          <p class="hint">{t('prefs.sv_auto_about')}</p></>}
      </>}
  </Card>;
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
    <p class={w.warn ? 'sv-warn' : ''} data-svsay={f.state}>{w.text}{w.tip ? '. ' + w.tip + '.' : '.'}</p>
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
// Go back in time: the folder's dated copies (src/app.html #/settings/history).
export function HistoryCard() {
  const S = useSaving(), [list, setList] = useState(null), [ask, setAsk] = useState(null);
  const f = S && S.folder ? S.folder() : null, on = f && f.state !== 'none' && !!f.root;
  useEffect(() => { let live = true; if (on) S.snapList().then(l => live && setList(l), e => { console.error(e); live && setList([]); }); return () => { live = false; }; }, [on, f && f.at]);
  if (!f || sampleOn()) return null;
  return <Card title={t('saving.hist_h')} data-svhist>
    <p class="mute">{on ? t('saving.hist_about') : t('saving.hist_nofolder')}</p>
    {on && list && !list.length && <p class="hint">{t('saving.hist_none')}</p>}
    {on && list && list.length > 0 && <ul class="sv-list">{list.map(s => <li data-svsnap={s.name}>
      <span><b>{at(s.t)}</b> <span class="mute">{s.why === 'daily' ? t('saving.hist_daily') : <span data-raw>{s.why}</span>}</span></span>
      <Button size="sm" onClick={() => setAsk(s)} data-svback>{t('saving.hist_go')}</Button></li>)}</ul>}
    {ask && <Dialog open title={t('saving.hist_q', { when: at(ask.t) })} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => { const n = ask.name; setAsk(null); replaceAll(() => S.goBack(n)); }} data-ok>{t('saving.hist_go')}</Button></>}><p>{t('saving.hist_text')}</p></Dialog>}
  </Card>;
}
// Safety copies in this browser (src/migrate.js snapshots, putBack): the newest three, made before anything risky.
export function SafetyCard() {
  const S = useSaving(), [list, setList] = useState(null), [ask, setAsk] = useState(null);
  useEffect(() => { let live = true; if (S && S.safetyList) S.safetyList().then(l => live && setList(l), e => { console.error(e); live && setList([]); }); return () => { live = false; }; }, [S]);
  if (!S || !S.safetyList || sampleOn()) return null;
  return <Card title={t('saving.safe_h')} data-svsafe>
    <p class="mute">{t('saving.safe_about')}</p>
    {list && !list.length && <p class="hint">{t('saving.safe_none')}</p>}
    {list && list.length > 0 && <ul class="sv-list">{list.map(c => <li data-svcopy={c.id}>
      <span><b>{at(c.t)}</b> <span class="mute" data-raw>{c.why}</span>{c.app !== 'new app' && <span class="mute"> · {t('saving.safe_app_old')}</span>}</span>
      <Button size="sm" onClick={() => setAsk(c)} data-svput>{t('saving.safe_put')}</Button></li>)}</ul>}
    {ask && <Dialog open title={t('saving.safe_q', { when: at(ask.t) })} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => { const id = ask.id; setAsk(null); replaceAll(() => S.putBack(id)); }} data-ok>{t('saving.safe_put')}</Button></>}><p>{t('saving.safe_text')}</p></Dialog>}
  </Card>;
}
export function SavingSettings() {
  return <><FolderCard /><GoogleCard /><HistoryCard /><SafetyCard /></>;
}
