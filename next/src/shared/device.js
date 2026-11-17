// Saved things that belong to neither side: the teacher's own words, the linked folder, and cached model files.
// Either side may import this.
import { idbStore, localKey } from './records.js';
const D = 'shared';

export const words = localKey(D, 'gs.words');
export const folderHandle = idbStore(D, 'grading-studio-folder', 'kv');   // key "dir": a FileSystemDirectoryHandle
export const modelFiles = idbStore(D, 'grading-studio-models', 'files');
