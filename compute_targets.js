// Compute the growth-multiple targets used by gen_ladder.js and
// gen_phasemap5.js under any assumption set, so those two figures can be
// regenerated under your own assumptions instead of trusting ours.
//
//   node compute_targets.js                    (proportional collective spending)
//   G1_NEUTRAL=flat node compute_targets.js    (equal-per-adult collective spending)
//
// Prints the milestone multiples plus ready-to-paste G1_ROWS / G1_CONTOURS
// JSON for the two chart scripts. Change CANON below to vary other knobs.
const { microInit, runMicro, microStats } = require("./model_micro.js");
const D = require("./micro_data.json");
const M = require("./model.json");
const S = microInit(D, M);
const CANON = { housing: "flat", biz: "absorb", penEq: 1.0, penWage: "fixed",
                creditsDie: false, neutral: process.env.G1_NEUTRAL || "prop" };

const base = Float64Array.from(runMicro(S, { ...CANON, labourFrac: 1 }).post);
const bst = microStats(S, base);
const bp = bst.pctl.slice(), bE = bst.edei, b50base = bst.b50;
const w = S.w;
let wsum = 0;
for (let i = 0; i < S.n; i++) wsum += w[i];

const cache = {};
function run(m) {
  const key = m.toFixed(4);
  if (cache[key]) return cache[key];
  const r = runMicro(S, { ...CANON, labourFrac: 0, mult: m });
  const st = microStats(S, r.post);
  let whole = 0;
  for (let i = 0; i < S.n; i++) if (r.post[i] >= base[i]) whole += w[i];
  return cache[key] = { p: st.pctl.slice(), edei: st.edei, b50: st.b50,
                        whole: whole / wsum };
}
function bisect(f, lo, hi) {
  if (f(run(hi)) < 0) return null;
  if (f(run(lo)) >= 0) return lo;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (f(run(mid)) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const r2 = v => v === null ? null : Math.round(v * 100) / 100;

console.log(`convention: ${CANON.neutral} | baseline median $${Math.round(bp[50])} | baseline EDEI $${Math.round(bE)}\n`);

// --- ladder rungs (gen_ladder.js) ---
const rungs = [
  ["Median income restored", bisect(s => s.p[50] - bp[50], 1, 60)],
  ["EDEI (average welfare) restored", bisect(s => s.edei - bE, 1, 60)],
  ["10th-percentile income restored", bisect(s => s.p[10] - bp[10], 1, 60)],
  ["25th-percentile income restored", bisect(s => s.p[25] - bp[25], 1, 60)],
  ["75% of people at least as well off", bisect(s => s.whole - 0.75, 1, 60)],
  ["90% of people at least as well off", bisect(s => s.whole - 0.90, 1, 60)],
  ["95% of people at least as well off", bisect(s => s.whole - 0.95, 1, 200)],
  ["99% of people at least as well off", bisect(s => s.whole - 0.99, 1, 500)],
  ["Bottom-half share of income restored", bisect(s => s.b50 - b50base, 1, 500)],
].map(([label, v]) => [label, r2(v)]);
for (const [label, v] of rungs)
  console.log(`  ${label}: ${v === null ? "NEVER" : v + "x"}`);
console.log("\nG1_ROWS='" + JSON.stringify(rungs) + "'\n");

// --- end-state median contours (gen_phasemap5.js) ---
const medAt = m => run(m).p[50];
function medMult(target) {
  let lo = 0.2, hi = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (medAt(mid) < target) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}
const medLabel = "$" + Math.round(bp[50] / 1e3) + "k (2019 median)";
const contours = [
  { v: "$45k", m: medMult(45e3), col: "#d99000" },
  { v: medLabel, m: medMult(bp[50]), col: "#0b0b0b", bold: true },
  { v: "$90k", m: medMult(90e3), col: "#0ca30c" },
  { v: "$120k", m: medMult(120e3), col: "#067a2b" },
  { v: "$1M", m: medMult(1e6), col: "#4a3aa7" },
];
for (const c of contours) console.log(`  end-state median ${c.v}: ${c.m}x`);
console.log("\nG1_CONTOURS='" + JSON.stringify(contours) + "'");
