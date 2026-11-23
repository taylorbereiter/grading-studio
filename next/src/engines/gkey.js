// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */


// src/stamps.js
const PROOF = [
  ['gr', 'Grammar'], ['cap', 'Capitalize'], ['lower', 'Make lowercase'], ['insert', 'Insert'], ['para', 'New paragraph'],
  ['delete', 'Delete'], ['swap', 'Swap order'], ['space', 'Add a space'], ['close', 'Close up'],
  ['sp', 'Spelling'], ['ro', 'Run-on'], ['frag', 'Fragment'],
  ['wc', 'Word choice'], ['awk', 'Awkward'], ['vt', 'Verb tense'], ['unclear', 'Unclear'],
];
// src/stamps.js
const PUNCT = [
  ['period', 'Add a period', 'Period'], ['comma', 'Add a comma', 'Comma'], ['apos', 'Add an apostrophe', 'Apostrophe'], ['quote', 'Add quotation marks', 'Quotes'], ['semi', 'Add a semicolon', 'Semicolon'],
  ['colon', 'Add a colon', 'Colon'], ['qmark', 'Add a question mark', 'Question'], ['excl', 'Add an exclamation mark', 'Exclamation'], ['hyphen', 'Add a hyphen', 'Hyphen'], ['dash', 'Add a dash', 'Dash'],
];
// src/stamps.js
const MARK_MEAN = {
  gr: 'A grammar mistake here, such as a verb that doesn’t match its subject.',
  cap: 'Make this letter a capital.', lower: 'Make this letter lowercase.',
  insert: 'Something is missing here. Add the word or letter written above it.',
  para: 'Start a new paragraph here.', delete: 'Take this out.', swap: 'Switch the order of these words or letters.',
  space: 'Put a space here.', close: 'Take out the space and join these together.',
  sp: 'This word is spelled wrong.', ro: 'Two sentences run together. Split them, or join them with the right punctuation.',
  frag: 'This isn’t a full sentence. It’s missing a subject or a verb, or the thought isn’t finished.',
  wc: 'A different word would fit better here.', awk: 'This is hard to read. Try saying it out loud and rewording it.',
  vt: 'The verb is in the wrong tense. Keep the tense the same.', unclear: 'I’m not sure what you mean here.',
  period: 'Add a period where the mark points.', comma: 'Add a comma where the mark points.', apos: 'Add an apostrophe here.',
  quote: 'Add quotation marks here.', semi: 'Add a semicolon here.', colon: 'Add a colon here.', qmark: 'Add a question mark here.',
  excl: 'Add an exclamation mark here.', hyphen: 'Add a hyphen here.', dash: 'Add a dash here.',
};
// src/stamps.js
const MARK_KEY = 'gs.markKey';
// src/stamps.js
const markLabel0 = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k)) || [k, k])[1];
export { PROOF, PUNCT, markLabel0, MARK_KEY, MARK_MEAN };
