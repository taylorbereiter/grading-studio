// The theme names and what the first load needs of the themes, apart from tokens.js so the first load doesn't bring every
// theme's colours (tokens.js THEMES, about 0.7 KB). next/test/tokens.test.js checks SWATCH and OCEAN_CLS match THEMES.
export const LOOKS = ['graphite', 'porcelain', 'ocean', 'ink', 'plum', 'midnight'];
export const DEFAULT_LOOK = 'graphite';
// Each theme's accent and page for its swatch, and Ocean's class colours (app/tone.js).
export const SWATCH = {"graphite":["#3F4CC0","#F5F6F8"],"porcelain":["#1F5E6A","#F8F7F5"],"ocean":["#1F6FB2","#F4F7FA"],"ink":["#1C1C1E","#F7F7F7"],"plum":["#6B3368","#F6F6F7"],"midnight":["#5865E8","#131518"]};
export const OCEAN_CLS = ["#7048C0","#1F6FB2","#0F7F86","#2E8540","#B5620E","#C23B6E","#7A5A3A","#56606C"];

