// An iPhone photo (.heic) takes a few seconds to decode the first time, so she is told it is being read (src/intake.js heicToPdf's
// "Reading an iPhone photo…"; H-039). The lifted code's own toast says nothing in the new app, so the places that read files say it.
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import './inout-lines.js';

let shown = 0;
export function heicSay(paths) {
  if (![].concat(paths).some(p => /\.(heic|heif)$/i.test(p || '')) || Date.now() - shown < 4000) return;
  shown = Date.now(); toast(t('inout.heic_reading'), { ms: 4000 });
}
