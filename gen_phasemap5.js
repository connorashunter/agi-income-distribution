// The original phase map, median edition: x = years to full displacement,
// y = annual growth rate (log). Contours = end-state median income once labour
// is fully displaced; the 2019-median contour is the frontier.
const fs = require("fs");

// end-state total-income multiples for each end-state median (computed from the
// micro engine under canonical assumptions: penEq 1.0, SS held, credits kept)
const CONTOURS = [
  { v: "$45k", m: 1.400, col: "#d99000" },
  { v: "$60k (2019 median)", m: 1.921, col: "#0b0b0b", bold: true },
  { v: "$90k", m: 2.974, col: "#0ca30c" },
  { v: "$120k", m: 3.987, col: "#067a2b" },
  { v: "$1M", m: 33.36, col: "#4a3aa7" },
];

const INK = "#0b0b0b", MUT = "#898781", GRID = "#e1e0d9", AXIS = "#c3c2b7";
const x0 = 148, y0 = 66, w = 640, h = 470, W = 1060;
const axisY = y0 + h;
const TMIN = 1, TMAX = 30;
const GMIN = 0.01, GMAX = 3.0;   // 1% .. 300% per year
const xOf = t => x0 + w * (t - TMIN) / (TMAX - TMIN);
const yOf = g => axisY - h * Math.log(g / GMIN) / Math.log(GMAX / GMIN);

let o = `<text x="${x0 + w / 2}" y="28" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">How fast must the pie grow?</text>
`;
for (const g of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 3]) {
  const y = yOf(g);
  o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}"/>`;
  o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${g < 1 ? (g * 100) + "%" : (g * 100) + "%"}</text>`;
}
for (const t of [1, 5, 10, 15, 20, 25, 30]) {
  o += `<text x="${xOf(t).toFixed(1)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${t}</text>`;
  o += `<line x1="${xOf(t).toFixed(1)}" x2="${xOf(t).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
}
o += `<text x="${x0 + w / 2}" y="${axisY + 40}" text-anchor="middle" font-size="12.5" fill="${INK}">Years until labour income is fully displaced</text>`;
o += `<text x="${x0 - 56}" y="${(y0 + h / 2 - 18).toFixed(0)}" text-anchor="end" font-size="12.5" fill="${INK}">Growth</text>`;
o += `<text x="${x0 - 56}" y="${(y0 + h / 2).toFixed(0)}" text-anchor="end" font-size="12.5" fill="${INK}">per year</text>`;

// reference lines: historical 2%/yr and AGI-optimist 10%/yr
const y2 = yOf(0.02);
o += `<line x1="${x0}" x2="${x0 + w}" y1="${y2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#7a99c0" stroke-width="1.4" stroke-dasharray="6 4"/>`;
o += `<text x="${x0 + 6}" y="${(y2 - 7).toFixed(1)}" font-size="10.5" fill="#5577a5">historical growth (~2%/yr)</text>`;
const y10 = yOf(0.10);
o += `<line x1="${x0}" x2="${x0 + w}" y1="${y10.toFixed(1)}" y2="${y10.toFixed(1)}" stroke="#7a99c0" stroke-width="1.4" stroke-dasharray="6 4"/>`;
o += `<text x="${(x0 + 0.72 * w).toFixed(0)}" y="${(y10 - 7).toFixed(1)}" font-size="10.5" fill="#5577a5">speculative AGI growth (10%/yr)</text>`;

// contours: g(T) = m^(1/T) - 1
const labels = [];
for (const c of CONTOURS) {
  let d = "", started = false;
  for (let t = TMIN; t <= TMAX + 1e-9; t += 0.25) {
    const g = Math.pow(c.m, 1 / t) - 1;
    if (g > GMAX || g < GMIN) { continue; }
    d += (started ? "L" : "M") + xOf(t).toFixed(1) + " " + yOf(g).toFixed(1);
    started = true;
  }
  o += `<path d="${d}" fill="none" stroke="${c.col}" stroke-width="${c.bold ? 2.8 : 2}"/>`;
  const gEnd = Math.max(Math.pow(c.m, 1 / TMAX) - 1, GMIN);
  labels.push([c, yOf(gEnd)]);
}
labels.sort((a, b) => a[1] - b[1]);
for (let i = 1; i < labels.length; i++)
  if (labels[i][1] - labels[i - 1][1] < 16) labels[i][1] = labels[i - 1][1] + 16;
for (const [c, y] of labels)
  o += `<text x="${x0 + w + 10}" y="${(y + 4).toFixed(1)}" font-size="11.5" font-weight="${c.bold ? 700 : 400}" fill="${c.col}">${c.v}</text>`;

const H = axisY + 60;
const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${o}</svg></body>`;
fs.writeFileSync("essay_g_phasemap2.html", html);
console.log("written");
