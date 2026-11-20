// What a planning screen says when a save does not go through: this window is only reading (another window holds the writing
// lock), or the save was refused. The error itself goes to the console.
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { ReadOnly } from '../../shared/lock.js';
import './lines.js';

export function saveErrorMessage(e) {
  return e instanceof ReadOnly || e?.name === 'ReadOnly' ? t('plan.read_only') : t('plan.not_saved');
}

export function saveFailed(e) {
  console.error(e);
  toast(saveErrorMessage(e));
}
