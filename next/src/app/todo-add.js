// The N key (src/todo.js tdFocusAdd): from anywhere outside a paper, To do opens with its box ready to type in. The shell asks, the
// To do screen takes the ask when it is drawn (or hears it when it is already open). No saved work is read or written here.
let want = false;
const told = new Set();
export function askAdd() { want = true; told.forEach(f => f()); }
export function takeAdd() { const w = want; want = false; return w; }
export function onAdd(f) { const g = () => { want = false; f(); }; told.add(g); return () => told.delete(g); }
// A School person's to-dos (src/school.js todoShowPerson, todoForPerson): To do opens showing only the lines that name them.
let person = '';
export function askPerson(id) { person = String(id || ''); }
export function takePerson() { const p = person; person = ''; return p; }
