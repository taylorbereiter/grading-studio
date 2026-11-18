// Reading iPhone photos (HEIC) where the browser can't: libheif-js, the decoder the current app carries in its page (src/intake.js
// heicLoad). Here it is a chunk of its own, about 714 KB squeezed, that gcore's heicLoad imports the first time an HEIC picture is
// read, and never before. Taylor allowed it its own size line (next/budgets.json heic) on 18 Nov 2026.
import libheif from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import LICENSE from './heic-license.js';

let lib = null;
export const heic = () => (lib ||= libheif());
export { LICENSE };
// pdf-lib, which the photo's page is made with, for when the screen hasn't loaded it yet
export const pdflib = () => import('pdf-lib');
