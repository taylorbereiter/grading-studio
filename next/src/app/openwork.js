// Which download the marking screen has open in this tab (set by mark/open.js), so a screen that doesn't load the marking code,
// such as Library > Examples, can tell whether "Make again from the paper" can be offered.
let id = null;
export const setOpenWork = v => { id = v || null; };
export const openWork = () => id;
