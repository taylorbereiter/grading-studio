// What a planning screen says when a save does not go through: this window is only reading (another window holds the writing
// lock), or the save was refused. The error itself goes to the console.
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { ReadOnly } from '../../shared/lock.js';

export function saveFailed(e) {
  console.error(e);
  toast(e instanceof ReadOnly || (e && e.name === 'ReadOnly') ? t('plan.read_only') : t('plan.not_saved'));
}
