// The new Grading Studio: a placeholder until the screens are built (stage 1 on). It only asks for the lock and says what it got,
// so a window of the new version can be tried beside the current one. It writes nothing.
import { h, render } from 'preact';
import { start, onLockChange, lockState } from './shared/lock.js';

const say = { writer: 'This window can save work.', 'writer-no-locks': 'This window can save work.', 'read-only': 'Grading Studio is open in another window, so this window only shows your work. Close the other window to work here.', taken: 'Another window took over, so this window only shows your work.', asking: 'Checking for other windows…', 'not-asked': '' };
function Page({ state }) {
  return h('main', { class: 'wrap' },
    h('h1', null, 'The new Grading Studio'),
    h('p', null, 'It is being built. Your work stays in the current app at the main address, and nothing here changes it.'),
    h('p', { class: 'state', 'data-lock': state, role: 'status' }, say[state] || ''));
}
const draw = () => render(h(Page, { state: lockState().state }), document.getElementById('app'));
onLockChange(draw); draw(); start();
