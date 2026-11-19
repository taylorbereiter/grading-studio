// The videos folder Google's chooser opens in, and Change folder (src/video.js vdDirLine, pickVidDir): beside Choose in Drive… in
// Add, A video (D-036) and in Partners and videos (D-007). Nothing until a folder is chosen (the chooser asks for one the first time).
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Icon, toast } from '../../ui/index.js';
import { saving } from '../../services/saving.js';
import { t } from '../../i18n/t.js';
import './setup-lines.js';
import './video-lines.js';

export function VidDir() {
  const S = saving(), [, again] = useState(0), dir = S && S.vidDir && S.vidDir();
  if (!dir || !dir.name) return null;
  const change = async () => { try { if (await S.vidPickDir()) again(n => n + 1); } catch (e) { console.error(e); toast(t('setup.v_fail', { why: (e && e.message) || String(e) })); } };
  return <span class="mute vddir"><span title={t('video.drive')}><Icon name="folder" /> <span data-raw>{dir.name}</span></span> <button type="button" class="link" onClick={change} data-vddir>{t('video.drv_dir_change')}</button></span>;
}
