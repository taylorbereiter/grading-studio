// The videos folder Google's chooser opens in, and Change folder (src/video.js vdDirLine, pickVidDir): beside Choose in Drive… in
// Add, A video (D-036) and in Partners and videos (D-007). Nothing until a folder is chosen (the chooser asks for one the first time).
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon, toast } from '../../ui/index.js';
import { saving } from '../../services/saving.js';
import { t } from '../../i18n/t.js';
import './setup-lines.js';
import './video-lines.js';

export function VidDir() {
  // the folder's id and name, as src/video.js keeps them, asked of the video part (whole/stream.js) when shown and after a change
  const S = saving(), [, again] = useState(0), [dir, setDir] = useState(null);
  // each time the box draws, so a folder first chosen by Choose in Drive… shows too; set only when it changed
  useEffect(() => { if (S && S.vidPick) S.vidPick({ now: true }).then(d => setDir(o => (o && d && o.id === d.id && o.name === d.name) || o === d ? o : d), e => console.error(e)); });
  if (!dir || !dir.name) return null;
  const change = async () => { try { if (await S.vidPick({ dir: true })) again(n => n + 1); } catch (e) { console.error(e); toast(t('setup.v_fail', { why: (e && e.message) || String(e) })); } };
  return <span class="mute vddir"><span title={t('video.drive')}><Icon name="folder" /> <span data-raw>{dir.name}</span></span> <button type="button" class="link" onClick={change} data-vddir>{t('video.drv_dir_change')}</button></span>;
}
