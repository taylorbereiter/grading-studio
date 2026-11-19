const held = Symbol('Planner folder operation');
let queue = Promise.resolve();

// Import sometimes normalizes a file by exporting it again. It passes its token
// to that write so the whole scan and its nested writes share the same lock.
export function withFolderLock(action, token) {
  if (token === held) return action(held);
  if (navigator.locks) return navigator.locks.request('gs-planner-folder', () => action(held));
  const next = queue.then(() => action(held));
  queue = next.catch(() => {});
  return next;
}
