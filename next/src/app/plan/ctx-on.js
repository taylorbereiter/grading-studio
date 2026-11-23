// A Planner screen's right-click (src/planner/extras.js: the contextmenu listener over the Planner): opens plan/ctx.jsx, loaded the
// first time. Shift + right-click and text boxes keep the browser's menu, as does anything that took the click already (a lesson
// card opens its own menu) or a sheet or the Beside drawer over the screen. o: { p, where: { k, v } } or a function returning it.
import { PARTS } from '../router.js';

export function planCtx(e, o) {
  const el = e.target, me = e.currentTarget, over = el.closest && el.closest('dialog,.beside');
  if (e.defaultPrevented || e.shiftKey || !el.closest || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (over && !over.contains(me))) return;
  e.preventDefault();
  const s = getSelection(), sel = s && !s.isCollapsed && me.contains(s.anchorNode) ? s.toString().trim() : '';
  const at = { x: e.clientX, y: e.clientY, el, sel };
  PARTS.ctx().then(m => m.open(at, typeof o === 'function' ? o() : o)).catch(err => console.error(err));
}
