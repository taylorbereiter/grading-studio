# Shared parts (stage 1)

Every screen of the new app is built from these. A screen never makes its own button, menu, sheet or colour.
See them all, in every theme and at phone width: `next/gallery.html` (`npm run next:build`, then `npm run preview` or
`node next/tools/serve-next.js` and open `/gallery.html`). Not linked from the current app.

## Where things are

| | |
|---|---|
| `src/ui/tokens.js` | The one token file: six themes (Graphite default, Porcelain, Ocean, Ink, Plum, Midnight), six type sizes, space, radius, shadows, motion 150 to 250 ms, and `PAIRS`, every colour pair the parts draw with the contrast it needs. Built into `dist/tokens.css`. |
| `src/ui/parts.css` | The parts' styles. Tokens only; a test fails on a written colour. |
| `src/ui/icons.js` | One icon set on a 16 px grid, 1.5 stroke. `<Icon name>`. No typed characters or emoji as icons. |
| `src/ui/controls.jsx` | Button (primary, plain, quiet; no danger button, removing is undoable), IconButton, Segmented, Tabs, TextInput, Select, Checkbox, Switch, Slider, Chip, Card, List/ListRow, Table, NavItem, ClassDot, Avatar, EmptyState, Progress, Spinner. |
| `src/ui/popups.jsx` | Menu, Tooltip. |
| `src/ui/overlay.jsx` | Sheet, Dialog (native modal dialog, Tab kept inside, Escape, focus returned), toasts with Undo. |
| `src/ui/services.jsx` | CommandBar, TextBox with dictation, Mic, AddFile, FileTile, Comments, ThemePicker, ShortcutList. |
| `src/services/` | theme (saved as `gs.look` through the saved-work layer), assistant (name and link from `gs.words`), undo, shortcuts, commands, files (value kinds), speech. |
| `src/i18n/t.js`, `lang/en.json` | `t('area.name', params)`. Every line is named; no part types English. `lang/gallery.en.json` holds the gallery's own lines and never ships with the app. |

## Rules the tests hold

- `next/test/tokens.test.js`: every pair in `PAIRS` meets AA in all six themes; class colours 3:1 on a card; red only for marks (`pen`);
  check marks green; no sage or yellow-green; nothing reads the computer's light or dark setting; parts.css uses tokens only and
  never uses a not-for-text token (`faint`, `edge`, light greys) as text.
- `next/test/lines.test.js`: every `t()` line exists and every line is used; no words typed into a part; no assistant named outside
  `services/assistant.js`.
- `next/test/services.test.js`: theme saved only by the writing window; assistant name; undo; shortcuts; commands; file values.
- `next/test/browser/gallery.test.js` (Chrome): the gallery drawn with every line as its key shows no other words; menu, sheet, dialog
  and command bar by keyboard; mic shown only where the browser can listen; undo from the toast and Ctrl+Z; every theme draws.
- `next/test/budgets.test.js`: `parts` and `css` budgets in `next/budgets.json`.
- `npm run next:shots` pictures every section and the open floating parts, six themes, computer and phone width (CI keeps them).

## Notes for the stages that use them

- **Theme.** `gs.look` is new and only the new app writes it. With nothing saved, `gs.theme` "dark" shows Midnight. The current app's
  sample lines share `gs.theme` and `gs.lang` with the sample but not `gs.look`, so in the sample the new app's theme is the sample's own
  until the current app's `src/samplemode.js` lists it (left alone in stage 1: the current app is not changed).
- **Undo.** `snapshot()` before a change is today's `fieldSnap`/`gradeSnap`; `track()` is `libTrack`; `forget()` is `libUndoForget()`.
  Typing in one box is one step (`group`).
- **Files.** Four kinds: `file`, `drive`, `link`, `ref`. A `ref` points at a student-side item and is never copied; parts draw it only
  through the screen's `resolve(ref)`, else a placeholder. The Drive picker is a slot (`drivePick`): no Drive button without it.
- **Dictation.** The browser's own speech recognition. No mic where there is none.
- **Shortcuts.** Screens register theirs; Help's list is made from the registry. The inventory's shortcuts are registered by the screens
  that own them (stages 2 to 6).
- **Languages.** Stage 1 ships English only (`en.json`). Other languages are converted in stage 6 and new lines translated in stage 7
  (`docs/languages.md`).
