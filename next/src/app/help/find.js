// Every Help answer in the command bar (src/help.js helpFindRows): loaded the first time the bar opens, each row opening its answer.
import { addCommand } from '../../services/commands.js';
import { t } from '../../i18n/t.js';
import { go } from '../router.js';
import { TOPICS } from './topics.js';
import './lines.js';

export function addHelpCommands() {
  for (const x of TOPICS) addCommand({ id: 'help-' + x.id, label: () => t(x.q), also: x.w ? t(x.w) : '', group: t('help.cmd_group'), icon: 'help', run: () => go('help', x.id) });
}
