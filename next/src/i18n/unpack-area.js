// next/build.js packs each language area in sorted English key order. Keep missing entries absent so the
// caller can fall back to English, including when it is preparing a quiz in a different language.
export function unpackArea(english, values, locale) {
  const translated = {};
  const keys = Object.keys(english).sort();
  for (let i = 0; i < keys.length; i++) {
    if (values[i] !== null) translated[keys[i]] = values[i];
  }
  if (locale) translated['@locale'] = locale;
  return translated;
}
