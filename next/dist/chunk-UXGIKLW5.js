import{f as a}from"./chunk-SRG2RJVC.js";import"./chunk-UOT4ZFVT.js";import{a as o}from"./chunk-SFQL27JW.js";import"./chunk-2K42ZOD6.js";o();var S=(e,t)=>t.name.replace(/[\\/:*?"<>|]+/g,"-").trim().slice(0,90)+(e==="scales"?".scale.json":".rubric.json");function A(e,t){let s={id:t.id,name:t.name};return t.unit&&(s.unit={course:t.unit.course,title:t.unit.title}),e==="rubrics"?(s.criteria=t.criteria,t.levels&&(s.levels=t.levels),s.scale=t.scale||null):s.scale=t.scale,s}var c=`
## Rubrics and grading scales
\`Rubrics/*.rubric.json\` and \`Rubrics/*.scale.json\` are the teacher's bank of rubrics and grading scales,
sorted by unit. Only the wording and percents are here: never scores or anything about a student.
Edit one in place (keep its "id"), or write a new file to add one (leave "id" out). Don't delete files;
the teacher deletes in the app.

Rubric: {
  "id": "\u2026", "name": "Book cover formative",
  "unit": { "course": "<course from timetable.json>", "title": "<a unit's title from Units/>" },   // optional
  "criteria": ["Row 1 name", "Row 2 name", "Row 3 name"],        // each row is scored 4 to 1 (0 if needed), so 3 rows = out of 12
  "top": 8, "half": false,                                       // optional: a row's highest score when it isn't 4 (1 to 10), and false for whole numbers only
  "levels": [ { "4": "What a 4 looks like on row 1", "3": "\u2026", "2": "\u2026", "1": "\u2026" }, { \u2026 }, { \u2026 } ],   // optional; "0" too if wanted
  "scale": { "12": 100, "11": 95, "10": 90, \u2026 }                  // optional: total points -> percent; null = plain share of points
}
Grading scale: { "id": "\u2026", "name": "Out of 12, steps of 5", "unit": { \u2026 }, "scale": { "12": 100, "11": 95, \u2026 , "0": 40 } }
`,T=e=>JSON.stringify({l:e.layout,t:e.title,b:e.body,z:e.size,n:e.notes,i:e.img&&e.img.src.length+":"+e.img.source,v:e.video&&e.video.url+e.video.start}),u={title:"Title",agenda:"Agenda",objectives:"Objectives",warmup:"Warm-up",exit:"Exit ticket",steps:"Directions with steps",discuss:"Discussion question",content:"Title and text",twocol:"Two columns",text:"Plain text",passage:"Passage",vocab:"Vocabulary",picture:"Picture",fullpic:"Full picture",textpic:"Text + picture",picprompt:"Picture + questions",video:"Video"},p=[28,30,32,34,36],m=[18,20,24,28,30,32,34,36,40,44],n=()=>a.setup&&a.setup.deck||{},f=()=>n().agenda!==!1,y=()=>n().sizes==="any"?m:p,w=()=>{let e=y();return e[0]+" to "+e[e.length-1]};function x(e){let t={};return e&&e.agenda===!1&&(t.agenda=!1),e&&e.sizes==="any"&&(t.sizes="any"),e&&u[e.add]&&e.add!=="content"&&e.add!=="title"&&(t.add=e.add),Object.keys(t).length?t:null}var j=(e,t)=>(t||a.setup&&a.setup.classes||[]).some(s=>(s.meets||[]).some(i=>+i.dow===e)),R=e=>e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0"),z=e=>{let[t,s,i]=String(e).split("-").map(Number);return new Date(t,s-1,i)};function g(){let e=null;try{e=JSON.parse(localStorage.getItem("gs.words")||"null")}catch{}return e=(e&&typeof e=="object"?e:null)||a.words||(a.setup?{sys:"ManageBac",unit:"Atlas",scale12:!0,ai:"Claude"}:{sys:"",unit:"",ai:""}),{sys:String(e.sys||"").trim().slice(0,40),unit:String(e.unit||"").trim().slice(0,40),scale12:!!e.scale12,ai:String(e.ai==null?e.scale12?"Claude":"":e.ai).trim().slice(0,30)}}function E(){return g().ai||"your AI assistant"}function L(e){return e=String(e||"").trim(),/^[\w.-]+\.[a-z]{2,}\//i.test(e)&&(e="https://"+e),/^https?:\/\/[^\s"<>]+$/i.test(e)?e:""}var O="planner-folder.json",D=()=>b.replace("@@SIZES@@",w()).replace("@@AGENDA@@",f()?`Slide 1 is always the title slide and slide 2 always the agenda ("layout": "agenda"): the parts of the lesson in order,
one line each. Keep them there; the app puts them there in a new lesson.`:"Slide 1 is always the title slide. Keep it there; the app puts it there in a new lesson."),b=`# Planner folder

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
  "id": "\u2026", "title": "Lesson name", "fmt": 2,
  "slots": [{ "classId": "<id from timetable.json>", "date": "2026-11-03" }],
  "slides": [
    { "layout": "title", "title": "Lesson name", "body": "" },
    { "layout": "agenda", "title": "11/3 Agenda", "body": "1. Warm-up\\n2. Activity\\n3. Review", "size": 28 },
    { "layout": "content", "title": "Slide title", "body": "\u2022 Point one\\n\\t\u2022 Smaller point under it", "size": 28, "notes": "Speaker notes" },
    { "layout": "text", "title": "The passage", "body": "Plain paragraphs, no bullets", "size": 28 },
    { "layout": "picture", "title": "Title", "img": { "src": "images/x.jpg", "w": 1600, "h": 900, "source": "Source line" } },
    { "layout": "video", "title": "Watch for the appeals", "video": { "url": "https://www.youtube.com/watch?v=\u2026", "start": 30 } },
    { "layout": "warmup", "title": "Warm-up", "tag": "Journal", "body": "The prompt", "size": 36 },
    { "layout": "objectives", "title": "Today we will", "body": "1. First objective\\n2. Second objective" },
    { "layout": "steps", "title": "Gallery walk", "body": "1. Step one\\n2. Step two\\n3. Step three", "foot": "When you\u2019re done: \u2026" },
    { "layout": "discuss", "title": "Let\u2019s talk", "body": "The question", "foot": "Think \xB7 Pair \xB7 Share" },
    { "layout": "twocol", "title": "\u2026", "h1": "Left heading", "body": "Left points", "h2": "Right heading", "body2": "Right points" },
    { "layout": "passage", "title": "Close read", "body": "\u201CThe passage\u201D", "cite": "Author, title, page", "foot": "The question" },
    { "layout": "fullpic", "title": "Name for the list of slides (not shown)", "img": { \u2026 } },
    { "layout": "textpic", "title": "Title", "body": "Text on the left", "img": { \u2026 } },
    { "layout": "picprompt", "title": "See \xB7 Think \xB7 Wonder", "img": { \u2026 }, "body": "Question one\\nQuestion two" },
    { "layout": "vocab", "title": "Word of the day", "word": "ethos", "pos": "noun", "body": "Meaning", "foot": "Example sentence" },
    { "layout": "exit", "title": "Exit ticket", "tag": "On a sticky note", "body": "The question" }
  ],
  "look": "wood",
  "atlas": "https://\u2026",             // optional: this lesson's page in the school's curriculum tool (otherwise its unit's link is used)
  "links": [ { "name": "Article to read", "url": "https://\u2026" } ]   // optional: web pages the teacher opens while teaching this lesson
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
  [{ "id", "src": "images/ctx-\u2026.png", "w", "h", "note": "what it is" }]. Open the image files and use them; leave "ctx" as it is.
  To put one on a slide, use its "src" as a picture slide's "img.src".
- A slide's "talk" is comments: { "by": "you" | "claude", "text": "\u2026" }. Reply by adding one with "by": "claude".
  Don't edit or remove the teacher's comments.
- The lesson's own "talk" (same shape) is comments on the whole lesson: how it should go overall. Apply them across the
  slides, and reply there the same way.
- "status": "claude" means the teacher sent it to you; set it to "review" when you're done.
  "claudeNote" is your short summary of what you did.
The teacher sees your changes slide by slide and keeps theirs or yours for each, so change what the lesson needs and leave the rest.
For a video, give just "url" (and "start" in seconds, if it should start partway); the app adds the title, channel and picture.
Rules: "size" is @@SIZES@@ (pt). Text lines ("body", "body2", "foot") are separated by \\n and show exactly as written:
a line starting with "\u2022 " is a bullet, "1. " (any number) is a numbered line, anything else is plain. One or two
leading tabs indent the line. **bold**, *italic*, __underline__ and {red}colored words{/} (red, orange, green, blue,
purple, gray) work inside a line (a backslash shows a *, _ or { as is).
No layout adds bullets or numbers by itself, so add them only where the teacher would. Keep "fmt": 2 on the lesson.
A slide may have "fs" (the teacher's own text sizes for other boxes, like { "title": 34, "foot": 30 }) and "box" (boxes the
teacher moved or resized, like { "body": { "x": 152, "y": 211, "w": 1008, "h": 420 } } on a 1280 x 720 slide). Keep both as they are.
The lesson's "title" and the title slide's title are the same: change both together (unless the lesson has
"titleApart": true). @@AGENDA@@ An empty title-slide body means the app fills in the course and dates. Bump "updated" (milliseconds) when you change a lesson.

## Unit shape
{
  "id": "\u2026", "course": "<course from timetable.json, like English 10>", "title": "Unit 2: Argument",
  "start": "2026-10-05",            // the Monday of the unit's first week
  "atlas": "https://\u2026",             // the unit's page in the school's curriculum tool, if the teacher added it
  "weeks": [ { "focus": "What this week is about (from the unit plan)", "notes": "Teacher's own notes", "standards": "RL.1, RL.2" } ],
  "files": [ { "name": "Unit plan week 1-3.png", "kind": "atlas" }, { "name": "Summative task sheet.docx", "kind": "summative" } ]
}
To fill a unit's weeks from its unit plan screenshots: read the "atlas" files in its files folder and write each
week's focus (and standards, if shown) into "weeks", in order, one entry per week. Keep the teacher's "notes".
Don't add, rename or remove files in the files folder; the teacher adds those in the app.
`+c;var P=e=>((e.course?e.course+" - ":"")+(e.title||"Unit")).replace(/[\\/:*?"<>|]+/g,"-").trim().slice(0,90);function F(e){let{_file:t,_mod:s,...i}=e;return i.files=e.files.map(({name:l,kind:r,type:d,size:h})=>({name:l,kind:r,type:d,size:h})),i}export{O as FOLDER_MARK,S as bankBase,A as bankForFile,x as deckClean,D as folderReadme,L as mbUrl,j as meetsOn,z as parseYmd,E as plAi,T as slideKey,P as unitBase,F as unitForFile,R as ymd};
