// Four alternative renderings of the five-year transition:
//  A time-axis percentile trajectories, B change-vs-2019 fan,
//  C small multiples, D heatmap.
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

const INK = "#0b0b0b", MUT = "#898781", AXIS = "#c3c2b7";
const T3 = 3e6, EXT = T3 + (T3 - 1e6) * 0.15;
function triY(axisY, seg) {
  const B = [0, 1e5, 1e6, T3];
  return v => {
    const vv = Math.min(Math.max(v, 0), EXT);
    let k = 1;
    while (k < 3 && vv > B[k]) k++;
    return axisY - seg * (k - 1) - seg * (vv - B[k - 1]) / (B[k] - B[k - 1]);
  };
}
function shell(W, H, body, file) {
  const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${body}</svg></body>`;
  fs.writeFileSync(file + ".html", html);
}
const fmtY = v => v === 0 ? "$0k" : v < 1e6 ? "$" + v / 1e3 + "k" : v === 1e6 ? "$1M" : "$3M";

// ---------- A: time on x, one line per percentile ----------
{
  const x0 = 148, y0 = 52, w = 640, W = 1010, seg = 160;
  const LH = 3 * seg + seg * (EXT - T3) / (T3 - 1e6);
  const axisY = y0 + LH;
  const yOf = triY(axisY, seg);
  const xOf = t => x0 + t / 5 * w;
  const PICK = [
    [10, "#0ca30c", "p10"], [25, "#1baf7a", "p25"], [50, "#2a78d6", "p50"],
    [75, "#7b68d9", "p75"], [90, "#d99000", "p90"], [99, "#d03b3b", "p99"],
  ];
  let o = `<text x="${x0 + w / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">Where six people end up: five years of 10% growth, 20-point displacement</text>`;
  for (let v = 100e3; v <= EXT + 1; v += 100e3) {
    const y = yOf(v), major = v === 1e5 || v === 1e6 || v === T3;
    o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#b8b6ac" : "#eceae2"}"/>`;
    if (major) o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${fmtY(v)}</text>`;
  }
  o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
  for (let t = 0; t <= 5; t++) {
    o += `<text x="${xOf(t)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${t === 0 ? "2019" : "yr " + t}</text>`;
    o += `<line x1="${xOf(t).toFixed(1)}" x2="${xOf(t).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
  }
  o += `<text x="${x0 - 62}" y="${(y0 + LH / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" fill="${INK}">Income</text>`;
  const ends = [];
  for (const [p, col, label] of PICK) {
    let d = "";
    for (let t = 0; t <= 5; t++)
      d += (t ? "L" : "M") + xOf(t).toFixed(1) + " " + yOf(years[t].s[p]).toFixed(1);
    o += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.3"/>`;
    for (let t = 0; t <= 5; t++)
      o += `<circle cx="${xOf(t).toFixed(1)}" cy="${yOf(years[t].s[p]).toFixed(1)}" r="3.4" fill="${col}"/>`;
    ends.push([label, col, yOf(years[5].s[p]), years[5].s[p], years[0].s[p]]);
  }
  ends.sort((a, b) => a[2] - b[2]);
  for (let i = 1; i < ends.length; i++)
    if (ends[i][2] - ends[i - 1][2] < 15) ends[i][2] = ends[i - 1][2] + 15;
  for (const [label, col, y, v5, v0] of ends)
    o += `<text x="${x0 + w + 10}" y="${(y + 4).toFixed(1)}" font-size="11.5" fill="${col}">${label}: $${Math.round(v0 / 1e3)}k → $${v5 < 1e6 ? Math.round(v5 / 1e3) + "k" : (v5 / 1e6).toFixed(1) + "M"}</text>`;
  shell(W, axisY + 40, o, "essay_alt_time");
}

