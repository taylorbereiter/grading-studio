// A book's index row and PDF bytes belong to the same transaction in the classic Planner's kv store.
import { changePlannerRecord } from './change.js';
import { tell } from './write.js';
import { saved } from '../shared/saved.js';

async function editBooks(edit, blobId, removed = false) {
  const changed = await changePlannerRecord('kv', 'pdfs', (list, objects) => {
    if (list !== undefined && !Array.isArray(list)) throw new Error('Unreadable Planner book list');
    return edit(list || [], objects);
  });
  if (changed === undefined) return;
  tell('gs-plan-out');
  if (blobId) saved({ kind: 'plan', id: 'pdf:' + blobId, side: 'planning', gone: removed });
  saved({ kind: 'plan', id: 'pdfs', side: 'planning' });
}

export async function addBook(file) {
  const id = crypto.randomUUID();
  await editBooks((list, objects) => {
    if (list.some(book => book.id === id)) throw new Error('Book identifier already in use');
    objects.add(file, 'pdf:' + id);
    return [...list, { id, name: file.name.replace(/\.pdf$/i, ''), size: file.size, added: Date.now(), pages: 0 }];
  }, id);
}

export async function removeBook(id) {
  let removed;
  await editBooks((list, objects) => {
    const at = list.findIndex(book => book.id === id);
    if (at === -1) return;
    const bytes = objects.get('pdf:' + id);
    removed = { book: list[at], at, before: list[at + 1]?.id, after: list[at - 1]?.id };
    bytes.onsuccess = () => { removed.blob = bytes.result; };
    objects.delete('pdf:' + id);
    return list.filter(book => book.id !== id);
  }, id, true);
  return removed;
}

export function restoreBook({ book, blob, at, before, after }) {
  return editBooks((list, objects) => {
    if (list.some(item => item.id === book.id)) return;
    if (blob !== undefined) objects.add(blob, 'pdf:' + book.id);
    const next = list.findIndex(item => item.id === before);
    const prev = list.findIndex(item => item.id === after);
    const pos = next >= 0 ? next : prev >= 0 ? prev + 1 : Math.min(at, list.length);
    list.splice(pos, 0, book);
    return list;
  }, book.id);
}

export function saveBookPages(id, pages) {
  return editBooks(list => {
    const book = list.find(item => item.id === id);
    if (!book || book.pages) return;
    book.pages = pages;
    return list;
  });
}
