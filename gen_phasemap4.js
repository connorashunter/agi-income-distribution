// Phase map, median edition, current canonical assumptions: economies as
// year-by-year dots in (cumulative displacement, cumulative growth) space.
// Frontier line: growth multiple at which the MEDIAN income equals 2019.
const fs = require("fs");
const { microInit, runMicro, microStats } = require("./model_micro.js");
const D = require("./micro_data.json");
const M = require("./model.json");
const S = microInit(D, M);
const CANON = { housing: "flat", biz: "absorb", penEq: 1.0, penWage: "fixed",
                creditsDie: false };

const cache = new Map();
function MED(mult, disp) {
  const k = mult.toFixed(5) + "|" + disp.toFixed(5);
  if (!cache.has(k))
    cache.set(k, microStats(S, runMicro(S,
      { mult, labourFrac: 1 - disp, ...CANON }).post).pctl[50]);
  return cache.get(k);
}
const baseMed = MED(1, 0);
console.log("baseline median", Math.round(baseMed));

// contour family: multiple needed at each displacement for a given median value
function contour(target) {
  const pts = [];
  for (let d = 0.02; d <= 1.0001; d += 0.049) {
    if (MED(1, d) >= target) { pts.push([d, 1]); continue; }
    let lo = 1, hi = 8;
    if (MED(hi, d) < target) { pts.push([d, null]); continue; }
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (MED(mid, d) < target) lo = mid; else hi = mid;
    }
    pts.push([d, (lo + hi) / 2]);
  }
  return pts;
}
const FRONT = contour(baseMed);
const ISO = [50e3, 55e3, 65e3, 70e3].map(v => ({ v, pts: contour(v) }));

const TRAJ = [
  ["Fast takeoff, fast growth (25pt/yr · 25%/yr)", 0.25, 0.25, 14],
  ["Fast takeoff, modest growth (25pt/yr · 8%/yr)", 0.25, 0.08, 14],
  ["The knife edge (20pt/yr · 15.5%/yr)", 0.20, 0.155, 14],
  ["The essay's example (20pt/yr · 10%/yr)", 0.20, 0.10, 14],
  ["Slow AI, strong growth (10pt/yr · 12%/yr)", 0.10, 0.12, 14],
  ["History continues (⅓pt/yr · 2%/yr)", 0.10 / 30, 0.02, 30],
];
const GOOD = "#0ca30c", BAD = "#d03b3b", SLIP = "#d99000",
      INK = "#0b0b0b", MUT = "#898781", GRID = "#e1e0d9";

const x0 = 148, y0 = 66, w = 640, h = 470, W = 1120, H = 660;
const MMAX = 3.2;
const xOf = d => x0 + d * w;
const yOf = m => y0 + h * (1 - Math.log(m) / Math.log(MMAX));
let out = `<text x="${x0 + w / 2}" y="28" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">Staying ahead of the frontier</text>
<text x="${x0 + w / 2}" y="50" text-anchor="middle" font-size="12" fill="${MUT}">each dot = one year of a transition</text>`;
for (const m of [1, 1.5, 2, 2.5, 3]) {
  const y = yOf(m);
  out += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}"/>`;
  out += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${m.toFixed(1)}&#215;</text>`;
}
for (let d = 0; d <= 1; d += 0.25)
  out += `<text x="${xOf(d).toFixed(1)}" y="${y0 + h + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${Math.round(d * 100)}%</text>`;
