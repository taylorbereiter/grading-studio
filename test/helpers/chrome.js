// Finds the Chrome already installed on this computer (Windows, Mac or Linux) and starts it with a throwaway
// profile, so a test can never touch real saved work. Nothing is downloaded. CHROME_PATH overrides the search.
const fs = require('fs'), os = require('os'), path = require('path');
const puppeteer = require('puppeteer-core');

function chromeCandidates(platform = process.platform, env = process.env) {
  const out = env.CHROME_PATH ? [env.CHROME_PATH] : [];
  if (platform === 'win32') {
    for (const root of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA, 'C:\\Program Files', 'C:\\Program Files (x86)'])
      if (root) out.push(path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (platform === 'darwin') {
    const app = 'Google Chrome.app/Contents/MacOS/Google Chrome';
    out.push(path.posix.join('/Applications', app));
    if (env.HOME) out.push(path.posix.join(env.HOME, 'Applications', app));
  } else out.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return out;
}
function findChrome() {
  const list = chromeCandidates(), hit = list.find(p => fs.existsSync(p));
  if (!hit) throw new Error('Could not find Chrome. Looked in:\n  ' + list.join('\n  ') + '\nSet CHROME_PATH to where Chrome is installed.');
  return hit;
}
// userDataDir with keepProfile: closes and reopens the same throwaway profile, for a real browser restart.
async function launch({ userDataDir, keepProfile } = {}) {
  const dir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-profile-'));
  if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()))) throw new Error('Test profiles must live in the temp folder: ' + dir);
  const browser = await puppeteer.launch({
    executablePath: findChrome(), headless: true, userDataDir: dir, defaultViewport: { width: 1500, height: 950 },
    // Everything but this computer is unreachable: a test can't reach the live site or send anything anywhere.
    args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost', '--no-first-run', '--no-default-browser-check'],
  });
  const close = browser.close.bind(browser);
  browser.close = async () => {
    await close();
    if (!keepProfile) for (let i = 0; i < 5; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await new Promise(r => setTimeout(r, 300)); } }
  };
  browser.profileDir = dir;
  return browser;
}
module.exports = { chromeCandidates, findChrome, launch };
