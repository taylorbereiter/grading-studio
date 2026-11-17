/* ================= Planner: files from Google Drive =================
   The Planner signs in to Google on its own (it has none of Grading Studio's code), only for the files picked in Google's chooser
   (drive.file). It uses the key Grading Studio got in this tab when there is one (the two pages share a tab), else asks Google with
   the account Grading Studio signed in with. Shown only once Google is set up in Grading Studio, and not on an iPhone or iPad (there
   Google's sign-in leaves the page). The chooser and the downloads are src/gpick.js. */
const PL_GCID = '/*@@GCID@@*/', PL_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const plLs = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const plGcid = () => (/apps\.googleusercontent\.com$/.test(PL_GCID) ? PL_GCID : '') || plLs('gs.gcid') || '';
const PL_IOS = navigator.standalone === true || /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const plTok = () => { try { const k = JSON.parse(sessionStorage.getItem('gs.gTok')); return k && k.exp > Date.now() + 60000 && (k.scope || '').split(' ').includes(PL_SCOPE) ? k : null; } catch { return null; } };
let plGis = null;
const plLoadGis = () => plGis || (plGis = new Promise((res, rej) => { if (window.google && google.accounts && google.accounts.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { plGis = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); }; document.head.appendChild(s); }));
function plToken() {
  const k = plTok(); if (k) return Promise.resolve(k.t);
  return plLoadGis()
    .then(() => new Promise((res, rej) => {
      google.accounts.oauth2.initTokenClient({
        client_id: plGcid(), scope: PL_SCOPE + ' https://www.googleapis.com/auth/drive.appdata', hint: plLs('gs.gEmail') || undefined, include_granted_scopes: true,
        callback: r => { if (r.error) return rej(new Error(r.error)); try { sessionStorage.setItem('gs.gTok', JSON.stringify({ t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000, scope: r.scope || PL_SCOPE })); } catch { } res(r.access_token); },
        error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in didn’t finish')),
      }).requestAccessToken({ prompt: '' });
    }));
}
async function plGet(u) {
  const r = await fetch('https://www.googleapis.com/drive/v3/' + u, { headers: { Authorization: 'Bearer ' + await plToken() } });
  if (r.status === 401) try { sessionStorage.removeItem('gs.gTok'); } catch { }
  if (!r.ok) throw new Error('Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]);
  return r;
}
const gpHost = () => /^https?:$/.test(location.protocol) && window.self === window.top && plGcid() && plLs('gs.gEmail') && (!PL_IOS || plTok())
  ? { office: true, pick: async o => gpPick(await plToken(), plGcid(), '', o), get: plGet, say: m => toast(m, 6000) } : null;
// Loaded ahead, so Google's sign-in window opens straight from the press.
if (gpHost() && !plTok()) setTimeout(() => plLoadGis().catch(() => { }), 3000);
