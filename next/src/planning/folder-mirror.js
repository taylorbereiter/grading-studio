import { FolderFileChanged, removeRecordFile } from './folder-file.js';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A database edit can also come from the classic Planner, which does not take
// our Web Lock. After the file write, acknowledge the exact source revision
// in one DB transaction. If the revision moved, mirror the latest version.
export async function mirrorRecord(id, previous, dir, read, acknowledge, write, cleanup = removeRecordFile) {
  const files = new Map();
  const remember = r => { if (r?._file) files.set(r._file, r); };
  remember(previous);
  let stored = await read(id);
  while (stored) {
    remember(stored);
    let written;
    try {
      written = await write(stored, previous);
    } catch (e) {
      if (!(e instanceof FolderFileChanged)) throw e;
      const current = await read(id);
      if (same(current, stored)) throw e;
      stored = current;
      continue;
    }
    remember(written);
    if (await acknowledge(id, stored, written)) {
      files.delete(written._file);
      for (const record of files.values()) await cleanup(dir, record, written);
      return written;
    }
    previous = written;
    stored = await read(id);
  }
  for (const record of files.values()) await cleanup(dir, record);
  return null;
}

// Recheck the collection after I/O so an edit, deletion or addition elsewhere
// in the collection also reaches the folder. Only changed records need I/O.
export async function mirrorCollection(before, all, one, force) {
  const known = new Map(before.map(r => [r.id, r]));
  for (;;) {
    const current = new Map((await all()).map(r => [r.id, r]));
    let changed = false;
    for (const id of new Set([...known.keys(), ...current.keys()])) {
      const previous = known.get(id), now = current.get(id);
      if (!force && now?._file && same(previous, now)) continue;
      const result = await one(id, previous);
      if (result) known.set(id, result); else known.delete(id);
      changed = true;
    }
    if (!changed) return [...known.values()];
    force = false;
  }
}
