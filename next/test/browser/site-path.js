// The tests' servers keep the addresses they had before the switch: the previous version at / and the new app at /next/. On disk the
// new app is at the root of the repository now and the previous version in classic/; this maps one to the other.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..'), CLASSIC = path.join(ROOT, 'classic');
const CLASSIC_PAGE = /^\/(index\.html|planner\.html|sw\.js|version\.json|sample\.js|lang\/[\w-]+\.js)$/;
function onDisk(p) {
  if (p.startsWith('/next/classic/')) return path.join(CLASSIC, p.slice('/next/classic/'.length));
  if (p.startsWith('/next/')) return path.join(ROOT, p.slice('/next/'.length));
  if (CLASSIC_PAGE.test(p)) return path.join(CLASSIC, p.slice(1));
  return path.join(ROOT, p.slice(1));
}
// What the new app at /next/ asks for beyond its page and code: the install card and the icons, the Planner's old page, and the
// previous version's files (the sample's classes; the language files during the handover).
onDisk.extra = p => /^\/next\/(manifest\.webmanifest|planner\.html|icons\/[\w-]+\.png|classic\/(sample\.js|lang\/[\w-]+\.js))$/.test(p);
module.exports = onDisk;
