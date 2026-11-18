// Which download the marking screen has open in this tab (set by mark/open.js), so a screen that doesn't load the marking code,
// such as Library > Examples, can tell whether "Make again from the paper" can be offered. The Drive sync and the linked folder
// read it too: the download open on screen keeps what is there, and its save waiting to go is written before a sync reads.
let id = null, held = null, flush = null;
export const setOpenWork = (v, batch) => { id = v || null; held = id && batch ? batch : null; };
export const openWork = () => id;
export const openHold = () => held;
export const setOpenFlush = f => { flush = f; };
export const flushOpen = () => (id && flush ? flush() : Promise.resolve());
