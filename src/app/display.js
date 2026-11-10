/* ---------------- display: app text size, text box size, paper fit, Word documents ---------------- */
function applyDisp() {
  const r = document.documentElement.style;
  r.setProperty('--uz', disp.ui); r.setProperty('--dfs', disp.dfs + 'px'); r.setProperty('--dlh', disp.dlh);
}
function dispChanged(k) {
  store.set('gs.disp', disp); applyDisp();
  if (k === 'zoom') store.set('gs.zoom', zoom);
  if (k === 'fit' || k === 'zoom' || k === 'ui') { clearTimeout(resizeT); resizeT = setTimeout(() => { if (batch) renderTools(); pages.forEach(renderPage); }, 120); }
}
function openDisplay() {
  const seg = (key, opts) => '<span class="seg">' + opts.map(([v, l]) => '<button data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (String(disp[key]) === String(v)) + '">' + l + '</button>').join('') + '</span>';
  const range = (key, min, max, step, val, unit) => '<div class="rv"><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" data-r="' + key + '" value="' + val + '" aria-label="' + key + '"><b>' + val + unit + '</b></div>';
  const render = () => {
    $('#dispBody').innerHTML =
      '<div class="dset"><div class="dl">App text size</div>' + seg('ui', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Extra large']]) +
        '<div class="muted" style="font-size:12.5px;margin-top:6px">The student list, tools, grade panel and windows. Papers keep their own zoom.</div></div>' +
      '<div class="dset"><div class="dl">New text boxes on the paper</div>' + range('tsize', 8, 32, 1, disp.tsize, ' pt') +
        '<div id="tsPrev" style="margin-top:6px;padding:4px 8px;border-radius:6px;background:#fff;font:' + disp.tsize + 'px Helvetica,Arial,sans-serif;color:' + COLORS[inkColor] + '">Aa Bb 123</div></div>' +
      '<div class="dset"><div class="dl">Paper</div>' + seg('fit', [['width', 'Fit width'], ['page', 'Fit whole page']]) +
        '<div style="margin-top:8px">' + range('zoom', 50, 250, 5, Math.round(zoom * 100), '%') + '</div></div>' +
      '<div class="dset"><div class="dl">Word documents</div>' + range('dfs', 12, 24, 1, disp.dfs, ' px') +
        '<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><span class="muted" style="font-size:13px">Line spacing</span>' + seg('dlh', [[1.3, 'Tight'], [1.45, 'Normal'], [1.8, 'Roomy']]) + '</div></div>';
  };
  openDlg('<div class="bh"><h2>Display</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="dispBody"></div>' +
    '<div class="bf"><button class="btn" data-reset>Back to normal</button><button class="btn primary" data-close>Done</button></div>', true);
  render();
  const box = $('#dlgBox');
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-reset]')) { disp = { ...DISP0, trim: disp.trim }; zoom = 1; dispChanged('zoom'); dispChanged('ui'); return render(); }
    const b = e.target.closest('[data-k]');
    if (b) { const v = b.dataset.v; disp[b.dataset.k] = isNaN(+v) ? v : +v; dispChanged(b.dataset.k); render(); }
  };
  box.oninput = e => {
    const k = e.target.dataset.r; if (!k) return;
    const v = +e.target.value;
    if (k === 'zoom') zoom = v / 100; else disp[k] = v;
    e.target.nextElementSibling.textContent = v + (k === 'zoom' ? '%' : k === 'tsize' ? ' pt' : ' px');
    if (k === 'tsize') $('#tsPrev').style.fontSize = v + 'px';
    dispChanged(k);
  };
}

