import { writeRecordFile } from './folder-file.js';

export async function retainFolderCopy(dir, base, suffix, text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hash = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  const name = base.slice(0, 32) + ' - ' + hash + suffix;
  const recovered = await dir.getDirectoryHandle('Recovered', { create: true });
  // Both Planners skip the Recovered subdirectory. A retry can reuse
  // the same bytes, but must never overwrite a different recovery document.
  await writeRecordFile(recovered, name, text);
  const saved = await (await recovered.getFileHandle(name)).getFile();
  const readback = new Uint8Array(await saved.arrayBuffer());
  if (bytes.length !== readback.length || !bytes.every((b, i) => b === readback[i])) {
    throw new Error('Planner recovery file could not be verified');
  }
}
