// Made-up student papers, generated in code. Every name here is invented; nothing comes from a real class.
// The output is the same byte for byte every run, on any computer: saved work is keyed on file sizes, and the old-format fixture checks hashes.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { zipSync, strToU8 } = require('fflate');

const DATE = new Date('2026-09-01T12:00:00Z');
const FILLER = 'The river in this story stands for time, and the narrator returns to it whenever a choice has to be made.';
async function makePaper({ title = 'Essay', pages = 1, size = [612, 792], lines = [] } = {}) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(DATE); doc.setModificationDate(DATE); doc.setProducer('gs-test'); doc.setCreator('gs-test');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 0; n < pages; n++) {
    const pg = doc.addPage(size), H = pg.getHeight();
    pg.drawText(title + ', page ' + (n + 1), { x: 60, y: H - 70, size: 16, font, color: rgb(0.1, 0.1, 0.1) });
    for (let i = 0; i < 8; i++) pg.drawText(FILLER.slice(0, 70), { x: 60, y: H - 120 - i * 24, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    if (n === pages - 1) lines.forEach((t, i) => pg.drawText(t, { x: 60, y: 80 - i * 18, size: 12, font, color: rgb(0, 0, 0) }));
  }
  return doc.save({ updateFieldAppearances: false });
}
// A ZIP keeps the clock time as written, with no zone, and fflate writes a date's local time. Built from local parts, this reads 8 PM in every zone,
// which is what the frozen hashes hold: they were made in UTC+8.
const MTIME = new Date(2026, 8, 1, 20, 0, 0);
function makeDocx(text) {
  const f = s => [strToU8(s), { mtime: MTIME }];
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipSync({
    '[Content_Types].xml': f(HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': f(HEAD + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>'),
  });
}

// The stack most tests open: four made-up students, with the kinds of files a real download has.
async function standardFiles() {
  return {
    'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria Testwell essay', pages: 2 }),
    'Bram Sample/Essay.pdf': await makePaper({ title: 'Bram Sample essay' }),
    'Bram Sample/Extra notes.pdf': await makePaper({ title: 'Bram Sample notes' }),
    'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay', lines: ['9.5/12 = 88%'] }),
    'Dov Madeup/Essay.docx': makeDocx('Dov Madeup wrote this short essay in Word.'),
    'Dov Madeup/notes.txt': strToU8('Plain notes from Dov Madeup.\n'),
  };
}
// Other bytes the saved-work fixture holds: a late file added to a student, a reading, and a Word file after her edit.
async function extraFiles() {
  return {
    'Late page.pdf': await makePaper({ title: 'Dov Madeup late page' }),
    'Reading.pdf': await makePaper({ title: 'A short reading for the class' }),
    'Essay edited.docx': makeDocx('Dov Madeup wrote this short essay in Word. Edited in Grading Studio.'),
  };
}
// A second download, for plain points.
const quizFiles = async () => ({ 'Fen Placeholder/Quiz.pdf': await makePaper({ title: 'Fen Placeholder quiz' }), 'Gus Invented/Quiz.pdf': await makePaper({ title: 'Gus Invented quiz' }) });
const zipOf = files => { const o = {}; for (const [k, v] of Object.entries(files)) o[k] = [v, { mtime: MTIME }]; return zipSync(o); };
module.exports = { makePaper, makeDocx, standardFiles, extraFiles, quizFiles, zipOf };
