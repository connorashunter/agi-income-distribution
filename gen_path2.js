// Five-year transition path in the canonical house style: tri axis ($100k/$1M/$3M
// majors, $100k minors, overshoot headroom), staircase percentile lines, one per
// year; year 0 black, later years coloured per percentile: green above 2019,
// amber above 2019 but below the previous year, red below 2019.
const fs = require("fs");
const { microInit, runMicro, microStats } = require("./model_micro.js");
const D = require("./micro_data.json");
const M = require("./model.json");
const S = microInit(D, M);
const CANON = { housing: "flat", biz: "absorb", penEq: 1.0, penWage: "fixed",
                creditsDie: false };

const years = [];
for (let t = 0; t <= 5; t++) {
  const r = runMicro(S, { ...CANON, mult: Math.pow(1.10, t),
                          labourFrac: Math.max(0, 1 - 0.2 * t) });
  const st = microStats(S, r.post);
  years.push({ t, s: st.pctl.slice(), edei: st.edei });
}
const base = years[0].s;
console.log("EDEI path:", years.map(y => Math.round(y.edei)).join(", "));

const GOOD = "#0ca30c", BAD = "#d03b3b", SLIP = "#d99000";
const INK = "#0b0b0b", MUT = "#898781", AXIS = "#c3c2b7";
const x0 = 148, y0 = 52, w = 700, W = 1240;
const T3 = 3e6, EXT = T3 + (T3 - 1e6) * 0.15, seg = 160;
const TRIB = [0, 1e5, 1e6, T3];
const LH = 3 * seg + seg * (EXT - T3) / (T3 - 1e6);
const axisY = y0 + LH;
const yOf = v => {
  const vv = Math.min(Math.max(v, 0), EXT);
  let k = 1;
  while (k < 3 && vv > TRIB[k]) k++;
  return axisY - seg * (k - 1) - seg * (vv - TRIB[k - 1]) / (TRIB[k] - TRIB[k - 1]);
};
const xOf = p => x0 + (p + 0.5) / 100 * w;

let o = `<text x="${x0 + w / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">Five years of AGI: 10% growth and 20 points of labour displacement per year</text>
<clipPath id="cp"><rect x="${x0}" y="${y0}" width="${w}" height="${LH}"/></clipPath>`;
for (let v = 100e3; v <= EXT + 1; v += 100e3) {
  const y = yOf(v), major = v === 1e5 || v === 1e6 || v === T3;
  o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#b8b6ac" : "#eceae2"}"/>`;
  if (major)
    o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${v === 1e5 ? "$100k" : v === 1e6 ? "$1M" : "$3M"}</text>`;
}
o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
for (let p = 0; p <= 90; p += 10) {
  o += `<text x="${xOf(p)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${p === 0 ? "p0" : "p" + p}</text>`;
  o += `<line x1="${xOf(p).toFixed(1)}" x2="${xOf(p).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
}
o += `<text x="${xOf(99)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">p99</text>`;
o += `<line x1="${xOf(99).toFixed(1)}" x2="${xOf(99).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
o += `<text x="${x0 + w / 2}" y="${axisY + 38}" text-anchor="middle" font-size="12.5" fill="${INK}">Percentile</text>`;
o += `<text x="${x0 - 62}" y="${(y0 + LH / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" fill="${INK}">Income</text>`;

// staircase per year; year 0 black, later years coloured per percentile slot
function stairPaths(s, cls) {
  const paths = { g: "", a: "", r: "", k: "" };
  for (let p = 0; p < 99; p++) {
    const c = cls ? cls(p + 1) : "k";
    paths[c] += `M${xOf(p).toFixed(2)} ${yOf(s[p]).toFixed(2)}L${xOf(p + 1).toFixed(2)} ${yOf(s[p + 1]).toFixed(2)}`;
  }
  return paths;
}
const COLS = { g: GOOD, a: SLIP, r: BAD, k: INK };
const YEARCOLS = ["#b7d1f0", "#84b0e4", "#5590d8", "#2f6dbd", "#16437f"];
const MODEY = process.env.G1_PATHMODE === "years";
o += `<path d="${stairPaths(base, null).k}" fill="none" stroke="${INK}" stroke-width="2.6" clip-path="url(#cp)"/>`;
for (let k = 1; k < years.length; k++) {
  const yr = years[k], prev = years[k - 1];
  if (MODEY) {
    o += `<path d="${stairPaths(yr.s, null).k}" fill="none" stroke="${YEARCOLS[k - 1]}" stroke-width="2" clip-path="url(#cp)"/>`;
    continue;
  }
  const op = (0.45 + 0.55 * k / 5).toFixed(2);
  const cls = p => yr.s[p] < base[p] ? "r" : yr.s[p] < prev.s[p] ? "a" : "g";
  const paths = stairPaths(yr.s, cls);
  for (const c of ["g", "a", "r"])
    if (paths[c])
      o += `<path d="${paths[c]}" fill="none" stroke="${COLS[c]}" stroke-width="1.9" stroke-opacity="${op}" clip-path="url(#cp)"/>`;
}

// legend, right of the plot, vertically centred
const LEG = MODEY
  ? [[INK, "2019 (year 0)"],
     [YEARCOLS[0], "year 1"], [YEARCOLS[1], "year 2"], [YEARCOLS[2], "year 3"],
     [YEARCOLS[3], "year 4"], [YEARCOLS[4], "year 5"]]
  : [
  [INK, "2019 (year 0)"],
  [GOOD, "above 2019"],
  [SLIP, "above 2019, but fell vs", "the previous year"],
  [BAD, "below 2019"],
];
const legX = x0 + w + 34;
let ly = y0 + LH / 2 - 50;
for (const [c, label, label2] of LEG) {
  o += `<line x1="${legX}" x2="${legX + 28}" y1="${ly - 4}" y2="${ly - 4}" stroke="${c}" stroke-width="2.6"/>`;
  o += `<text x="${legX + 36}" y="${ly}" font-size="12" fill="${INK}">${label}</text>`;
  if (label2) { ly += 15; o += `<text x="${legX + 36}" y="${ly}" font-size="12" fill="${INK}">${label2}</text>`; }
  ly += 24;
}
// EDEI by year strip
o += `<text x="${x0}" y="${axisY + 64}" font-size="11.5" font-weight="600" fill="${INK}">EDEI by year:</text>`;
years.forEach((yr, k) => {
  const col = k === 0 ? MUT : yr.edei >= base ? "" : "";
  const c = k === 0 ? MUT : (yr.edei >= years[0].edei ? GOOD : BAD);
  o += `<text x="${x0 + 100 + k * 100}" y="${axisY + 64}" font-size="11.5" fill="${c}">yr${yr.t}: $${(yr.edei / 1000).toFixed(1)}k</text>`;
});

const H = axisY + 84;
const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${o}</svg></body>`;
fs.writeFileSync((process.env.G1_OUT || "essay_g_path") + ".html", html);
console.log("written");
