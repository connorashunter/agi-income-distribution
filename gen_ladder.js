// The growth ladder: how many times larger the no-labour economy must be to
// buy back each milestone. Horizontal bars, log x-axis, "never" rows hatched.
const fs = require("fs");

const ROWS = process.env.G1_ROWS ? JSON.parse(process.env.G1_ROWS) : [
  ["Median income restored", 1.92],
  ["EDEI (average welfare) restored", 1.95],
  ["25th-percentile income restored", 2.52],
  ["10th-percentile income restored", 3.31],
  ["75% of people at least as well off", 3.76],
  ["90% of people at least as well off", 7.44],
  ["95% of people at least as well off", 15.2],
  ["99% of people at least as well off", null],
  ["Bottom half's share of income restored", null],
];

const INK = "#0b0b0b", MUT = "#898781", AXIS = "#c3c2b7", BAR = "#2a78d6", NEV = "#d03b3b";
const x0 = 320, y0 = 64, w = 620, rowH = 44, W = 1030;
const XMAX = 22, axisY = y0 + ROWS.length * rowH + 8;
const xOf = m => x0 + w * (m - 1) / (XMAX - 1);

let o = `<text x="${(x0 + w / 2 - 90).toFixed(0)}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">${process.env.G1_TITLE || "What growth has to buy back"}</text>`;
for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]) {
  const x = xOf(t);
  o += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y0 - 12}" y2="${axisY}" stroke="${t === 1 ? "#b8b6ac" : "#eceae2"}"/>`;
  if (t <= 5 || t % 5 === 0 || t === 15)
    o += `<text x="${x.toFixed(1)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${t}&#215;</text>`;
}
o += `<text x="${x0 + w / 2}" y="${axisY + 40}" text-anchor="middle" font-size="12.5" fill="${INK}">Total income required, as a multiple of 2019</text>`;

ROWS.forEach(([label, v], i) => {
  const yc = y0 + i * rowH + rowH / 2;
  o += `<text x="${x0 - 12}" y="${yc + 4}" text-anchor="end" font-size="12.5" fill="${INK}">${label}</text>`;
  if (v !== null) {
    const xe = xOf(v);
    o += `<rect x="${x0}" y="${yc - 10}" width="${(xe - x0).toFixed(1)}" height="20" rx="3" fill="${BAR}" fill-opacity="0.85"/>`;
    o += `<text x="${(xe + 8).toFixed(1)}" y="${yc + 4}" font-size="12" font-weight="600" fill="${INK}">${v.toFixed(1).replace(/\.0$/, "")}&#215;</text>`;
  } else {
    // hatched bar running off the right edge, arrowhead
    o += `<defs><pattern id="hx${i}" width="7" height="20" patternUnits="userSpaceOnUse"><rect width="7" height="20" fill="#f6d9d9"/><line x1="0" y1="20" x2="7" y2="0" stroke="${NEV}" stroke-width="1.1"/></pattern></defs>`;
    o += `<rect x="${x0}" y="${yc - 10}" width="${w}" height="20" fill="url(#hx${i})"/>`;
    o += `<path d="M${x0 + w} ${yc - 10}L${x0 + w + 14} ${yc}L${x0 + w} ${yc + 10}Z" fill="${NEV}" fill-opacity="0.6"/>`;
    o += `<text x="${x0 + w + 22}" y="${yc + 4}" font-size="12" font-weight="600" fill="${NEV}">never</text>`;
  }
});
o += `<line x1="${xOf(1).toFixed(1)}" x2="${xOf(1).toFixed(1)}" y1="${y0 - 12}" y2="${axisY}" stroke="#b8b6ac" stroke-width="1.4"/>`;

const H = axisY + 58;
const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${o}</svg></body>`;
fs.writeFileSync((process.env.G1_OUT || "essay_g_ladder") + ".html", html);
console.log("written");
