// Essay Graph 1, v4: 15-layer disaggregation using recorded PSZ sub-components
// (micro_fracs.json = per-adult split fractions in the same peinc-sorted order
// as micro_data.json). Same clamp-negatives-and-rescale rule as microLayers.
const fs = require("fs");
const { microInit, runMicro, microStats } = require("./model_micro.js");
const D = require("./micro_data.json");
const M = require("./model.json");
const F = require("./micro_fracs.json");
const S = microInit(D, M);
const CANON = { housing: "flat", biz: "absorb", penEq: 1.0, penWage: "fixed",
                creditsDie: false };

const INK = "#0b0b0b", MUT = "#898781", GRID = "#e1e0d9", AXIS = "#c3c2b7";
// bottom-of-stack -> top
const LAYERS = [
  // Government
  { grp: "Government", col: "#1baf7a", label: "Cash & near-cash transfers" },
  { grp: "Government", col: "#a5d6a5", label: "Other in-kind transfers" },
  { grp: "Government", col: "#5d8a5d", label: "Defence, police, roads, administration" },
  { grp: "Government", col: "#8fbc8f", label: "Public education" },
  { grp: "Government", col: "#77a677", label: "Social Security disability" },
  { grp: "Government", col: "#cfe3cf", label: "Unemployment insurance" },
  // Healthcare
  { grp: "Healthcare", col: "#d4586d", label: "Medicare & Medicaid (transfer)" },
  { grp: "Healthcare", col: "#f0a3b4", label: "Employer health insurance (labour)" },
  // Old-age income
  { grp: "Old-age income", col: "#8c6d46", label: "Social Security old-age (transfer)" },
  { grp: "Old-age income", col: "#b09468", label: "Pension income (non-Social Security)" },
  { grp: "Old-age income", col: "#d6bd93", label: "Pension contributions (labour)" },
  // Capital
  { grp: "Capital", col: "#4a3aa7", label: "Pension asset earnings (mostly public)" },
  { grp: "Capital", col: "#7b68d9", label: "Equity earnings (mostly public)" },
  { grp: "Capital", col: "#a99ce8", label: "Equity earnings (private)" },
  // Housing
  { grp: "Housing", col: "#eda100", label: "Imputed rent of homeowners" },
  { grp: "Housing", col: "#b87b00", label: "Rental income" },
  // Unincorporated business
  { grp: "Unincorporated business", col: "#d9c04d", label: "Partnerships & sole proprietorships" },
  { grp: "Unincorporated business", col: "#9c8425", label: "Self-employment income (labour)" },
  // Labour
  { grp: "Labour", col: "#2a78d6", label: "Labour (cash, salaries, residuals)" },
];
const NL = LAYERS.length;

function layers15(S, r, extra) {
  const n = S.n, w = S.w, K = S.kprice, C = r.comp;
  const post = extra ? extra.post : r.post;
  const ord = Uint32Array.from({ length: n }, (_, i) => i);
  ord.sort((a, b) => post[a] - post[b]);
  const target = S.wsum / 100;
  const layers = LAYERS.map(() => new Float64Array(100));
  const acc = new Float64Array(NL);
  let bin = 0, filled = 0, wsumb = 0;
  const raw = new Float64Array(NL);
  for (let j = 0; j < n; j++) {
    const i = ord[j];
    const kind = C.kind[i], col = C.col[i], hou = C.hou[i];
    const ben = C.pben[i] + C.pcon[i];
    raw[0] = C.cash[i] + (extra ? extra.cash[i] : 0);
    raw[1] = kind * (1 - F.mcF[i] - F.mdF[i]);
    raw[2] = col * (1 - F.educF[i]);
    raw[3] = col * F.educF[i];
    raw[4] = ben * F.ssDiF[i];
    raw[5] = ben * F.uiF[i] + (extra ? extra.ui[i] : 0);
    const lab = C.lab[i], equ = C.equ[i];
    const lpf = F.labPenF[i], lhf = F.labHeaF[i], lsf = F.labSelfF[i];
    raw[6] = kind * (F.mcF[i] + F.mdF[i]) + (extra ? extra.medi[i] : 0);
    raw[7] = lab * lhf;
    raw[8] = ben * F.ssOaF[i];
    raw[9] = ben * (1 - F.ssOaF[i] - F.ssDiF[i] - F.uiF[i]);
    raw[10] = lab * lpf;
    raw[11] = C.pena[i];
    raw[12] = equ * F.equCF[i];
    raw[13] = equ * (1 - F.equCF[i]);
    raw[14] = hou * (1 - F.rentF[i]);
    raw[15] = hou * F.rentF[i];
    raw[16] = C.biz[i];
    raw[17] = lab * lsf;
    raw[18] = lab * (1 - lpf - lhf - lsf);
    let sp = 0;
    for (let k = 0; k < NL; k++) { if (raw[k] < 0) raw[k] = 0; sp += raw[k]; }
    const scale = sp > 0 ? Math.max(post[i], 0) / sp : 0;
    let rem = w[i];
    while (rem > 0 && bin < 100) {
      const take = Math.min(rem, target - filled);
      for (let k = 0; k < NL; k++) acc[k] += raw[k] * scale * take;
      wsumb += take; filled += take; rem -= take;
      if (filled >= target - 1e-7) {
        for (let k = 0; k < NL; k++) { layers[k][bin] = acc[k] * K / wsumb; acc[k] = 0; }
        bin++; filled = 0; wsumb = 0;
      }
    }
  }
  return layers.map(L => Array.from(L));
}

