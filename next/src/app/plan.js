// The Planner's saved work for a screen: read once, shared, read again when it changes here or in another window, or when the
// teacher comes back to this window. Subscribes first and reads after, so a change between the two is never missed.
import { useState, useEffect } from 'preact/hooks';
import { plan, loadPlan, onPlan, listenPlan } from '../planning/plan.js';

export function usePlan() {
  const [p, set] = useState(plan());
  useEffect(() => {
    listenPlan();
    const off = onPlan(set);
    loadPlan().then(set, e => console.error(e));
    const vis = () => { if (!document.hidden) loadPlan(true).catch(() => {}); };
    document.addEventListener('visibilitychange', vis);
    return () => { off(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return p;
}
