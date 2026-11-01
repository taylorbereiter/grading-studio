// npm run preview: builds, then serves the app at http://localhost:4173 so a change can be tried before it's pushed.
// The fixed port keeps the preview's own saved test work between runs; browsers tie saved work to the full address.
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const PORT = +process.env.PORT || 4173, FILE = path.join(__dirname, '..', 'index.html');
serve(() => fs.readFileSync(FILE, 'utf8'), PORT, { keepAlive: true }).then(s => {
  console.log('\nPreview copy: ' + s.url.replace(/\/$/, ''));
  console.log('It has its own saved work, separate from your grading link. Use the sample papers or made-up files.');
  console.log('Press Ctrl+C to stop.\n');
}, e => {
  console.error(e.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is already in use. Is another preview still running? Stop it, or set PORT to another number.' : e.message);
  process.exit(1);
});
