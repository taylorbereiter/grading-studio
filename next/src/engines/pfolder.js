// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { L } from './planner.js';

// src/planner/bank.js
const bankBase = (kind, x) => x.name.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90) + (kind === 'scales' ? '.scale.json' : '.rubric.json');
// src/planner/bank.js
function bankForFile(kind, x) {
  const o = { id: x.id, name: x.name };
  if (x.unit) o.unit = { course: x.unit.course, title: x.unit.title };
  if (kind === 'rubrics') { o.criteria = x.criteria; if (x.levels) o.levels = x.levels; o.scale = x.scale || null; } else o.scale = x.scale;
  return o;
}
// src/planner/bank.js
const BANK_README = `
## Rubrics and grading scales
\`Rubrics/*.rubric.json\` and \`Rubrics/*.scale.json\` are the teacher's bank of rubrics and grading scales,
sorted by unit. Only the wording and percents are here: never scores or anything about a student.
Edit one in place (keep its "id"), or write a new file to add one (leave "id" out). Don't delete files;
the teacher deletes in the app.

Rubric: {
  "id": "…", "name": "Book cover formative",
  "unit": { "course": "<course from timetable.json>", "title": "<a unit's title from Units/>" },   // optional
  "criteria": ["Row 1 name", "Row 2 name", "Row 3 name"],        // each row is scored 4 to 1 (0 if needed), so 3 rows = out of 12
  "top": 8, "half": false,                                       // optional: a row's highest score when it isn't 4 (1 to 10), and false for whole numbers only
  "levels": [ { "4": "What a 4 looks like on row 1", "3": "…", "2": "…", "1": "…" }, { … }, { … } ],   // optional; "0" too if wanted
  "scale": { "12": 100, "11": 95, "10": 90, … }                  // optional: total points -> percent; null = plain share of points
}
Grading scale: { "id": "…", "name": "Out of 12, steps of 5", "unit": { … }, "scale": { "12": 100, "11": 95, … , "0": 40 } }
`;
// src/planner/review.js
const slideKey = s => JSON.stringify({ l: s.layout, t: s.title, b: s.body, z: s.size, n: s.notes, i: s.img && s.img.src.length + ':' + s.img.source, v: s.video && s.video.url + s.video.start });
// src/planner/lessons.js
const LAYOUTS = { title: 'Title', agenda: 'Agenda', objectives: 'Objectives', warmup: 'Warm-up', exit: 'Exit ticket', steps: 'Directions with steps', discuss: 'Discussion question', content: 'Title and text', twocol: 'Two columns', text: 'Plain text', passage: 'Passage', vocab: 'Vocabulary', picture: 'Picture', fullpic: 'Full picture', textpic: 'Text + picture', picprompt: 'Picture + questions', video: 'Video' };
// src/planner/lessons.js
const SIZES = [28, 30, 32, 34, 36];   // slide text stays between 28 and 36 pt, big enough to read from the back of the room
// src/planner/lessons.js
const SIZES_ANY = [18, 20, 24, 28, 30, 32, 34, 36, 40, 44];
// src/planner/lessons.js
const deckRule = () => (L.setup && L.setup.deck) || {};
// src/planner/lessons.js
const deckAgenda = () => deckRule().agenda !== false;
// src/planner/lessons.js
const deckSizes = () => deckRule().sizes === 'any' ? SIZES_ANY : SIZES;
// src/planner/lessons.js
const deckSizeSay = () => { const z = deckSizes(); return z[0] + ' to ' + z[z.length - 1]; };
// src/planner/lessons.js
function deckClean(d) { const o = {}; if (d && d.agenda === false) o.agenda = false; if (d && d.sizes === 'any') o.sizes = 'any'; if (d && LAYOUTS[d.add] && d.add !== 'content' && d.add !== 'title') o.add = d.add; return Object.keys(o).length ? o : null; }
// src/planner/lessons.js
const meetsOn = (dow, cs) => (cs || (L.setup && L.setup.classes) || []).some(c => (c.meets || []).some(m => +m.dow === dow));
// src/planner/lessons.js
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// src/planner/lessons.js
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
// src/planner/lessons.js
function plWords() {
  let w = null; try { w = JSON.parse(localStorage.getItem('gs.words') || 'null'); } catch { }
  w = (w && typeof w === 'object' ? w : null) || L.words || (L.setup ? { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' } : { sys: '', unit: '', ai: '' });
  // ai: the teacher's AI assistant by name. Words kept before it was asked say nothing about it, and that teacher had Claude's words.
  return { sys: String(w.sys || '').trim().slice(0, 40), unit: String(w.unit || '').trim().slice(0, 40), scale12: !!w.scale12, ai: String(w.ai == null ? (w.scale12 ? 'Claude' : '') : w.ai).trim().slice(0, 30) };   // scale12: the rubric bank offers the 12-point scale as a preset
}
// src/planner/lessons.js
function plAi() { return plWords().ai || 'your AI assistant'; }
// src/planner/lessons.js
function mbUrl(v) { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; }
// src/planner/lessons.js
const FOLDER_MARK = 'planner-folder.json';
// src/planner/lessons.js
const folderReadme = () => FOLDER_README.replace('@@SIZES@@', deckSizeSay()).replace('@@AGENDA@@', deckAgenda()
  ? 'Slide 1 is always the title slide and slide 2 always the agenda ("layout": "agenda"): the parts of the lesson in order,\none line each. Keep them there; the app puts them there in a new lesson.'
  : 'Slide 1 is always the title slide. Keep it there; the app puts it there in a new lesson.');
// src/planner/lessons.js
const FOLDER_README = `# Planner folder

The Planner (part of Grading Studio) keeps planning here so the teacher's AI assistant can read and edit it. Only planning is in
this folder: lessons, units, the timetable, files the teacher added to a unit, and rubrics and grading scales. Student work and grades
never are, and nothing here should point to a student.

## Files
- \`profile.json\` (if there): the teacher's profile; the app loads it when it changes. Don't edit it.
- \`timetable.json\`: classes (id, name, course, meets: dow 0=Sun, 1=Mon .. 6=Sat, start, end, label), days off,
  dates to show, and the semester's first and last Monday. Read it; the teacher changes it in the app.
- \`*.lesson.json\`: one lesson each. Edit in place and keep the "id". To add a lesson, write a new file
  ending in .lesson.json (leave "id" out). \`images/\` holds slide pictures ("img.src": "images/abc.jpg").
- \`Units/*.unit.json\`: one unit each (see below). Its files (screenshots of the unit plan, summative task sheets)
  are in the folder next to it with the same name plus " files".
- \`activities.json\`: the teacher's own activities, a list of { "name", "what", "kind" (talk, read, write,
  words, move, check), "parts" (warmup, activity, review), "group", "how": [steps for the teacher],
  "slide": [steps for students], "video" (optional: a web address of a video showing it in a classroom) }.
  Add or edit entries here; the built-in bank isn't in this file.

## Lesson shape
{
  "id": "…", "title": "Lesson name", "fmt": 2,
  "slots": [{ "classId": "<id from timetable.json>", "date": "2026-11-03" }],
  "slides": [
    { "layout": "title", "title": "Lesson name", "body": "" },
    { "layout": "agenda", "title": "11/3 Agenda", "body": "1. Warm-up\\n2. Activity\\n3. Review", "size": 28 },
    { "layout": "content", "title": "Slide title", "body": "• Point one\\n\\t• Smaller point under it", "size": 28, "notes": "Speaker notes" },
    { "layout": "text", "title": "The passage", "body": "Plain paragraphs, no bullets", "size": 28 },
    { "layout": "picture", "title": "Title", "img": { "src": "images/x.jpg", "w": 1600, "h": 900, "source": "Source line" } },
    { "layout": "video", "title": "Watch for the appeals", "video": { "url": "https://www.youtube.com/watch?v=…", "start": 30 } },
    { "layout": "warmup", "title": "Warm-up", "tag": "Journal", "body": "The prompt", "size": 36 },
    { "layout": "objectives", "title": "Today we will", "body": "1. First objective\\n2. Second objective" },
    { "layout": "steps", "title": "Gallery walk", "body": "1. Step one\\n2. Step two\\n3. Step three", "foot": "When you’re done: …" },
    { "layout": "discuss", "title": "Let’s talk", "body": "The question", "foot": "Think · Pair · Share" },
    { "layout": "twocol", "title": "…", "h1": "Left heading", "body": "Left points", "h2": "Right heading", "body2": "Right points" },
    { "layout": "passage", "title": "Close read", "body": "“The passage”", "cite": "Author, title, page", "foot": "The question" },
    { "layout": "fullpic", "title": "Name for the list of slides (not shown)", "img": { … } },
    { "layout": "textpic", "title": "Title", "body": "Text on the left", "img": { … } },
    { "layout": "picprompt", "title": "See · Think · Wonder", "img": { … }, "body": "Question one\\nQuestion two" },
    { "layout": "vocab", "title": "Word of the day", "word": "ethos", "pos": "noun", "body": "Meaning", "foot": "Example sentence" },
    { "layout": "exit", "title": "Exit ticket", "tag": "On a sticky note", "body": "The question" }
  ],
  "look": "wood",
  "atlas": "https://…",             // optional: this lesson's page in the school's curriculum tool (otherwise its unit's link is used)
  "links": [ { "name": "Article to read", "url": "https://…" } ]   // optional: web pages the teacher opens while teaching this lesson
}
"look" is the lesson's colors: wood (the teacher's template), white, cream, sage, sky, blush, charcoal, navy,
stripe, band, bigtype, framed, notebook, chalk. Leave it out to use the teacher's default; change it only when asked.
"ask", "talk", "status" and "claudeNote" are for working together, and are all optional:
- A lesson .zip (the teacher uploads it on a lesson): the finished .pptx plus handouts and files, flat or in folders.
  The .pptx becomes the finished PowerPoint; every other file goes into the lesson's materials. An optional lesson.json
  { "kind": "grading-studio-lesson-zip", "finished": "Deck.pptx", "materials": ["Handout.docx"] } picks the deck and the files.
- "variantOf" and "variant" (on a lesson) mark an alternative version of another lesson ("variantOf" is that lesson's id,
  "variant" its name, like "Shorter Friday"). It is a full lesson of its own; edit only the one you were asked about.
- "final" and "finals" (on a lesson) are the teacher's finished PowerPoint and older ones (the files stay in the app). Leave them as they are.
- "ready" (on a lesson) is { "at" }, set when the teacher said the lesson is ready to teach. Leave it as it is.
- "notebook" (on a lesson or unit) is the teacher's own jotted thoughts, as simple HTML. Read it for ideas; don't edit it.
- "taught" (on a lesson) is where each class got to when the lesson was taught: [{ "classId", "date", "slide" (the slide
  they reached, counting from 1), "of" (how many slides there were), "note" (the teacher's line for next time) }].
  Read it to plan what comes next; leave it as it is.
- A slide's "ask" is what the teacher wants on that slide. Use it, and leave it as it is.
- A slide's "ctx" is screenshots the teacher added for context (like assignment instructions), not shown on the slide:
  [{ "id", "src": "images/ctx-….png", "w", "h", "note": "what it is" }]. Open the image files and use them; leave "ctx" as it is.
  To put one on a slide, use its "src" as a picture slide's "img.src".
- A slide's "talk" is comments: { "by": "you" | "claude", "text": "…" }. Reply by adding one with "by": "claude".
  Don't edit or remove the teacher's comments.
- The lesson's own "talk" (same shape) is comments on the whole lesson: how it should go overall. Apply them across the
  slides, and reply there the same way.
- "status": "claude" means the teacher sent it to you; set it to "review" when you're done.
  "claudeNote" is your short summary of what you did.
The teacher sees your changes slide by slide and keeps theirs or yours for each, so change what the lesson needs and leave the rest.
For a video, give just "url" (and "start" in seconds, if it should start partway); the app adds the title, channel and picture.
Rules: "size" is @@SIZES@@ (pt). Text lines ("body", "body2", "foot") are separated by \\n and show exactly as written:
a line starting with "• " is a bullet, "1. " (any number) is a numbered line, anything else is plain. One or two
leading tabs indent the line. **bold**, *italic*, __underline__ and {red}colored words{/} (red, orange, green, blue,
purple, gray) work inside a line (a backslash shows a *, _ or { as is).
No layout adds bullets or numbers by itself, so add them only where the teacher would. Keep "fmt": 2 on the lesson.
A slide may have "fs" (the teacher's own text sizes for other boxes, like { "title": 34, "foot": 30 }) and "box" (boxes the
teacher moved or resized, like { "body": { "x": 152, "y": 211, "w": 1008, "h": 420 } } on a 1280 x 720 slide). Keep both as they are.
The lesson's "title" and the title slide's title are the same: change both together (unless the lesson has
"titleApart": true). @@AGENDA@@ An empty title-slide body means the app fills in the course and dates. Bump "updated" (milliseconds) when you change a lesson.

## Unit shape
{
  "id": "…", "course": "<course from timetable.json, like English 10>", "title": "Unit 2: Argument",
  "start": "2026-10-05",            // the Monday of the unit's first week
  "atlas": "https://…",             // the unit's page in the school's curriculum tool, if the teacher added it
  "weeks": [ { "focus": "What this week is about (from the unit plan)", "notes": "Teacher's own notes", "standards": "RL.1, RL.2" } ],
  "files": [ { "name": "Unit plan week 1-3.png", "kind": "atlas" }, { "name": "Summative task sheet.docx", "kind": "summative" } ]
}
To fill a unit's weeks from its unit plan screenshots: read the "atlas" files in its files folder and write each
week's focus (and standards, if shown) into "weeks", in order, one entry per week. Keep the teacher's "notes".
Don't add, rename or remove files in the files folder; the teacher adds those in the app.
` + BANK_README;
// src/planner/activities.js
const A = (id, name, kind, parts, group, what, how, slide, book, tip) => ({ id, name, kind, parts, group, what, how, slide, book: book || 0, tip: tip || '' });
// src/planner/units.js
const unitBase = u => ((u.course ? u.course + ' - ' : '') + (u.title || 'Unit')).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90);
// src/planner/units.js
function unitForFile(u) { const { _file, _mod, ...c } = u; c.files = u.files.map(({ name, kind, type, size }) => ({ name, kind, type, size })); return c; }
export { plAi, FOLDER_MARK, folderReadme, unitBase, unitForFile, bankBase, bankForFile, slideKey, deckClean, meetsOn, mbUrl, ymd, parseYmd };
