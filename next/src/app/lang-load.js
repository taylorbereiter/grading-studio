// Each language's lines (next/lang/<code>.json, made from the current app's src/lang-*.js by next/tools/lang-convert.js), loaded
// only for a teacher who chose that language. English when one can't be fetched, as the current app does for that visit.
const LOAD = { 'zh-Hant': () => import('../../lang/zh-Hant.json'), 'zh-Hans': () => import('../../lang/zh-Hans.json'), es: () => import('../../lang/es.json'), fr: () => import('../../lang/fr.json'),
  de: () => import('../../lang/de.json'), 'pt-BR': () => import('../../lang/pt-BR.json'), ja: () => import('../../lang/ja.json'), ko: () => import('../../lang/ko.json') };
export const lines = async c => (LOAD[c] ? (await LOAD[c]()).default : {});
