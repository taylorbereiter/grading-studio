// Where the current app's built pages are. Since the switch the new app has the main address and the current app (the previous
// version) is built to classic/ (build.js), so its tests read and serve its pages from there. GS_BASE names another folder, relative
// to the repository, for example "." to test an older build that still had them at the root.
const path = require('path');
module.exports = path.join(__dirname, '..', '..', process.env.GS_BASE || 'classic');
