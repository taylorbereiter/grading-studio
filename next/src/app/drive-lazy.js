// "From Google Drive" for a screen near its size budget: the button (drive-button.jsx) loads as a part of its own (router PARTS.drive).
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { PARTS } from './router.js';

export function LazyDrive(props) {
  const [C, setC] = useState(null);
  useEffect(() => { let live = true; PARTS.drive().then(m => { if (live) setC(() => m.DriveButton); }); return () => { live = false; }; }, []);
  return C ? h(C, props) : null;
}
