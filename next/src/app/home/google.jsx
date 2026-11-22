// Google on Home's header (src/app/drive.js renderGoogle into .gAcct on Today): Sign in with Google, or "Google: email · sync state"
// with Sign in again, Sync now and Sign out one press away in its menu; and Use on your phone (src/phone.js phoneHowTo, the dialog is
// Settings > Saving's own, settings-saving.jsx PhoneHow). Nothing shows where this copy has no Google key.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, IconButton, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { useSaving } from '../../services/saving.js';
import '../screens/prefs-lines.js';

const STATE = { synced: 'prefs.sv_st_synced', syncing: 'prefs.sv_st_syncing', saving: 'prefs.sv_st_saving', not: 'prefs.sv_st_not', signin: 'prefs.sv_st_signin', away: 'prefs.sv_st_away', offline: 'prefs.sv_st_offline' };
const FAIL = { closed: 'prefs.sv_closed', offline: 'prefs.sv_offline', setup: 'prefs.sv_none' };
export function HomeGoogle() {
  const S = useSaving(), [How, setHow] = useState(null), [, bump] = useState(0);
  const g = S ? S.google() : {};
  if (!S || !g.can) return null;
  const run = async f => { try { await f(); } catch (e) { console.error(e); toast(t(FAIL[e && e.why] || 'prefs.sv_failed')); } bump(n => n + 1); };
  const inn = () => run(async () => { const r = await S.signIn(); if (r === 'sample') toast(t('prefs.sv_sample')); else if (r && r !== 'setup') toast(t('prefs.sv_signed_toast', { email: r })); });
  const phone = () => PARTS.setsave().then(m => setHow(() => m.PhoneHow), e => console.error(e));
  const state = g.state ? t(STATE[g.state] || 'prefs.sv_st_synced') : g.at ? t('prefs.sv_st_synced') : '';
  return <>
    {How && <How onClose={() => setHow(null)} />}
    {!g.email ? <Button onClick={inn} data-hg-in>{t('prefs.sv_sign_in')}</Button>
      : <Menu label={t('prefs.sv_google_h')} trigger={b => <Button {...b} variant="quiet" data-hg-acct><span data-raw>{t('prefs.sv_signed', { email: g.email })}</span>{state && <span class="mute"> · {state}</span>}</Button>}
        items={[g.paused ? { label: t('prefs.sv_again'), icon: 'redo', onSelect: inn } : { label: t('prefs.sv_sync_now'), icon: 'redo', onSelect: () => run(() => S.syncNow()) },
          { label: t('prefs.sv_sign_out'), icon: 'x', onSelect: () => { S.signOut(); toast(t('prefs.sv_out_toast')); bump(n => n + 1); } }]} />}
    <IconButton icon="phone" label={t('prefs.ph_use')} onClick={phone} data-gphone />
  </>;
}
