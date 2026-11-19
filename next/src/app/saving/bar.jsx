// The red bar (src/saving.js saveBar): on every screen, for as long as any download's work didn't save. It says what happened and
// what to do, with Try again and Export what I have (that assignment's Return tab, where everything marked can be saved as files).
// When the last one saves, it goes, and says so once. Loaded by the shell only when there is trouble (router.js PARTS.savebar).
import { h } from 'preact';
import { Icon, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go } from '../router.js';
import { troubles, onTrouble, retryAll, recovered } from './trouble.js';
import './lines.js';

onTrouble(() => { if (recovered()) toast(t('saving.bad_over')); });
export function SaveBar() {
  const list = troubles(); if (!list.length) return null;
  const lost = list.some(x => !x.quick);
  return <div class="strip bad" role="alert" data-savebar={lost ? 'not' : 'partly'}><Icon name="warn" />
    <span>{t(lost ? 'saving.bad_not' : 'saving.bad_partly')} {t('saving.bad_how')}</span>
    <span class="row gap sbacts"><button type="button" class="btn sm" onClick={() => retryAll()} data-saveretry>{t('saving.bad_retry')}</button>
      <button type="button" class="btn sm" onClick={() => go('mark', list[0].id, 'return')} data-savehelp>{t('saving.bad_export')}</button></span></div>;
}
