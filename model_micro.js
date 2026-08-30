// JS port of us_micro_engine.py: per-adult scenario engine on the full PSZ DINA
// 2019 microfile (68,764 weighted synthetic adults, shipped sorted by baseline
// pre-tax income). D is the micro_data.json object; M supplies the PSZ bracket
// tax-rate constants (RATES/RL/RK) shared with the percentile engine.
function microInit(D, M) {
  const n = D.n;
  const f = k => Float64Array.from(D[k]);
  const S = {
    n, kprice: D.kprice,
    w: f("w"), lab: f("lab"), pben: f("pben"), pcon: f("pcon"), pena: f("pena"),
    hou: f("hou"), equ: f("equ"), biz: f("biz"), intr: f("intr"), resid: f("resid"),
    cashnc: f("cashnc"), cred: f("cred"), kind: f("kind"), col0: f("col0"),
    bidx: Uint8Array.from(D.bidx),
    rl: M.RL, rk: M.RK, rates: M.RATES,
  };
  const sum = (a, b) => { let s = 0; for (let i = 0; i < n; i++) s += a[i] * (b ? b[i] : 1); return s; };
  S.wsum = sum(S.w);
  S.T = {
    lab: sum(S.lab, S.w), pben: sum(S.pben, S.w), pcon: sum(S.pcon, S.w),
    pena: sum(S.pena, S.w), hou: sum(S.hou, S.w), equ: sum(S.equ, S.w),
    biz: sum(S.biz, S.w), intr: sum(S.intr, S.w), resid: sum(S.resid, S.w),
    col0: sum(S.col0, S.w),
  };
  S.T.pre0 = S.T.lab + S.T.pben + S.T.pcon + S.T.pena + S.T.hou + S.T.equ +
             S.T.biz + S.T.intr + S.T.resid;
  S.capshare0 = (S.T.hou + S.T.equ + S.T.biz + S.T.intr) / S.T.pre0;
  // adults are shipped sorted by baseline income; top 1% = trailing weight
  S.top1 = new Uint8Array(n);
  { let acc = 0;
    for (let i = n - 1; i >= 0; i--) { acc += S.w[i]; if (acc / S.wsum <= 0.01) S.top1[i] = 1; else break; } }
  let eqTop = 0;
  for (let i = 0; i < n; i++) if (S.top1[i] && S.equ[i] > 0) eqTop += S.equ[i] * S.w[i];
  S.eqTop = eqTop;
  S.buf = { pre: new Float64Array(n), post: new Float64Array(n), tax: new Float64Array(n),
            comp: {}, order: Uint32Array.from({ length: n }, (_, i) => i) };
  for (const k of ["lab", "pben", "pcon", "pena", "hou", "equ", "biz", "intr",
                   "resid", "cash", "kind", "col"])
    S.buf.comp[k] = new Float64Array(n);
  return S;
}

