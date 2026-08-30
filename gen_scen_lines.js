// Four scenario skylines on one tri-band axis: 2019 baseline, backstop,
// no backstop, and safety-net re-enrollment. No stacks, just outlines.
const fs = require("fs");
const { microInit, runMicro, microStats } = require("./model_micro.js");
const D = require("./micro_data.json");
const M = require("./model.json");
const PROG = require("./micro_prog.json");
const S = microInit(D, M);
const CANON = { housing: "flat", biz: "absorb", penEq: 1.0, penWage: "fixed",
                creditsDie: false };

function pctlOf(opts, safetyNet) {
  const r = runMicro(S, { ...CANON, ...opts });
  if (!safetyNet) {
    const st = microStats(S, r.post);
    return { p: st.pctl.slice(), edei: st.edei };
  }
  const n = S.n, wgt = S.w;
  let mSum = 0, mW = 0, sSum = 0, sW = 0;
  for (let i = 0; i < n; i++) {
    if (PROG.medicaid[i] > 0) { mSum += PROG.medicaid[i] * wgt[i]; mW += wgt[i]; }
    if (PROG.snap[i] > 0) { sSum += PROG.snap[i] * wgt[i]; sW += wgt[i]; }
  }
  const mAvg = mSum / mW, sAvg = sSum / sW;
  const post2 = Float64Array.from(r.post);
  for (let i = 0; i < n; i++) {
    if (r.post[i] < 17236 && PROG.medicaid[i] <= 0) post2[i] += mAvg;
    if (r.post[i] < 16237 && PROG.snap[i] <= 0) post2[i] += sAvg;
  }
  const st2 = microStats(S, post2);
  return { p: st2.pctl.slice(), edei: st2.edei };
}

const SCEN = [
  { label: "2019 (status quo ante machina)", col: "#0b0b0b",
    run: () => pctlOf({ labourFrac: 1 }) },
  { label: "Labour at zero, benefits held", col: "#d99000",
    run: () => pctlOf({ labourFrac: 0 }) },
  { label: "Labour at zero, no political backstop", col: "#d03b3b",
    run: () => pctlOf({ labourFrac: 0, penWage: "dies", creditsDie: true }) },
  { label: "Labour at zero, safety-net rules enrolled", col: "#0ca30c",
    run: () => pctlOf({ labourFrac: 0 }, true) },
];
for (const sc of SCEN) {
  const res = sc.run();
  sc.p = res.p; sc.edei = res.edei;
  console.log(sc.label, "EDEI", Math.round(sc.edei));
}

const INK = "#0b0b0b", MUT = "#898781", AXIS = "#c3c2b7";
const x0 = 148, y0 = 52, w = 700, W = 1010, LH = 480;
const T3 = 3.3e6, B = [0, 1e5, 1e6, T3], seg = LH / 3;
const axisY = y0 + LH;
const yOf = v => {
  const vv = Math.min(Math.max(v, 0), T3);
  let k = 1;
  while (k < 3 && vv > B[k]) k++;
  return axisY - seg * (k - 1) - seg * (vv - B[k - 1]) / (B[k] - B[k - 1]);
};
const xOf = p => x0 + (p + 0.5) / 100 * w;
const fmt = v => v === 0 ? "$0k" : v < 1e6 ? "$" + v / 1e3 + "k" : "$" + (v / 1e6).toFixed(1) + "M";

let o = `<text x="${x0 + w / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">The no-labour economy: three endings, one starting point</text>
<clipPath id="cp"><rect x="${x0}" y="${y0}" width="${w}" height="${LH}"/></clipPath>`;
for (let v = 100e3; v <= 1e6; v += 100e3) {
  const y = yOf(v), major = v === 1e5 || v === 1e6;
  o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#c3c2b7" : "#eceae2"}"/>`;
  if (major) o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${fmt(v)}</text>`;
}
for (let v = 1.5e6; v < T3 - 1; v += 5e5)
  o += `<line x1="${x0}" x2="${x0 + w}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}" stroke="#eceae2"/>`;
o += `<line x1="${x0}" x2="${x0 + w}" y1="${yOf(T3).toFixed(1)}" y2="${yOf(T3).toFixed(1)}" stroke="#c3c2b7"/>`;
o += `<text x="${x0 - 8}" y="${(yOf(T3) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${fmt(T3)}</text>`;
o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
for (let p = 0; p <= 90; p += 10) {
  o += `<text x="${xOf(p)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${p === 0 ? "p0" : "p" + p}</text>`;
  o += `<line x1="${xOf(p).toFixed(1)}" x2="${xOf(p).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
}
o += `<text x="${xOf(99)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">p99</text>`;
o += `<line x1="${xOf(99).toFixed(1)}" x2="${xOf(99).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
o += `<text x="${x0 + w / 2}" y="${axisY + 38}" text-anchor="middle" font-size="12.5" fill="${INK}">Percentile</text>`;
o += `<text x="${x0 - 62}" y="${(y0 + LH / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" fill="${INK}">Income</text>`;

for (const sc of SCEN) {
  let d = "";
  for (let p = 0; p < 100; p++) {
    const y = yOf(sc.p[p]).toFixed(2);
    const xL = (x0 + p * w / 100).toFixed(2), xR = (x0 + (p + 1) * w / 100).toFixed(2);
    d += (p ? `L${xL} ${y}` : `M${xL} ${y}`) + `H${xR}`;
  }
  o += `<path d="${d}" fill="none" stroke="${sc.col}" stroke-width="2.2" stroke-linejoin="miter" clip-path="url(#cp)"/>`;
}

// legend, upper-left inside the plot
let ly = y0 + 26;
for (const sc of SCEN) {
  o += `<line x1="${x0 + 18}" x2="${x0 + 46}" y1="${ly - 4}" y2="${ly - 4}" stroke="${sc.col}" stroke-width="2.6"/>`;
  o += `<text x="${x0 + 54}" y="${ly}" font-size="12" fill="${INK}">${sc.label}</text>`;
  o += `<text x="${x0 + 54}" y="${ly + 14}" font-size="10.5" fill="${MUT}">EDEI $${(sc.edei / 1000).toFixed(1)}k</text>`;
  ly += 38;
}

const H = axisY + 56;
const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${o}</svg></body>`;
fs.writeFileSync("essay_g_scenlines.html", html);
console.log("written");
