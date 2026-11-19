# Languages: from English lines to named lines

Stage 0, item 8. A plan only: nothing is converted in stage 0.

## How it works today

**Files.** Eight language files, `src/lang-<file>.js`, listed in `LANGS` in build.js with the code the browser knows each by:
`zh-Hant` (lang-zh.js), `zh-Hans` (lang-zh-hans.js), `es`, `fr`, `de`, `pt-BR` (lang-pt.js), `ja`, `ko`. Each file defines one object
(`LANG_DE` and so on) with these parts:

| Part | What it holds | Size in every file |
|---|---|---|
| `name`, `locale` | The language's own name for the picker; the locale for dates (`LANG_LOCALE`). | 2 |
| `words` | English line → translation. A key can carry a context prefix for a word with two meanings: `att|Late`, `att|Present`, `att|excused`, `tn|Mark`, `mail|Subject` (picked by the nearest `data-lc` attribute). | 1,862 lines, 5 with a context |
| `rules` | `[regex, replacement]` for English lines with a number or a name in them. The replacement is a `$1` string or a function; the first rule that answers wins. Two rules look other lines up by English (`LANG_DE.words[m[1]]`). | 78 rules; 22 to 33 of them are functions, depending on the language |
| `fill` | Named pieces (`fcof`, `gpsess`, `owesA`, `how1`...) that src/lang.js `LANG_FILLS` uses: lang.js holds the 243 English regexes once, and each language gives only the wording. `{1}` `{2}` are parts found in the English, `{t1}` is that part put into the language when it is known, and a two-item array is `[one, many]` picked by whether the first number is 1. | 286 keys, 51 of them plural pairs |
| `helpSecs`, `help` | Help sections and answers by topic id (`help['typed-notes'] = { q, words, a, go }`), matching `HELP` in src/helpdata.js. | 8 sections, 76 topics |

Helper functions sit above the object in some files (lang-de.js: `deN`, `deP`, `deLast`, `deHomeSay`), used by the function rules.

All eight files have the same `words` keys, the same rule regexes and the same `fill` keys (checked on 2026-11-17; only the order of
keys differs in some files). The `fill` placeholders match across all eight.

