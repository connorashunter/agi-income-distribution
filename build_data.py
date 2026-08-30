#!/usr/bin/env python3
"""Rebuild the derived data files from the Piketty-Saez-Zucman DINA microfile.

The repo already ships the derived JSONs, so you only need this script if you
want to rebuild them from source (or audit how they were made).

1. Download PSZ2022Dinafiles.zip from https://gabriel-zucman.eu/usdina/
2. Extract usdina2019.dta next to this script (or pass its path as argv[1])
3. python build_data.py            -> writes micro_data.json, micro_fracs.json,
                                      micro_prog.json
   python build_data.py --verify   -> also diffs against the shipped files

Requires: numpy, pandas (pip install numpy pandas).

Note on precision: the originally shipped micro_data.json passed through
float32 at one point, so a rebuild differs from it by up to ~1e-7 relative
(a few dollars on multi-million incomes). Immaterial to every result.
"""
import json
import sys

import numpy as np
import pandas as pd

DTA = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "usdina2019.dta"
VERIFY = "--verify" in sys.argv

# WID price bridge: 2019 current dollars -> constant ~2023 dollars
K_PRICE = 1.2113333936453494

COLS = [
    "peinc", "dweght",
    # labour
    "flemp", "flprl", "flsubl", "flmil", "flwag", "flsup", "waghealth", "wagpen",
    # social insurance (benefits net of contributions)
    "plbel", "pkbek", "plcon", "prisupen",
    "plben", "ssinc_oa", "ssinc_di", "uiinc",
    # pension-asset income
    "fkpen", "pkpen", "invpen",
    # other capital
    "fkhou", "fkhoumain", "fkhourent", "fkequ", "fkequ_c", "fkequ_s",
    "fkfix", "fkbus", "fkdeb", "fkprk", "fksubk",
    # residual + transfers + collective
    "govin", "npinc", "dicab", "dicred", "inkindinc", "colexp", "educ",
    "medicare", "medicaid", "difoo",
]

print(f"reading {DTA} ...")
df = pd.read_stata(DTA, columns=COLS)
order = np.argsort(df["peinc"].to_numpy(float), kind="stable")
g = lambda c: df[c].to_numpy(float)[order]
n = len(order)
w = g("dweght")                      # population weight x 100,000

# --- production taxes on capital (fkprk + fksubk) are reallocated pro-rata
# --- across the other capital components, so "business" is not their dump site
prodk = g("fkprk") + g("fksubk")
den = g("fkhou") + g("fkequ") + g("fkfix") + g("fkbus") + g("fkpen") + g("fkdeb")
scale = np.ones(n)
m = np.abs(den) > 1
scale[m] = 1 + prodk[m] / den[m]

lab = g("flemp") + g("flprl") + g("flsubl") + g("flmil")
pben = g("plbel") + g("pkbek")        # social insurance benefits (labour+capital share)
pcon = g("plcon") + g("prisupen")     # (minus) contributions + pension-system surplus
pena = g("fkpen") * scale + g("pkpen") + g("invpen")
hou = g("fkhou") * scale
equ = g("fkequ") * scale
biz = g("fkbus") * scale
intr = (g("fkfix") + g("fkdeb")) * scale
resid = g("govin") + g("npinc")
cashnc = g("dicab") - g("dicred")     # cash assistance excluding refundable credits
cred = g("dicred")
kind = g("inkindinc")
col0 = g("colexp")

# five tax brackets by weighted pre-tax rank: bot50 / mid40 / p90-95 / p95-99 / top1
cw = np.cumsum(w) / w.sum()
bidx = np.searchsorted([0.5, 0.9, 0.95, 0.99], cw, side="right")

ri = lambda a: [int(round(x)) for x in a]
micro = {
    "n": n, "kprice": K_PRICE, "w": ri(w),
    "lab": ri(lab), "pben": ri(pben), "pcon": ri(pcon), "pena": ri(pena),
    "hou": ri(hou), "equ": ri(equ), "biz": ri(biz), "intr": ri(intr),
    "resid": ri(resid), "cashnc": ri(cashnc), "cred": ri(cred),
    "kind": ri(kind), "col0": ri(col0), "bidx": [int(b) for b in bidx],
}

# --- per-adult sub-layer fractions (all from recorded columns; negatives
# --- clamped and renormalised, same convention as the chart layers)
pos = lambda x: np.maximum(x, 0.0)

def frac(num, den_):
    out = np.zeros(n)
    ok = den_ > 0
    out[ok] = num[ok] / den_[ok]
    return np.clip(out, 0, 1)

r5 = lambda a: [round(float(x), 5) for x in a]
edu_p, rest_p = pos(g("educ")), pos(g("colexp") - g("educ"))
rent_p, main_p = pos(g("fkhourent")), pos(g("fkhoumain"))
mc, md_, ik = pos(g("medicare")), pos(g("medicaid")), pos(g("inkindinc"))
oa, di, ui = pos(g("ssinc_oa")), pos(g("ssinc_di")), pos(g("uiinc"))
np_ = pos(g("plben") - oa - di - ui)
T = oa + di + ui + np_
ec, es = pos(g("fkequ_c")), pos(g("fkequ_s"))
othersup = g("flsup") - g("waghealth") - g("wagpen")
cash_c = pos(g("flwag") + othersup + g("flprl") + g("flsubl"))
pen_c, hea_c, self_c = pos(g("wagpen")), pos(g("waghealth")), pos(g("flmil"))
TL = cash_c + pen_c + hea_c + self_c

fracs = {
    "educF": r5(frac(edu_p, edu_p + rest_p)),
    "rentF": r5(frac(rent_p, rent_p + main_p)),
    "mcF": r5(frac(mc, ik)), "mdF": r5(frac(md_, ik)),
    "ssF": r5(frac(oa + di, T)),
    "ssOaF": r5(frac(oa, T)), "ssDiF": r5(frac(di, T)), "uiF": r5(frac(ui, T)),
    "equCF": r5(frac(ec, ec + es)),
    "labPenF": r5(frac(pen_c, TL)), "labHeaF": r5(frac(hea_c, TL)),
    "labSelfF": r5(frac(self_c, TL)),
}

r2 = lambda a: [round(float(x), 2) for x in a]
prog = {"medicaid": r2(g("medicaid")), "snap": r2(g("difoo"))}

for name, obj in [("micro_data.json", micro), ("micro_fracs.json", fracs), ("micro_prog.json", prog)]:
    if VERIFY:
        old = json.load(open(name))
        for k in obj:
            if k in ("n", "kprice"):
                continue
            a, b = np.array(obj[k], float), np.array(old[k], float)
            rel = np.max(np.abs(a - b) / np.maximum(np.abs(b), 1e4))
            print(f"  {name}:{k}  max rel diff {rel:.2e}")
    else:
        json.dump(obj, open(name, "w"))
        print(f"wrote {name}")
print("done")
