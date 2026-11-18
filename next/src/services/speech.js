// Dictation: the browser's own speech recognition, where it has one. No dead buttons: where there is none, hasSpeech() is false
// and the mic is not drawn at all. Nothing is sent anywhere by the app; the browser does the listening.
export const speechCtor = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
export const hasSpeech = () => !!speechCtor();
// Starts listening. onText(final, interim) is called as words arrive; onEnd when it stops (by itself, by stop(), or on an error).
export function listen({ lang, onText, onEnd }) {
  const C = speechCtor(); if (!C) return null;
  const r = new C(); r.lang = lang || document.documentElement.lang || 'en'; r.interimResults = true; r.continuous = true;
  r.onresult = e => { let fin = '', mid = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else mid += x[0].transcript; } onText && onText(fin, mid); };
  r.onerror = e => { onEnd && onEnd(e.error || 'error'); };
  r.onend = () => onEnd && onEnd(null);
  try { r.start(); } catch { return null; }
  return { stop: () => { try { r.stop(); } catch {} } };
}
