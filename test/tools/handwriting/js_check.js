const fs = require('fs'), path = require('path');
const { load } = require(path.join(__dirname, 'hwreader.js'));
const [bin, check] = process.argv.slice(2);
const buf = fs.readFileSync(bin); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
const R = load(ab);
const ck = JSON.parse(fs.readFileSync(check));
const r = R.read(Float32Array.from(ck.x), ck.w);
let md = 0, agree = 0;
for (let t = 0; t < r.T; t++) {
  let a = 0, b = 0;
  for (let k = 0; k < r.C; k++) { md = Math.max(md, Math.abs(r.lp[t * r.C + k] - ck.lp[t * r.C + k])); if (r.lp[t*r.C+k] > r.lp[t*r.C+a]) a = k; if (ck.lp[t*r.C+k] > ck.lp[t*r.C+b]) b = k; }
  agree += a === b;
}
console.log('T', r.T, 'max |diff| in log-prob (int8 weights vs float):', md.toFixed(3), 'same top letter in', agree, 'of', r.T, 'columns');
for (const W of [128, 256, 600]) {
  const x = new Float32Array(32 * W).map(() => Math.random() < 0.15 ? 1 : 0);
  R.read(x, W);
  const t0 = process.hrtime.bigint(); const n = 5;
  for (let i = 0; i < n; i++) R.read(x, W);
  console.log('width', W, (Number(process.hrtime.bigint() - t0) / 1e6 / n).toFixed(1), 'ms per picture');
}
