// A class's link to its page in the school's system, in the class header (src/app/screens.js mbLink, askMb): the link when there is
// one, with a way to change it, or a way to add one. Named for her system (Settings > Classes), or "Class page".
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, IconButton, Dialog, TextInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { useBook } from './data.js';
import { classIn, classLink, setClassLink, linkUrl } from '../../students/book.js';
import './lines.js';

export function ClassLink({ classId }) {
  const b = useBook(), [edit, setEdit] = useState(false);
  const c = b && !b.error ? classIn(b.lib, classId) : null; if (!c) return null;
  const sys = String((b.lib.me || {}).sys || '').trim(), what = sys || t('class.cl_page'), url = classLink(c);
  return <>
    {url ? <span class="row gap-s" data-clink><a class="btn sm" href={url} target="_blank" rel="noopener" data-clink-go><span data-raw={sys ? '' : undefined}>{what}</span> ↗</a>
      <IconButton size="sm" icon="edit" label={t('class.cl_change', { what })} onClick={() => setEdit(true)} data-clink-edit /></span>
      : <Button size="sm" variant="quiet" icon="link" onClick={() => setEdit(true)} data-clink-add>{t('class.cl_add', { what })}</Button>}
    {edit && <LinkDialog c={c} sys={sys} url={url} onClose={() => setEdit(false)} />}
  </>;
}
function LinkDialog({ c, sys, url, onClose }) {
  const [v, setV] = useState(url);
  const save = async () => {
    const u = linkUrl(v); if (v.trim() && !u) { toast(t('class.cl_bad')); return; }
    await setClassLink(t('class.u_link'), c.id, u); onClose();
  };
  return <Dialog open title={sys ? t('class.cl_ask_sys', { sys, name: c.name }) : t('class.cl_ask', { name: c.name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-clink-save>{t('class.save')}</Button></>}>
    <TextInput label={t('class.cl_label')} hint={t('class.cl_hint')} value={v} maxLength={500} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-clink-url autoFocus /></Dialog>;
}

