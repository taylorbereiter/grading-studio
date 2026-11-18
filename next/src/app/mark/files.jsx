// The files on a paper that aren't pages or Word (src/app/bringin.js textCard and otherCard): a text file shown as its words, and any
// other file with the current app's plain words for why it can't be shown here (engines/greport.js troubleOf), with Download.
// Loaded as a part of its own (router.js PARTS.files) the first time such a file opens.
import { h, Fragment } from 'preact';
import { Button, Icon } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import * as R from '../../engines/greport.js';
import { PARTS } from '../router.js';
import './setup-lines.js';

const download = f => PARTS.outEngine().then(E => E.saveFile(f.name, new Blob([f.data])));
export function FileCard({ f }) {
  if (f.kind === 'text' && f.data) return <div class="docx" data-file={f.path}>
    <div class="fhead"><span class="nm" data-raw>{f.name}</span><span class="mute">{t('setup.f_text')}</span><span class="grow" /><Button size="sm" variant="quiet" onClick={() => download(f)}>{t('setup.wd_download')}</Button></div>
    <div class="dpage ftext" data-raw>{R.textOf(f)}</div></div>;
  const why = R.troubleText(R.troubleOf(f)) || t('setup.f_cant');
  return <div class="fcard other" data-file={f.path}><Icon name="file" />
    <div class="grow"><b data-raw>{f.name}</b><p>{why} {t('setup.f_score')}</p></div>
    {f.data && <Button size="sm" onClick={() => download(f)}>{t('setup.wd_download')}</Button>}</div>;
}