function stackChart(fileBase, title, opts) {
  let basePost = null;
  if (process.env.G1_SAFETYNET) {
    const rb2 = runMicro(S, { ...CANON, labourFrac: 1 });
    basePost = Float64Array.from(rb2.post);
  }
  let baseTops = null;
  if (process.env.G1_GHOST) {
    const rb = runMicro(S, { ...CANON, labourFrac: 1 });
    baseTops = microStats(S, rb.post).pctl.slice();
  }
  const r = runMicro(S, { ...CANON, ...opts });
  let extra = null;
  const wantUI = process.env.G1_UILAW || process.env.G1_EMERGUI;
  const wantSN = process.env.G1_SAFETYNET;
  if (wantUI || wantSN) {
    const n = S.n, wgt = S.w;
    const post2 = Float64Array.from(r.post);
    const exUI = new Float64Array(n), exCash = new Float64Array(n), exMedi = new Float64Array(n);
    let cost = 0;
    if (wantUI) {
      const law = !!process.env.G1_UILAW;
      let recip = 0, net = 0;
      for (let i = 0; i < n; i++) {
        const loss = S.lab[i] - r.comp.lab[i];
        if (loss <= 0) continue;
        let ui0;
        if (law) {
          // current law: employees only, 50% of lost cash wages up to $470/wk,
          // 39 weeks (26 standard + Extended Benefits); taxed at bracket rates
          const wageLoss = loss * (1 - F.labSelfF[i]);
          if (wageLoss <= 0) continue;
          ui0 = 0.75 * Math.min(0.5 * wageLoss, 24440);
        } else {
          ui0 = Math.min(0.5 * loss, 26000);
        }
        const uiN = ui0 * (1 - S.rl[S.bidx[i]]);
        exUI[i] = uiN; post2[i] += uiN; recip += wgt[i]; net += uiN * wgt[i];
      }
      cost += net;
      console.log("UI: " + (recip / 1e5 / 1e6).toFixed(1) + "M recipients, $" +
        (net / 1e5 / 1e9).toFixed(0) + "bn net of tax");
    }
    if (wantSN) {
      const PROG = require("./micro_prog.json");
      let mSum = 0, mW = 0, sSum = 0, sW = 0;
      for (let i = 0; i < n; i++) {
        if (PROG.medicaid[i] > 0) { mSum += PROG.medicaid[i] * wgt[i]; mW += wgt[i]; }
        if (PROG.snap[i] > 0) { sSum += PROG.snap[i] * wgt[i]; sW += wgt[i]; }
      }
      const mAvg = mSum / mW, sAvg = sSum / sW;
      const MEDI_THRESH = 17236, SNAP_THRESH = 16237;   // 138% / 130% of 2019 FPL
      const takeM = v => v < 5e3 ? 0.02 : v < 1e4 ? 0.12 : v < MEDI_THRESH ? 0.19
        : v < 6e4 ? 0.19 + 0.81 * (v - MEDI_THRESH) / (6e4 - MEDI_THRESH) : 1.0;
      const takeS = v => v < 5e3 ? 0.10 : v < 1e4 ? 0.17 : v < SNAP_THRESH ? 0.20
        : v < 6e4 ? 0.20 + 0.80 * (v - SNAP_THRESH) / (6e4 - SNAP_THRESH) : 1.0;
      const h1 = i => (((i + 1) * 2654435761) >>> 0) / 4294967296;
      const h2 = i => (((i + 1) * 2246822519) >>> 0) / 4294967296;
      let newM = 0, newS = 0, cSN = 0;
      for (let i = 0; i < n; i++) {
        const bb = Math.max(basePost[i], 0);
        // eligibility tested on income including any UI just received
        if (post2[i] < MEDI_THRESH && PROG.medicaid[i] <= 0 && h1(i) < takeM(bb)) {
          exMedi[i] = mAvg; post2[i] += mAvg; newM += wgt[i]; cSN += mAvg * wgt[i];
        }
        if (post2[i] < SNAP_THRESH && PROG.snap[i] <= 0 && h2(i) < takeS(bb)) {
          exCash[i] = sAvg; post2[i] += sAvg; newS += wgt[i]; cSN += sAvg * wgt[i];
        }
      }
      cost += cSN;
      console.log("safety net: Medicaid +" + (newM / 1e5 / 1e6).toFixed(1) + "M, SNAP +" +
        (newS / 1e5 / 1e6).toFixed(1) + "M, $" + (cSN / 1e5 / 1e9).toFixed(0) + "bn");
    }
    let taxTot = 0;
    for (let i = 0; i < n; i++) taxTot += Math.max(r.tax[i], 0) * wgt[i];
    const k2 = cost / taxTot;
    for (let i = 0; i < n; i++) post2[i] -= k2 * Math.max(r.tax[i], 0);
    console.log("funded: every tax bill scaled up " + (100 * k2).toFixed(1) +
      "%; total income conserved");
    extra = { post: post2, cash: exCash, medi: exMedi, ui: exUI };
  }
  const st = microStats(S, extra ? extra.post : r.post);
  const layers = layers15(S, r, extra);
  const cum = [new Array(100).fill(0)];
  for (let g = 0; g < NL; g++)
    cum.push(cum[g].map((v, i) => v + layers[g][i]));
  const MODE = process.env.G1_AXIS || "step300";   // break | log | piecewise
  const top = cum[NL][99];
  const BRK = 420e3;
  const U1 = Math.ceil(top / 20e3) * 20e3;
  const RES = 1.35e6;
  const x0 = 148, y0 = 52, w = 700;
  const legX = x0 + w + 74, legW = 330, W = legX + legW;
  let LH = 400, BH = 14, UH = LH * (U1 - RES) / BRK;
  if (MODE !== "break") { UH = 0; BH = 0; LH = 480; }
  const B3 = [0, 1e5, 3e5, 9e5, 2.7e6], SEG3 = 150, TOP3 = 1.42e6;
  const h3 = v => {
    const vv = Math.min(Math.max(v, 0), TOP3);
    let k = 1;
    while (k < B3.length - 1 && vv > B3[k]) k++;
    return SEG3 * (k - 1) + SEG3 * (vv - B3[k - 1]) / (B3[k] - B3[k - 1]);
  };
  if (MODE === "piecewise3") LH = h3(TOP3);
  const BG = [0, 1e5, 1e6, 1e7], SEGG = 235, TOPG = 1.42e6;
  const hg = v => {
    const vv = Math.min(Math.max(v, 0), TOPG);
    let k = 1;
    while (k < BG.length - 1 && vv > BG[k]) k++;
    return SEGG * (k - 1) + SEGG * (vv - BG[k - 1]) / (BG[k] - BG[k - 1]);
  };
  if (MODE === "geo10") LH = hg(TOPG);
  let STEPB = null;
  let TRIB = null;
  const yBrkTop = y0 + UH, yLow0 = y0 + UH + BH;
  let axisY = y0 + UH + BH + LH;
  const LOGMIN = 1e3, LOGMAX = 1.42e6;
  const PWB = [0, 1e5, 3e5, 7e5, 1.1e6, 1.5e6];
  let yOf;
  if (MODE === "break")
    yOf = v => v <= BRK
      ? yLow0 + LH * (1 - v / BRK)
      : y0 + UH * (1 - (Math.min(Math.max(v, RES), U1) - RES) / (U1 - RES));
  else if (MODE === "log")
    yOf = v => axisY - LH * Math.log(Math.min(Math.max(v, LOGMIN), LOGMAX) / LOGMIN) / Math.log(LOGMAX / LOGMIN);
  else if (MODE === "piecewise3")
    yOf = v => axisY - h3(v);
  else if (MODE === "geo10")
    yOf = v => axisY - hg(v);
  else if (MODE === "tri") {
    const T3 = process.env.G1_TRITOP ? +process.env.G1_TRITOP : Math.max(Math.ceil(top / 1e5) * 1e5, 1.2e6);
    const EXT = T3 + (T3 - 1e6) * 0.15;          // headroom above the labelled top
    TRIB = [0, 1e5, 1e6, T3];
    const seg = 160;
    LH = 3 * seg + seg * (EXT - T3) / (T3 - 1e6);
    yOf = v => {
      const vv = Math.min(Math.max(v, 0), EXT);
      let k = 1;
      while (k < 3 && vv > TRIB[k]) k++;
      return (y0 + LH) - seg * (k - 1) - seg * (vv - TRIB[k - 1]) / (TRIB[k] - TRIB[k - 1]);
    };
  }
  else if (MODE === "linear")
    yOf = v => axisY - LH * Math.min(Math.max(v, 0), 1.5e6) / 1.5e6;
  else if (MODE === "step300") {
    const B = [0, 1e5];
    while (B[B.length - 1] < Math.max(top, 1.5e6)) B.push(B[B.length - 1] + 300e3);
    const seg = 80;
    LH = seg * (B.length - 1);
    STEPB = B;
    yOf = v => {
      const vv = Math.min(Math.max(v, 0), B[B.length - 1]);
      let k = 1;
      while (k < B.length - 1 && vv > B[k]) k++;
      return (y0 + LH) - seg * (k - 1) - seg * (vv - B[k - 1]) / (B[k] - B[k - 1]);
    };
  }
  else {
    const seg = LH / (PWB.length - 1);
    yOf = v => {
      const vv = Math.min(Math.max(v, 0), PWB[PWB.length - 1]);
      let k = 1;
      while (k < PWB.length - 1 && vv > PWB[k]) k++;
      return axisY - seg * (k - 1) - seg * (vv - PWB[k - 1]) / (PWB[k] - PWB[k - 1]);
    };
  }
  if (MODE === "step300" || MODE === "tri") axisY = y0 + LH;
  const xOf = p => x0 + (p + 0.5) / 100 * w;
  let o = `<text x="${x0 + w / 2}" y="30" text-anchor="middle" font-size="17" font-weight="700" fill="${INK}">${title}</text>
<clipPath id="cp"><rect x="${x0}" y="${y0}" width="${w}" height="${UH + BH + LH}"/></clipPath>`;
  if (MODE === "break") {
    for (let v = 0; v <= 400e3; v += 100e3) {
      const y = yOf(v);
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" stroke="${GRID}"/>`;
      o += `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="${MUT}">$${v / 1000}k</text>`;
    }
    for (let v = Math.ceil(RES / 100e3) * 100e3; v <= U1; v += 100e3) {
      const y = yOf(v);
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" stroke="${GRID}"/>`;
      o += `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="${MUT}">$${(v / 1e6).toFixed(1)}M</text>`;
    }
  } else if (MODE === "piecewise3") {
    // every $100k, fixed-value lines whose crowding shows the compression
    for (let v = 100e3; v <= 1.4e6 + 1; v += 100e3) {
      const y = yOf(v), major = v === 1e5 || v === 3e5 || v === 9e5;
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#c3c2b7" : "#eceae2"}"/>`;
      if (major)
        o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$${v / 1e3}k</text>`;
    }
    o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
    o += `<text x="${x0 - 8}" y="${(yOf(1.4e6) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$1.4M</text>`;
  } else if (MODE === "geo10") {
    // fixed $100k lines up to $1M (they crowd 9x in the middle band); crop above
    for (let v = 100e3; v <= 1e6 + 1; v += 100e3) {
      const y = yOf(v), major = v === 1e5 || v === 1e6;
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#c3c2b7" : "#eceae2"}"/>`;
      if (major)
        o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${v === 1e5 ? "$100k" : "$1M"}</text>`;
    }
    o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
  } else if (MODE === "tri") {
    const T3g = TRIB[3];
    const EXTg = T3g + (T3g - 1e6) * 0.15;
    for (let v = 100e3; v <= EXTg + 1; v += 100e3) {
      const y = yOf(v), major = v === 1e5 || v === 1e6 || v === T3g;
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#b8b6ac" : "#eceae2"}"/>`;
      if (major)
        o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${v === 1e5 ? "$100k" : v === 1e6 ? "$1M" : "$" + (+(v / 1e6).toFixed(1)) + "M"}</text>`;
    }
    o += `<text x="${x0 - 8}" y="${(yOf(0) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">$0k</text>`;
  } else if (MODE === "linear" || MODE === "step300") {
    const topV = MODE === "linear" ? 1.5e6 : STEPB[STEPB.length - 1];
    const majors = MODE === "linear" ? [0, 3e5, 6e5, 9e5, 1.2e6, 1.5e6] : STEPB;
    for (let v = 0; v <= topV + 1; v += 100e3) {
      const y = yOf(v), major = majors.includes(v);
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${major ? "#c3c2b7" : "#eceae2"}"/>`;
      if (major)
        o += `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="${MUT}">${v === 0 ? "$0k" : v < 1e6 ? "$" + v / 1e3 + "k" : "$" + (v / 1e6).toFixed(1) + "M"}</text>`;
    }
  } else {
    const ticks = MODE === "log"
      ? [[1e3, "$1k"], [1e4, "$10k"], [1e5, "$100k"], [1e6, "$1M"]]
      : [[0, "$0k"], [1e5, "$100k"], [3e5, "$300k"], [7e5, "$700k"], [1.1e6, "$1.1M"], [1.5e6, "$1.5M"]];
    for (const [v, lb] of ticks) {
      const y = yOf(v);
      o += `<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" stroke="${GRID}"/>`;
      o += `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="${MUT}">${lb}</text>`;
    }
  }
  for (let p = 0; p <= 90; p += 10) {
    o += `<text x="${xOf(p)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">${p === 0 ? "p0" : "p" + p}</text>`;
    o += `<line x1="${xOf(p).toFixed(1)}" x2="${xOf(p).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
  }
  o += `<text x="${xOf(99)}" y="${axisY + 18}" text-anchor="middle" font-size="11.5" fill="${MUT}">p99</text>`;
  o += `<line x1="${xOf(99).toFixed(1)}" x2="${xOf(99).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="${AXIS}" stroke-width="1.2"/>`;
  o += `<text x="${x0 + w / 2}" y="${axisY + 38}" text-anchor="middle" font-size="12.5" fill="${INK}">Percentile</text>`;
  o += `<text x="${x0 - 62}" y="${(y0 + (UH + BH + LH) / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" fill="${INK}">Income</text>`;
  // tight stacked bars; per percentile, GROUPS sorted smallest-bottom / largest-top
  const bw = w / 100 * 0.82;
  const grpNames0 = [...new Set(LAYERS.map(L => L.grp))];
  const grpIdx = grpNames0.map(gn =>
    LAYERS.map((L, g) => [L, g]).filter(([L]) => L.grp === gn).map(x => x[1]));
  const dPaths = LAYERS.map(() => "");
  for (let p = 0; p < 100; p++) {
    const gt = grpIdx.map(idxs => idxs.reduce((a, g) => a + layers[g][p], 0));
    const orderG = gt.map((v, k) => [v, k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    let acc = 0;
    for (const k of orderG) {
      const subOrder = [...grpIdx[k]].sort((a, b) => layers[a][p] - layers[b][p]);
      for (const g of subOrder) {
        const v = layers[g][p];
        if (v <= 0) continue;
        const yBot = yOf(acc), yTop = yOf(acc + v);
        acc += v;
        if (yBot - yTop < 0.05) continue;
        dPaths[g] += `M${(xOf(p) - bw / 2).toFixed(2)} ${yTop.toFixed(2)}h${bw.toFixed(2)}v${(yBot - yTop).toFixed(2)}h-${bw.toFixed(2)}Z`;
      }
    }
  }
  for (let g = 0; g < NL; g++)
    o += `<path d="${dPaths[g]}" fill="${LAYERS[g].col}" fill-opacity="0.82" clip-path="url(#cp)"/>`;
  // ghost caps: where each percentile's bar top stood in 2019
  if (baseTops) {
    let d = "";
    for (let p = 0; p < 100; p++) {
      const y = yOf(baseTops[p]).toFixed(2);
      const xL = (x0 + p * w / 100).toFixed(2), xR = (x0 + (p + 1) * w / 100).toFixed(2);
      d += (p ? `L${xL} ${y}` : `M${xL} ${y}`) + `H${xR}`;
    }
    o += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2.4" stroke-linejoin="miter" clip-path="url(#cp)"/>`;
    const tx = xOf(10), ty = yOf(430e3);
    o += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="start" font-size="11.5" fill="#000000">status quo ante machina</text>`;
    const ex2 = xOf(34), ey2 = yOf(baseTops[34]) - 5;
    const sx2 = tx + 68, sy2 = ty + 12;
    const cx2 = (sx2 + ex2) / 2 - 34, cy2 = (sy2 + ey2) / 2 + 26;
    o += `<path d="M${sx2.toFixed(1)} ${sy2.toFixed(1)} Q${cx2.toFixed(1)} ${cy2.toFixed(1)} ${ex2.toFixed(1)} ${ey2.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
    const ang2 = Math.atan2(ey2 - cy2, ex2 - cx2);
    for (const da of [Math.PI * 0.82, -Math.PI * 0.82]) {
      const hx = ex2 + 7 * Math.cos(ang2 + da), hy = ey2 + 7 * Math.sin(ang2 + da);
      o += `<line x1="${ex2.toFixed(1)}" y1="${ey2.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
    }
  }
  if (MODE === "break") {
  o += `<rect x="${x0 - 34}" y="${yBrkTop}" width="${w + 44}" height="${BH}" fill="#fcfcfb"/>`;
  for (const yy of [yBrkTop, yBrkTop + BH]) {
    let d = "";
    for (let x = x0 - 34, i = 0; x <= x0 + w + 8; x += 9, i++)
      d += (i ? "L" : "M") + x + " " + (yy + (i % 2 ? -3 : 3)).toFixed(1);
    o += `<path d="${d}" fill="none" stroke="${AXIS}" stroke-width="1.4"/>`;
  }
  }
  // legend: grouped by broad type; groups ordered by total share, headers bold
  const shares = layers.map(L => L.reduce((a, b) => a + b, 0));
  const tot = shares.reduce((a, b) => a + b, 0);
  const grpNames = [...new Set(LAYERS.map(L => L.grp))];
  const grpTot = Object.fromEntries(grpNames.map(gn =>
    [gn, LAYERS.reduce((a, L, g) => a + (L.grp === gn ? shares[g] : 0), 0)]));
  const FIXG = { "Labour": 0, "Government": 1, "Capital": 2, "Old-age income": 3,
                 "Healthcare": 4, "Unincorporated business": 5, "Housing": 6 };
  const FIXL = { "Labour (cash, salaries, residuals)": 0,
    "Defence, police, roads, administration": 0, "Public education": 1,
    "Cash & near-cash transfers": 2, "Other in-kind transfers": 3,
    "Social Security disability": 4, "Unemployment insurance": 5,
    "Pension asset earnings (mostly public)": 0, "Equity earnings (mostly public)": 1,
    "Equity earnings (private)": 2,
    "Pension income (non-Social Security)": 0, "Social Security old-age (transfer)": 1,
    "Pension contributions (labour)": 2,
    "Medicare & Medicaid (transfer)": 0, "Employer health insurance (labour)": 1,
    "Self-employment income (labour)": 0, "Partnerships & sole proprietorships": 1,
    "Imputed rent of homeowners": 0, "Rental income": 1 };
  const FIXED = !!process.env.G1_FIXEDLEGEND;
  const grpOrder = FIXED
    ? grpNames.sort((a, b) => FIXG[a] - FIXG[b])
    : grpNames.sort((a, b) => grpTot[b] - grpTot[a]);
  const WRAP = 40;
  function wrapLabel(t) {
    if (t.length <= WRAP) return [t];
    let cut = t.lastIndexOf(" ", WRAP);
    if (cut < 0) cut = WRAP;
    return [t.slice(0, cut), t.slice(cut + 1)];
  }
  const rowH = 19, lineH = 13, headH = 24;
  let items = [];
  for (const gn of grpOrder) {
    items.push({ head: gn, pct: grpTot[gn] / tot });
    LAYERS.map((L, g) => [L, g]).filter(([L]) => L.grp === gn)
      .sort((a, b) => FIXED ? FIXL[a[0].label] - FIXL[b[0].label]
                            : shares[b[1]] - shares[a[1]])
      .forEach(([L, g]) => items.push({ g, lines: wrapLabel(L.label), pct: shares[g] / tot }));
  }
  const legHt = items.reduce((a, it) => a + (it.head ? headH : (it.lines.length > 1 ? rowH + lineH : rowH)), 0);
  let ly = y0 + (UH + BH + LH) / 2 - legHt / 2 + 12;
  for (const it of items) {
    const pct = (100 * it.pct).toFixed(1) + "%";
    if (it.head) {
      ly += 5;
      console.log(it.head.toUpperCase() + " " + pct);
      o += `<text x="${legX - 8}" y="${ly}" text-anchor="end" font-size="11.5" font-weight="700" fill="${INK}">${pct}</text>`;
      o += `<text x="${legX}" y="${ly}" font-size="12" font-weight="700" fill="${INK}">${it.head}</text>`;
      ly += headH - 5;
    } else {
      console.log("  " + LAYERS[it.g].label + ": " + pct);
      o += `<text x="${legX - 8}" y="${ly}" text-anchor="end" font-size="11" fill="${MUT}">${pct}</text>`;
      o += `<rect x="${legX}" y="${ly - 9}" width="10" height="10" rx="2" fill="${LAYERS[it.g].col}" fill-opacity="0.85"/>`;
      o += `<text x="${legX + 16}" y="${ly}" font-size="11" fill="${INK}">${it.lines[0]}</text>`;
      if (it.lines[1]) { ly += lineH; o += `<text x="${legX + 16}" y="${ly}" font-size="11" fill="${INK}">${it.lines[1]}</text>`; }
      ly += rowH;
    }
  }
  const H = axisY + 56;
  const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#fcfcfb;font-family:system-ui,'Segoe UI',sans-serif">
<svg id="c" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fcfcfb">${o}</svg></body>`;
  fs.writeFileSync(fileBase + ".html", html);
  console.log(fileBase, "top p99 stack:", Math.round(top).toLocaleString(),
              "EDEI", Math.round(st.edei));
}

const SCEN = process.env.G1_SCEN || "base";
if (SCEN === "base")
  stackChart(process.env.G1_OUT || "essay_g1_baseline",
             "US post-tax post-transfer income distribution, 2019", { labourFrac: 1 });
else if (SCEN === "nolab")
  stackChart(process.env.G1_OUT || "essay_g2_displaced",
             "Labour income at zero — EITC and Social Security held", { labourFrac: 0 });
else if (SCEN === "medrestore")
  stackChart(process.env.G1_OUT || "essay_g_medrestore",
             "Labour at zero, the economy grown 1.9×: the median restored",
             { labourFrac: 0, mult: 1.92 });
else if (SCEN === "uihealth")
  stackChart(process.env.G1_OUT || "essay_g4",
             "One transition year: UI plus expanded Medicaid & SNAP",
             { labourFrac: 0 });
else if (SCEN === "uilaw")
  stackChart(process.env.G1_OUT || "essay_g2_uilaw",
             "One transition year: everyone eligible claims today's UI",
             { labourFrac: 0 });
else if (SCEN === "emergui")
  stackChart(process.env.G1_OUT || "essay_g2_emergui",
             "One transition year: emergency UI at half of lost wages (capped $26k)",
             { labourFrac: 0 });
else if (SCEN === "nobackstop")
  stackChart(process.env.G1_OUT || "essay_g2_nobackstop",
             "Labour income at zero — EITC and Social Security collapse",
             { labourFrac: 0, penWage: "dies", creditsDie: true });