**Translating.** src/lang.js does not know where a line comes from. With a language on, a `MutationObserver` watches the parts of the page
in `LANG_ROOTS` (the sidebar, Today, Settings, a class page's tabs, the marking screen and others) and replaces each text node and each
`title`, `aria-label` and `placeholder` it sees: `trWith` tries the whole line, then each part between `" · "`. `trPiece` tries the context
key, then the plain key, then `LANG_FILLS` and the language's `rules`. A line nobody knows stays in English, which is how names a teacher
typed stay as typed; `LANG_RAW` lists what is never touched (text areas, contenteditable, `[data-raw]`, names, class titles). Text that is
drawn rather than put on the page (the feedback page in an exported paper, Quick mark pictures) goes through `tr(s, ctx)`: 54 calls in 13
files. `LANG_DONE` stops a translated word that is also English (German "Note") from being translated twice.

**Shipping.** The page at the web address carries no language: build.js writes `lang/<code>.js` and a small loader in `<head>` fetches the
one in `gs.lang` (stamped with a hash). The double-click copy (Grading Studio.html) carries all eight squeezed with deflate and a base-85
text (`pack85`/`unpack85`), in `LANG_PACKED`. The Planner page gets the same `@langs` block.

## Tests and tools today

- **test/lang.test.js** (891 lines, about 28 browser tests): the picker and `gs.lang`; Spanish and Traditional Chinese spot checks on the
  sidebar, Today, a class page, the gradebook, attendance, a student page, Help, the welcome, the feedback page, the marking screen; names
  and rubric rows left alone; the German "Note" case; the hosted page fetching only the chosen file; a file that can't be fetched leaving
  English for that visit; the double-click copy carrying all eight. The main check is `window.__gsLang.missing(code)`: with the app in
  English, walk the covered screens and list every piece a language doesn't know, for each of the eight.
- **test/safe.test.js**: the offline copy keeps the lang files with the pages and updates them with a new version.
- **test/polish.test.js**, "the built file stays a sensible size": `Grading Studio.html` minus `index.html` must be under
  `langs * 100e3`, which is 800 KB for eight languages. See the budget section.
- **build.js** itself throws if a language file reads differently once its spaces are squeezed out.
- **test/tools/lang-unused.js** (by hand, not in CI): lists `words` keys that appear nowhere in the app's source word for word. Today: 98 of
  1,862. Each needs a look, because a line can be put together at run time.

## The new scheme: named lines

The new app calls `t('key', params)` where it draws a line, so a screen knows exactly which line it shows. Nothing reads the finished page.
This removes the need for `LANG_ROOTS`, `LANG_RAW`, `data-lc`, the `" · "` splitting, `LANG_DONE` and every regex: a teacher's typed name is
never translated because it is only ever a parameter.

### Where the files live in next/

```
next/lang/en.json            the English, the source of truth: key -> line (plus an optional note for whoever translates)
next/lang/<code>.json        one per language, key -> line, codes as gs.lang stores them:
                             zh-Hant, zh-Hans, es, fr, de, pt-BR, ja, ko
next/lang/meta.json          each code's own name (for the picker) and its locale (for Intl dates and numbers)
next/lang/help/<code>.json   Help answers by topic id, as today, loaded only when Help opens
next/lang/v1-keys.json       the conversion map: old English key (and old rule/fill id) -> new key
next/src/i18n/t.js           t(), plural choice, loading a language chunk
next/tools/lang-convert.js   the conversion script (kept, so it can be run again during the overlap)
next/tools/lang-report.js    the review report
next/test/lang-lines.test.js the line-by-line checks
```

Each language becomes its own chunk, fetched when chosen and cached by the new app's service worker, as `lang/<code>.js` is today. The new
app reads the same `gs.lang` key, so the choice carries between the old and new app.

### Key naming

A key is `area.name`, lowercase, words joined with `_`, for example `focus.papers_left`, `gradebook.extra_credit_for`,
`attendance.late`, `common.save`.

- **area** is where the line is used. The script finds each English line in the current source the way lang-unused.js already does (strings
  joined across `+`, escapes and HTML entities undone) and maps the file to an area: src/focus.js → `focus`, src/book.js → `gradebook`,
  src/attend.js → `attendance`, src/app/export.js and src/feedback.js → `export`, src/help.js → `help`, src/shell.js → `shell`, and so on
  (the map is a small table in the script). A context prefix decides the area directly: `att|Late` → `attendance.late`, `tn|Mark` →
  `typednotes.mark`, `mail|Subject` → `mail.subject`.
- **name** comes from the English: the first five meaningful words, accents folded to ASCII, punctuation dropped, small words (a, the, of,
  to) dropped after the first. If two lines in one area give the
  same name, the second and later ones get the first four hex characters of a SHA-256 of their English added (`classpage.delete_q_3f9a`).
- **Stable:** keys are made once, by the conversion, and written into the files. They are never worked out again from the English, so
  later wording changes do not change keys. A re-run of the script during the overlap reads `v1-keys.json` first and only makes keys for
  English lines it has not seen.
- **Lines on several screens:** a line found in files of more than one area goes under `common.` (today one English line has one
  translation everywhere, so nothing is lost). When the new screens need a different translation in one place, that place gets its own key
  and the change is a reviewed wording change, not part of the conversion.
- **Lines found nowhere** (the lang-unused list) go under `unused.` and are listed in the report. None of them is carried into the new app's
  files unless a new screen uses it.

### Placeholders, plurals and rules

New line format: `{name}` for a parameter; a plural line is an object keyed by `Intl.PluralRules` categories:
`{ "one": "{n} paper left", "other": "{n} papers left" }`. Japanese, Korean and both Chinese files need only `other`.

- **`words`.** Copied as they are. The 7 English lines that contain `{name}`, `{class}`, `{list}`, `{n}`, `{s}`, `{in}`, `{They}` are the mail
  template's help text: those braces are the teacher's own template tokens, not parameters. The script marks those lines `literal` so `t()`
  leaves the braces alone, and the placeholder check skips them.
- **`fill`.** Already named. Each of the 243 `LANG_FILLS` entries gets one hand-written row in the script giving its new key and a name for
  each captured group (`fcleft`: `{1}` → `{n}`). `[one, many]` arrays become `{ one, other }`. `{t1}` ("put this part into the language
  when known") becomes a normal parameter: the new code passes an already translated value (`t('attendance.present')`), never a string to
  look up. The fills that lang.js assembles with functions (`how`, `cap`, `taken`, `hint`, `few`, `owes`, `here`, `rowavg` and about 25 more)
  were split into pieces already (`how1`..`how5`, `capA`/`capB`/`capR`); each piece becomes its own key and the component puts them
  together.
- **`rules` with a `$1` string** (about 45 to 56 per language) convert by script: `'$1 von $2 erledigt'` → `'{done} von {total} erledigt'`
  through a table of parameter names per rule (78 rows, written once, shared by all eight languages since the regexes are the same).
  Plural pairs written as `m[1] === '1' ? ... : ...` are recognised and turned into `{ one, other }`.
- **`rules` with a function** (22 to 33 per language) are listed by the script for hand conversion. Most are a plural choice or a lookup
  of another line, and become one plural line with parameters. A few build whole sentences with grammar (lang-de.js `deHomeSay` reads
  "two classes today. three sets of papers to mark" and rebuilds it); these become two or three lines that the new Home screen joins.
  The two rules that look up `LANG_xx.words[...]` by English become a parameter the caller translates first.
- **Plural choice.** Today a pair is picked by "the first number is 1". `Intl.PluralRules` differs for French and Brazilian Portuguese
  (0 is "one"). The conversion keeps today's output so the equivalence check below is exact; switching to `Intl.PluralRules` is its own
  reviewed change afterwards.
- **`help`.** Already keyed by topic id; it moves to `help/<code>.json` unchanged. The English comes from src/helpdata.js `HELP`. A button
  named in `**bold**` in an answer should become a reference to that button's key, so the answer always names the button as the screen
  shows it in that language (today an untranslated screen forces the English name).
- **Dates and numbers** use `Intl` with each language's `locale` from meta.json, as `LANG_LOCALE` does now.

## The 800 KB budget

polish.test.js allows the double-click copy to be at most `8 * 100 KB` bigger than the hosted page. That gap holds the eight packed
languages and also the packed sample (`SAMPLE_PACKED`), since both are inside the copy and fetched by the hosted page. In the committed
build (HEAD of this branch, 2026-11-17) the gap is **799,869 bytes**: the languages pack to 772 KB (94.6 to 98.7 KB each) and the sample to 29 KB.
That leaves about 130 bytes. Any new or longer line in any of the eight files makes `npm run check` fail on the current app.

For the new app the double-click copy is dropped (the teacher does not use it), so this budget does not apply to `next/` and nothing
in the new app needs `pack85` or `LANG_PACKED`. The current app keeps building the copies, and keeps this test, until the switch.

New budgets for `next/`, set in its own size test: each `next/lang/<code>.json` chunk at most 70 KB gzipped, each help file at most 25 KB
gzipped, English counted with the main bundle. Measured today, a language's translations without the English keys are about 24 KB gzipped
for `words`, 6 KB for `fill` and 20 KB for `help`; the English keys alone add another 23 KB, which named keys mostly remove. These limits
leave room for the screens that are still English today (To do, School, Examples, the phone, most of the Planner).

## Checking the wording line by line

**During conversion** (a test that runs once per conversion and stays while the old files exist): for every old `words` key and every
`fill` and `$1` rule, in each of the eight languages, render the new line with the same values the old one matched and compare it with what
`trPiece` gives today. They must be the same string. Rules converted by hand are checked with the example inputs listed in their table row.
lang.test.js's Spanish and Chinese expectations are reused as fixed examples.

**From then on**, `next/test/lang-lines.test.js` (plain node, no browser) checks:

1. Every key in `en.json` is in all eight language files, and no language file has a key that `en.json` lacks.
2. No unused lines: every key is used by a literal `t('...')` in `next/src` (a static scan; keys are always literal strings, never built),
   and every `t('...')` in the source names a key in `en.json`.
3. Placeholders match: the set of `{param}` names in each translation equals the English one's; a plural line has every category
   `Intl.PluralRules(locale)` needs and no others; `literal` lines are skipped.
4. Help: the same topic ids in all eight, and every `**bold**` reference names a key that exists.
5. Sizes: the budgets above.

A key missing from a language is a failure, with one exception for lines added for screens that were English-only before: they may sit in
`next/lang/pending.json` (key and language), which the test reads and reports. pending.json must be empty by stage 7.

**For review**, `node next/tools/lang-report.js` writes one table: key, area, English, the eight translations, and flags (missing, same as
English, longer than twice the English, placeholder mismatch, pending, unused). It can be published as a page for the teacher to look through,
with a column for "wording changed since the last report" so a review only reads what moved.

## Notes for the stages

- The 130-byte margin means the current app can take almost no wording change before the switch without raising its budget. Stage 0 says
  not to raise it; bug fixes that add a translated line will need a decision (raise the limit with a reason, or leave the line in English).
- Today To do, School, Examples, the phone and most of the Planner are not translated at all. Converting gives the new app only what
  exists; those screens need new translations in all eight languages, written and reviewed, before stage 7. That is the size of the
  pending list, and it is new translation work, not conversion.
- Named lines need every screen to call `t()` from stage 1 (parts) onward. A screen built in English first and translated later would
  repeat today's gap, so the lang-lines test should run from stage 1 with English-only keys allowed only through pending.json.
- The conversion itself fits stage 6 ("eight languages"), but the key scheme, `t()` and `en.json` are needed in stage 1.

## Stage 7: every line in every language

- Every line in `next/lang/*.en.json` (except the gallery's and the "not built yet" page's) has a translation in all eight
  `next/lang/<code>.json`, or is listed for that language in `next/lang/same.json` because it is the same word there (French
  "Note", German "Name", "Google Drive"). `next/test/lines.test.js` fails on a line missing from a language without that mark, so
  a new line needs its eight translations before it merges. `english-only.json` is gone.
- About 3,700 lines were written new in stage 7 (they had no wording in the current app), in the app's plain register, then
  checked by script: placeholders, plural forms (French and Portuguese "one" says the number, since 0 is "one" there), no
  assistant names, literals kept (`[name]`, `S-XXXX`, file names), and every `**button**` in Help written as that button's own
  line in the language.
- `next/tools/lang-convert.js` no longer replaces anything: a run only adds a converted line where a language has none.
- Each language is built as one `JSON.parse` string (next/build.js `lines-json`), about a third smaller than esbuild's named
  exports.
- Its letters are written as themselves, not as `\u` escapes (next/build.js, after esbuild), about 10 KB smaller squeezed.
- Size: each language chunk has its own limit (`langFile`, 120 KB), and the 3 MB total counts the app with one language, the
  largest, because a teacher downloads only the one they choose (the teacher's decision, 19 Nov 2026).
