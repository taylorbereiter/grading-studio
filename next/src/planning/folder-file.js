// JSON files are also editable outside the Planner. Overwrite an existing file
// only if it still matches a revision we read or just wrote. Make that check
// again after opening the output stream, before committing its temporary bytes.
export class FolderFileChanged extends Error {
  constructor(name) { super('Planner folder file changed: ' + name); this.fileName = name; }
}

export async function existingFile(dir, name) {
  try { return await (await dir.getFileHandle(name)).getFile(); }
  catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
}

export async function writeRecordFile(dir, name, text, ...known) {
  const original = await existingFile(dir, name);
  const before = original ? await original.text() : '';
  if (original && original.size) {
    if (before === text) return original.lastModified;
    if (!known.some(r => r && r._file === name && r._mod === original.lastModified)) {
      throw new FolderFileChanged(name);
    }
  }
  const handle = await dir.getFileHandle(name, { create: true });
  return replaceFileText(handle, before, text);
}

// Patch the same bytes the importer actually read, including a second check before the stream commits.
export async function replaceFileText(handle, before, text) {
  const writer = await handle.createWritable({ mode: 'exclusive' });
  try {
    const unchanged = async () => {
      if (await (await handle.getFile()).text() !== before) throw new FolderFileChanged(handle.name);
    };
    await unchanged();
    await writer.write(text);
    await unchanged();
    await writer.close();
  } catch (error) {
    try { await writer.abort(); } catch {}
    throw error;
  }
  return (await handle.getFile()).lastModified;
}

// A newer file under an old name belongs to its editor. A stale export can
// remove only the file revision it knows about, with the same record identity.
export async function removeRecordFile(dir, record) {
  if (!record?._file || !record._mod) return;
  const file = await existingFile(dir, record._file);
  if (!file || file.lastModified !== record._mod) return;
  const text = await file.text();
  let id;
  try { id = JSON.parse(text).id; } catch { return; }
  if (id && id !== record.id) return;
  try { await dir.removeEntry(record._file); return true; }
  catch (e) { if (e.name !== 'NotFoundError') throw e; }
}