out += `<text x="${x0 + w / 2}" y="${y0 + h + 40}" text-anchor="middle" font-size="12.5" fill="${INK}">Share of labour income displaced</text>`;
out += `<text x="${x0 - 56}" y="${(y0 + h / 2 - 10).toFixed(0)}" text-anchor="end" font-size="12.5" fill="${INK}">Total</text>`;
out += `<text x="${x0 - 56}" y="${(y0 + h / 2 + 8).toFixed(0)}" text-anchor="end" font-size="12.5" fill="${INK}">income</text>`;
// faint iso-median contours behind everything
for (const iso of ISO) {
  const seg = iso.pts.filter(([d, m]) => m !== null && m <= MMAX);
  if (seg.length < 2) continue;
  out += `<polyline points="${seg.map(([d, m]) => xOf(d).toFixed(1) + "," + yOf(m).toFixed(1)).join(" ")}" fill="none" stroke="#d8d6cc" stroke-width="1.2"/>`;
  const [ld, lm] = seg[seg.length - 1];
  if (ld > 0.99)
    out += `<text x="${(xOf(ld) + 6).toFixed(1)}" y="${(yOf(lm) + 4).toFixed(1)}" font-size="10" fill="#a7a59a">$${iso.v / 1e3}k</text>`;
  else
    out += `<text x="${(xOf(ld)).toFixed(1)}" y="${(yOf(lm) - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="#a7a59a">$${iso.v / 1e3}k</text>`;
}
// frontier
out += `<polyline points="${FRONT.map(([d, m]) => xOf(d).toFixed(1) + "," + yOf(Math.min(m, MMAX)).toFixed(1)).join(" ")}" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
const fEnd = FRONT[FRONT.length - 1];
{
  const tx = x0 + w - 156, ty2 = yOf(1.12);
  out += `<text x="${tx.toFixed(1)}" y="${(ty2 + 4).toFixed(1)}" text-anchor="end" font-size="11.5" font-weight="600" fill="${INK}">median = 2019 frontier</text>`;
  const fi = FRONT[Math.round((0.87 - 0.02) / 0.049)];
  const ex2 = xOf(fi[0]), ey2 = yOf(fi[1]) + 8;
  const sx2 = x0 + w - 156, sy2 = ty2 - 8;
  const cx2 = (sx2 + ex2) / 2 + 30, cy2 = (sy2 + ey2) / 2 + 24;
  out += `<path d="M${sx2.toFixed(1)} ${sy2.toFixed(1)} Q${cx2.toFixed(1)} ${cy2.toFixed(1)} ${ex2.toFixed(1)} ${ey2.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  const ang2 = Math.atan2(ey2 - cy2, ex2 - cx2);
  for (const da of [Math.PI * 0.82, -Math.PI * 0.82]) {
    const hx = ex2 + 7 * Math.cos(ang2 + da), hy = ey2 + 7 * Math.sin(ang2 + da);
    out += `<line x1="${ex2.toFixed(1)}" y1="${ey2.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${INK}" stroke-width="1.3"/>`;
  }
}

// trajectories
const labelPos = [];
for (const [name, dr, gr, horizon] of TRAJ) {
  const pts = [{ d: 0, m: 1, v: baseMed, t: 0 }];
  for (let t = 1; t <= horizon; t++) {
    const d = Math.min(1, dr * t), m = Math.pow(1 + gr, t);
    pts.push({ d, m, v: MED(m, d), t });
    if (d >= 1) break;
  }
  out += `<polyline points="${pts.map(p => xOf(p.d).toFixed(1) + "," + yOf(Math.min(p.m, MMAX)).toFixed(1)).join(" ")}" fill="none" stroke="#b9b7b0" stroke-width="1.3"/>`;
  pts.forEach((p, k) => {
    const c = k === 0 ? MUT
      : p.v < baseMed ? BAD
      : p.v < pts[k - 1].v ? SLIP : GOOD;
    const y = yOf(Math.min(p.m, MMAX));
    out += `<circle cx="${xOf(p.d).toFixed(1)}" cy="${y.toFixed(1)}" r="${horizon > 14 ? 5 : 6.5}" fill="${c}" stroke="#fcfcfb" stroke-width="1.5"/>`;
    if (k > 0 && (horizon <= 14 || p.t % 5 === 0))
      out += `<text x="${xOf(p.d).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">${p.t}</text>`;
  });
  const lp = pts[pts.length - 1];
  labelPos.push([name, xOf(lp.d), yOf(Math.min(lp.m, MMAX))]);
}
labelPos.sort((a, b) => a[2] - b[2]);
for (let i = 1; i < labelPos.length; i++)
  if (labelPos[i][2] - labelPos[i - 1][2] < 16) labelPos[i][2] = labelPos[i - 1][2] + 16;
for (const [name, x, y] of labelPos)
  out += `<text x="${Math.min(x + 12, x0 + w + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11.5" fill="${INK}">${name}</text>`;

const ly = y0 + h + 64;
out += `<circle cx="${x0 + 6}" cy="${ly}" r="6" fill="${GOOD}"/><text x="${x0 + 18}" y="${ly + 4}" font-size="11.5" fill="${INK}">median above 2019</text>`;
out += `<circle cx="${x0 + 168}" cy="${ly}" r="6" fill="${SLIP}"/><text x="${x0 + 180}" y="${ly + 4}" font-size="11.5" fill="${INK}">above 2019, fell this year</text>`;
out += `<circle cx="${x0 + 352}" cy="${ly}" r="6" fill="${BAD}"/><text x="${x0 + 364}" y="${ly + 4}" font-size="11.5" fill="${INK}">below 2019</text>`;

const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${out}</svg></body>`;
fs.writeFileSync("essay_g_phasemap.html", html);
console.log("done,", cache.size, "engine runs");
