// pdf.js for the Beside drawer's Books (the teacher's own PDFs, kept in this browser as the current Planner keeps them). Loaded only
// when a book is opened (router.js PARTS.pdf), with its worker started from a blob: address, as the current Planner starts it.
import * as lib from 'pdfjs-dist/build/pdf.min.js';
import WORKER from 'pdfjs-worker-text';

const L = lib.getDocument ? lib : lib.default;
let url = null;
export function pdfjs() {
  if (!url) { url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })); L.GlobalWorkerOptions.workerSrc = url; }
  return L;
}