function runMicro(S, opt) {
  let { mult = 1, labourFrac = 1, housing = "flat", biz = "flat",
          interest = "flat", penEq = 1, penWage = "dies", skew = 0, g = 1,
          absorbed = true, neutral = "prop", creditsDie = true } = opt;
  const lam = labourFrac, m = mult, n = S.n, T = S.T, w = S.w;
  if (lam >= 1) {              // displacement options are inert with labour intact
    housing = biz = "flat"; penEq = 1; penWage = "dies"; skew = 0;
  }
  interest = "flat";           // net interest never absorbs (negative aggregate)
  const penFixed = penWage !== "dies";
  const penBenT = penFixed ? T.pben : m * lam * T.pben;
  let F = 1;
  if (lam < 1 && absorbed) {
    let pool = T.equ + penEq * T.pena;
    if (housing === "absorb") pool += T.hou;
    else if (housing === "half") pool += 0.5 * T.hou;
    if (biz === "absorb") pool += T.biz;
    if (interest === "absorb") pool += T.intr;
    let fixed = penBenT + m * lam * T.pcon + m * lam * T.lab
      + m * (1 - penEq) * T.pena + m * T.resid;
    if (housing === "half") fixed += m * 0.5 * T.hou;
    else if (housing !== "absorb") fixed += m * T.hou;
    if (biz === "flat") fixed += m * T.biz;
    if (interest !== "absorb") fixed += m * T.intr;
    F = (m * T.pre0 - fixed) / (m * pool);
  }
  const gHou = housing === "absorb" ? F : housing === "half" ? (1 + F) / 2 : 1;
  const gBiz = biz === "absorb" ? F : biz === "flat" ? 1 : 0;
  const gInt = interest === "absorb" ? F : 1;
  const gPen = (1 - penEq) + penEq * F;
  const doSkew = lam < 1 && skew > 0 && F > 1;
  let totInc = 0;
  if (doSkew) totInc = m * (F - 1) * T.equ;   // equity increment total (>=0 net)
  const C = S.buf.comp, pre = S.buf.pre, tax = S.buf.tax;
  const capscaleNum = { v: 0 };
  let preT = 0, capT = 0;
  for (let i = 0; i < n; i++) {
    C.lab[i] = m * lam * S.lab[i];
    C.pben[i] = penFixed ? S.pben[i] : m * lam * S.pben[i];
    C.pcon[i] = m * lam * S.pcon[i];
    C.pena[i] = m * gPen * S.pena[i];
    C.hou[i] = m * gHou * S.hou[i];
    C.biz[i] = m * gBiz * S.biz[i];
    C.intr[i] = m * gInt * S.intr[i];
    C.resid[i] = m * S.resid[i];
    let e = m * F * S.equ[i];
    if (doSkew) {
      e -= skew * m * (F - 1) * S.equ[i];
      if (S.top1[i] && S.equ[i] > 0) e += skew * totInc * S.equ[i] / S.eqTop;
    }
    C.equ[i] = e;
    const p = C.lab[i] + C.pben[i] + C.pcon[i] + C.pena[i] + C.hou[i] + C.equ[i] +
              C.biz[i] + C.intr[i] + C.resid[i];
    pre[i] = p;
    preT += p * w[i];
    capT += (C.hou[i] + C.equ[i] + C.biz[i] + C.intr[i]) * w[i];
  }
  const capscale = (capT / preT) / S.capshare0;
  let taxT = 0;
  for (let i = 0; i < n; i++) {
    const b = S.bidx[i], R = S.rates[String(b)];
    const labt = C.lab[i] + C.pben[i] + C.pcon[i] + C.pena[i];
    const capt = C.hou[i] + C.equ[i] + C.biz[i] + C.intr[i];
    const t = g * (S.rl[b] * labt + S.rk[b] * capt
      + (R[1] + R[3]) * pre[i] + (R[2] + R[4]) * pre[i] * capscale);
    tax[i] = t;
    taxT += t * w[i];
  }
  // transfers: observed per-adult targeting; credits die with labour if chosen;
  // spending scales with the REALIZED economy (== mult when absorption is on)
  const sb = preT / T.pre0;
  let dispT = 0, indT = 0;
  const disp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    C.cash[i] = g * sb * (S.cashnc[i] + (creditsDie ? lam : 1) * S.cred[i]);
    C.kind[i] = g * sb * S.kind[i];
    indT += (C.cash[i] + C.kind[i]) * w[i];
    disp[i] = Math.max(pre[i] - tax[i] + C.cash[i], 0);
    dispT += disp[i] * w[i];
  }
  const colT = g * sb * T.col0;
  let spdT = 0;
  for (let i = 0; i < n; i++) {
    C.col[i] = neutral === "flat" ? colT / S.wsum : colT * disp[i] / dispT;
    spdT += (C.cash[i] + C.kind[i] + C.col[i]) * w[i];
  }
  const post = S.buf.post;
  const finT = taxT - spdT;
  for (let i = 0; i < n; i++) {
    const spd = C.cash[i] + C.kind[i] + C.col[i];
    const fin = (taxT > 0 && spdT > 0)
      ? finT * (0.5 * tax[i] / taxT + 0.5 * spd / spdT) : 0;
    post[i] = pre[i] - tax[i] + spd + fin;
  }
  return { pre, post, tax, comp: C, F };
}

