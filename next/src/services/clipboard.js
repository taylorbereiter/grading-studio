// The one copy to the clipboard that every screen uses: a transcript, typed notes, a Word paper's words, a sheet's text. The text goes
// to this computer's clipboard and nowhere else. Where the browser refuses the clipboard (an older Safari, a window without focus),
// a hidden text box is copied instead. Resolves true when the text was copied.
export async function copyText(text) {
  const s = String(text == null ? '' : text);
  try { await navigator.clipboard.writeText(s); return true; } catch {}
  const a = document.createElement('textarea');
  a.value = s; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(a); a.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  a.remove(); return ok;
}
