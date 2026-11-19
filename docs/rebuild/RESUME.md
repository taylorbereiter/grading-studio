# Audit: where it stopped (paused 19 Nov 2026, 12:00 UTC, Taylor's pause for grades)

Copies of every script and data file are in rebuild/audit/tools/. The scratch folder will be gone, so copy tools/ back to a scratch folder first.

**Data-loss rows:** 8 of 9 are verified on main a243eec7: H-001 to H-004 and H-006 to H-009.
- H-005 (the lesson notebook) waits on slice E1's PR #248.
- When H-005 is verified, tell the planning thread that all nine are verified.

**Verified on main:**
- Slice B: 58 rows verified and 2 agreed. B-903 to B-906 are fixed in #258, but that PR was not merged at the pause, so re-press those rows.
- Slice A: A-087, A-089 and A-027 are verified. A-088 ("Export what I have") is not pressed yet. B-064 is in #260.

**Slice E2:** the verify run for #254 and #249 was stopped before it wrote anything. Restart it with tools/rows-E2.txt (114 rows) and tools/BRIEFV.md.

**Not started:**
- Slices C, D and E1.
- The review of each slice's "kept different on purpose" list.
- The sweep of what coverage.md says was not covered.
- The final report.

**How to run it:**
1. Build main: npm ci, node next/build.js, npm run build.
2. Serve it with python http.server, run in the background.
3. Make the sample profile with tools/mk-vbase2.js. A profile works only on the port it was made on.
4. Update checks are manual: press "Check for an update" in Settings > About.