// weighted percentile means of x (in WID constant dollars) + summary stats
function microStats(S, post, floor = 100) {
  const n = S.n, w = S.w, K = S.kprice;
  const ord = Uint32Array.from({ length: n }, (_, i) => i);
  ord.sort((a, b) => post[a] - post[b]);
  const pctl = new Float64Array(100);
  const target = S.wsum / 100;
  let bin = 0, acc = 0, vsum = 0, wsumb = 0;
  let logsum = 0, tot = 0, b50 = 0, t1 = 0, cum = 0;
  for (let j = 0; j < n; j++) {
    const i = ord[j], x = post[i] * K, wi = w[i];
    logsum += Math.log(Math.max(x, floor)) * wi;
    tot += x * wi;
    if (cum + wi <= 0.5 * S.wsum) b50 += x * wi;
    if (cum >= 0.99 * S.wsum) t1 += x * wi;
    cum += wi;
    let rem = wi;
    while (rem > 0 && bin < 100) {
      const take = Math.min(rem, target - acc);
      vsum += x * take; wsumb += take; acc += take; rem -= take;
      if (acc >= target - 1e-7) {
        pctl[bin] = vsum / wsumb;
        bin++; acc = 0; vsum = 0; wsumb = 0;
      }
    }
  }
  if (bin < 100 && wsumb > 0) pctl[bin] = vsum / wsumb;
  const edei = Math.exp(logsum / S.wsum);
  return { pctl: Array.from(pctl), edei, mean: tot / S.wsum,
           b50: b50 / tot, t1: t1 / tot,
           median: (pctl[49] + pctl[50]) / 2 };
}

// nine-layer decomposition per post-tax percentile, stack sums exactly to the
// percentile means. Taxes and the financing line fold in pro-rata; negative
// per-adult pieces (net interest, worker-side PAYG, govin) clamp to zero with
// the rest rescaled, as in the percentile engine's composition view.
function microLayers(S, r) {
  const n = S.n, w = S.w, K = S.kprice, C = r.comp, post = r.post;
  const names = ["Cash transfers", "In-kind transfers",
    "Distributionally neutral transfers", "Social Security & DB pensions",
    "Pension assets", "Housing", "Business", "Equity", "Labour"];
  const ord = Uint32Array.from({ length: n }, (_, i) => i);
  ord.sort((a, b) => post[a] - post[b]);
  const target = S.wsum / 100;
  const layers = names.map(() => new Float64Array(100));
  const acc = new Float64Array(9);
  let bin = 0, filled = 0, wsumb = 0;
  const raw = new Float64Array(9);
  for (let j = 0; j < n; j++) {
    const i = ord[j];
    raw[0] = C.cash[i]; raw[1] = C.kind[i]; raw[2] = C.col[i];
    raw[3] = C.pben[i] + C.pcon[i];
    raw[4] = C.pena[i]; raw[5] = C.hou[i]; raw[6] = C.biz[i];
    raw[7] = C.equ[i]; raw[8] = C.lab[i];
    let sp = 0;
    for (let k = 0; k < 9; k++) { if (raw[k] < 0) raw[k] = 0; sp += raw[k]; }
    const scale = sp > 0 ? Math.max(post[i], 0) / sp : 0;
    let rem = w[i];
    while (rem > 0 && bin < 100) {
      const take = Math.min(rem, target - filled);
      for (let k = 0; k < 9; k++) acc[k] += raw[k] * scale * take;
      wsumb += take; filled += take; rem -= take;
      if (filled >= target - 1e-7) {
        for (let k = 0; k < 9; k++) { layers[k][bin] = acc[k] * K / wsumb; acc[k] = 0; }
        bin++; filled = 0; wsumb = 0;
      }
    }
  }
  return { names, layers: layers.map(L => Array.from(L)) };
}

if (typeof module !== "undefined")
  module.exports = { microInit, runMicro, microStats, microLayers };
