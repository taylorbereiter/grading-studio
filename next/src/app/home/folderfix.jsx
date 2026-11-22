// The linked folder needs a press, at the top of Home (src/folder.js folderBanner on Today): the browser asks again for permission
// (Reconnect, whole/folder.js folderResume), or the folder and this browser each changed the same work (Decide, the same box as
// Settings > Saving's, saving/conflicts.jsx). The words are Settings > Saving's own (saving lines).
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Icon } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { useSaving } from '../../services/saving.js';
import { Conflicts } from '../saving/conflicts.jsx';
import '../saving/lines.js';

export function FolderFix() {
  const S = useSaving(), [ask, setAsk] = useState(false), f = S && S.folder ? S.folder() : null;
  if (!f || (f.state !== 'ask' && f.state !== 'decide')) return null;
  const dec = f.state === 'decide';
  return <section class="card pad fask" data-home="folderfix" data-fix={f.state}><Icon name="warn" /><div>
    <h2>{dec ? t('saving.w_decide', { n: (f.asks || []).length }) : t('saving.w_ask', { name: f.name })}</h2><p>{t(dec ? 'saving.w_decide_tip' : 'saving.w_ask_tip')}</p>
    <div class="row gap">{dec ? <Button variant="primary" onClick={() => setAsk(true)} data-fix-decide>{t('saving.decide')}</Button>
      : <Button variant="primary" onClick={() => S.folderResume()} data-fix-reconnect>{t('saving.reconnect')}</Button>}</div></div>
    {ask && <Conflicts asks={f.asks || []} onDone={ans => { setAsk(false); if (ans) S.folderDecide(ans); }} />}
  </section>;
}
