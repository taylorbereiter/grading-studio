// Saved things that belong to neither side: the linked folder and cached model files. (The teacher's own words, gs.words, are
// on the planning side since stage 2: planning/index.js words.)
// Either side may import this.
import { idbStore } from './records.js';
const D = 'shared';

export const folderHandle = idbStore(D, 'grading-studio-folder', 'kv');   // key "dir": a FileSystemDirectoryHandle
export const modelFiles = idbStore(D, 'grading-studio-models', 'files');