// ---------- B: change vs 2019, one line per year ----------
{
  const x0 = 148, y0 = 52, w = 700, W = 1240, LH = 460;
  const axisY = y0 + LH, YMAX = 250;
  const yOf = pc => axisY - LH * Math.min(Math.max(pc, 0), YMAX) / YMAX;
  const xOf = p => x0 + (p + 0.5) / 100 * w;
  const YEARCOLS = ["#b7d1f0", "#84b0e4", "#5590d8", "#2f6dbd", "#16437f"];
  let o = `<text x="${x0 + w / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">Income as a share of 2019, percentile by percentile</text>`;
  for (let pc = 0; pc <= YMAX; pc += 25) {
    const y = yOf(pc), major = pc % 50 === 0;
    o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${pc === 100 ? "#0b0b0b" : major ? "#c9c8bf" : "#eceae2"}" ${pc === 100 ? 'stroke-width="1.6"' : ""}/>`;
    if (major) o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${pc}%</text>`;
  }
  for (let p = 0; p <= 90; p += 10) {
    o += `<text x="${xOf(p)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${p === 0 ? "p0" : "p" + p}</text>`;
    o += `<line x1="${xOf(p).toFixed(1)}" x2="${xOf(p).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
  }
  o += `<text x="${xOf(99)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">p99</text>`;
  o += `<text x="${x0 + w / 2}" y="${axisY + 38}" text-anchor="middle" font-size="12.5" fill="${INK}">Percentile</text>`;
  o += `<text x="${x0 + w - 4}" y="${yOf(100) - 8}" text-anchor="end" font-size="11" fill="${INK}">2019 level (100%)</text>`;
  for (let k = 1; k <= 5; k++) {
    let d = "", started = false;
    for (let p = 4; p < 100; p++) {
      const b = Math.max(base[p], 1000);
      const pc = 100 * years[k].s[p] / b;
      d += (started ? "L" : "M") + xOf(p).toFixed(1) + " " + yOf(pc).toFixed(1);
      started = true;
    }
    o += `<path d="${d}" fill="none" stroke="${YEARCOLS[k - 1]}" stroke-width="2.2"/>`;
  }
  const legX = x0 + w + 34;
  let ly = y0 + LH / 2 - 60;
  o += `<text x="${legX}" y="${ly - 20}" font-size="11" fill="${MUT}">(percentiles below p4 omitted:</text>`;
  o += `<text x="${legX}" y="${ly - 6}" font-size="11" fill="${MUT}">2019 incomes there are near zero)</text>`;
  ly += 16;
  for (let k = 1; k <= 5; k++) {
    o += `<line x1="${legX}" x2="${legX + 28}" y1="${ly - 4}" y2="${ly - 4}" stroke="${YEARCOLS[k - 1]}" stroke-width="2.6"/>`;
    o += `<text x="${legX + 36}" y="${ly}" font-size="12" fill="${INK}">year ${k}</text>`;
    ly += 22;
  }
  shell(W, axisY + 56, o, "essay_alt_ratio");
}

// ---------- C: small multiples ----------
{
  const PW = 330, PH = 230, GX = 60, GY = 64, MX = 120, MY = 56;
  const seg = PH / (3 + (EXT - T3) / (T3 - 1e6));
  const W = MX + 3 * PW + 2 * GX + 30, H = MY + 2 * PH + GY + 40;
  let o = `<text x="${W / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">The transition, year by year</text>`;
  for (let t = 0; t <= 5; t++) {
    const cx = MX + (t % 3) * (PW + GX), cy = MY + Math.floor(t / 3) * (PH + GY);
    const axisY = cy + PH;
    const yOf = triY(axisY, seg);
    const xOf = p => cx + (p + 0.5) / 100 * PW;
    o += `<text x="${cx + PW / 2}" y="${cy - 8}" text-anchor="middle" font-size="13" font-weight="600" fill="${INK}">${t === 0 ? "2019" : "Year " + t}</text>`;
    for (const v of [1e5, 1e6, T3]) {
      const y = yOf(v);
      o += `<line x1="${cx}" x2="${cx + PW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#dddbd2"/>`;
      o += `<text x="${cx - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUT}">${fmtY(v)}</text>`;
    }
    o += `<line x1="${cx}" x2="${cx + PW}" y1="${axisY}" y2="${axisY}" stroke="${AXIS}"/>`;
    for (const p of [0, 50, 99])
      o += `<text x="${xOf(p).toFixed(1)}" y="${axisY + 14}" text-anchor="middle" font-size="10" fill="${MUT}">p${p}</text>`;
    let dg = "";
    for (let p = 0; p < 100; p++)
      dg += (p ? "L" : "M") + xOf(p).toFixed(1) + " " + yOf(base[p]).toFixed(1);
    if (t > 0) o += `<path d="${dg}" fill="none" stroke="#b5b3aa" stroke-width="1.6"/>`;
    if (t === 0) {
      let d = "";
      for (let p = 0; p < 100; p++)
        d += (p ? "L" : "M") + xOf(p).toFixed(1) + " " + yOf(years[t].s[p]).toFixed(1);
      o += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
    } else {
      const dd = { g: "", r: "" };
      for (let p = 0; p < 99; p++) {
        const c = years[t].s[p + 1] >= base[p + 1] ? "g" : "r";
        dd[c] += `M${xOf(p).toFixed(1)} ${yOf(years[t].s[p]).toFixed(1)}L${xOf(p + 1).toFixed(1)} ${yOf(years[t].s[p + 1]).toFixed(1)}`;
      }
      if (dd.g) o += `<path d="${dd.g}" fill="none" stroke="#0ca30c" stroke-width="2.2"/>`;
      if (dd.r) o += `<path d="${dd.r}" fill="none" stroke="#d03b3b" stroke-width="2.2"/>`;
    }
  }

  shell(W, H, o, "essay_alt_small");
}

// ---------- D: heatmap ----------
{
  const x0 = 148, y0 = 72, cw = 7, ch = 44, W = 1010;
  const axisY = y0 + 5 * ch;
  let o = `<text x="${x0 + 350}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">Change vs 2019: every percentile, every year</text>`;
  const colOf = r => {
    if (r >= 1) {
      const s = Math.min((r - 1) / 1, 1);
      const mix = (a, b) => Math.round(a + (b - a) * s);
      return `rgb(${mix(252, 12)},${mix(252, 163)},${mix(251, 12)})`;
    }
    const s = Math.min((1 - r) / 1, 1);
    const mix = (a, b) => Math.round(a + (b - a) * s);
    return `rgb(${mix(252, 208)},${mix(252, 59)},${mix(251, 59)})`;
  };
  for (let k = 1; k <= 5; k++) {
    o += `<text x="${x0 - 10}" y="${y0 + (k - 1) * ch + ch / 2 + 4}" text-anchor="end" font-size="12" fill="${INK}">year ${k}</text>`;
    for (let p = 0; p < 100; p++) {
      const b = Math.max(base[p], 1000);
      const r = years[k].s[p] / b;
      o += `<rect x="${x0 + p * cw}" y="${y0 + (k - 1) * ch}" width="${cw}" height="${ch}" fill="${colOf(r)}"/>`;
    }
  }
  for (let p = 0; p <= 90; p += 10)
    o += `<text x="${x0 + p * cw + cw / 2}" y="${axisY + 18}" text-anchor="middle" font-size="11" fill="${MUT}">${p === 0 ? "p0" : "p" + p}</text>`;
  o += `<text x="${x0 + 99 * cw + cw / 2}" y="${axisY + 18}" text-anchor="middle" font-size="11" fill="${MUT}">p99</text>`;
  o += `<text x="${x0 + 350}" y="${axisY + 40}" text-anchor="middle" font-size="12.5" fill="${INK}">Percentile</text>`;
  // colour bar
  const bx = x0 + 720, by = y0 + 10;
  for (let i = 0; i <= 40; i++) {
    const r = i / 20;
    o += `<rect x="${bx}" y="${by + (40 - i) * 3}" width="14" height="3" fill="${colOf(r)}"/>`;
  }
  o += `<text x="${bx + 20}" y="${by + 126}" font-size="10.5" fill="${MUT}">0% of 2019</text>`;
  o += `<text x="${bx + 20}" y="${by + 66}" font-size="10.5" fill="${MUT}">100% (unchanged)</text>`;
  o += `<text x="${bx + 20}" y="${by + 6}" font-size="10.5" fill="${MUT}">200%+</text>`;
  shell(W, axisY + 60, o, "essay_alt_heat");
}
console.log("done");
