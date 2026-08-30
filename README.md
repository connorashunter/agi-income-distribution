# AGI and the Income Distribution

Simulation code and data behind the essay *AGI and the Income Distribution*:
what happens to the US post-tax, post-transfer income distribution if AGI
displaces labour income, under the existing tax-and-transfer system, across
different assumptions about growth, timing, and political response.

Built on the Piketty–Saez–Zucman Distributional National Accounts microfile:
68,764 synthetic US adults (2019) carrying their recorded income sources,
taxes, and transfers. Scenarios are computed adult-by-adult and re-ranked —
no percentile averaging.

## Quickstart

Requires [Node.js](https://nodejs.org). No npm packages.

```
node gen_essay_stacks3.js
```

writes `essay_g1_baseline.html` — open it in any browser. Every generator
works this way: run a script, open the HTML it writes.

## The figures

| Command | Figure |
|---|---|
| `node gen_essay_stacks3.js` | 2019 baseline distribution, stacked by income source |
| `G1_SCEN=nobackstop G1_GHOST=1 node gen_essay_stacks3.js` | labour at zero, EITC + Social Security collapse |
| `G1_SCEN=nolab G1_GHOST=1 node gen_essay_stacks3.js` | labour at zero, benefits held |
| `G1_SCEN=uilaw G1_UILAW=1 G1_GHOST=1 node gen_essay_stacks3.js` | + everyone claims current-law UI (taxed, tax-funded) |
| `G1_SCEN=uihealth G1_UILAW=1 G1_SAFETYNET=1 G1_GHOST=1 node gen_essay_stacks3.js` | + Medicaid/SNAP expansion with calibrated claiming |
| `G1_SCEN=medrestore G1_GHOST=1 node gen_essay_stacks3.js` | labour at zero, economy grown 1.9× (median restored) |
| `node gen_path2.js` | five transition years as percentile curves |
| `node gen_path_alts.js` | the same transition four other ways (trajectories, ratio fan, small multiples, heatmap) |
| `node gen_ladder.js` | growth multiples needed to restore each milestone |
| `node gen_phasemap4.js` | trajectories vs the median-restored frontier |
| `node gen_phasemap5.js` | years-to-displacement vs required growth rate |
| `node gen_scen_lines.js` | four scenario skylines on one axis |

Useful chart flags for `gen_essay_stacks3.js` (environment variables):
`G1_AXIS` = `tri` (default `step300`) | `break` | `linear` | `log` | `geo10`,
`G1_TRITOP` (labelled top of the tri axis, e.g. `3000000`),
`G1_FIXEDLEGEND=1` (freeze legend order across scenarios for flip-book
comparison), `G1_GHOST=1` (overlay the 2019 skyline), `G1_OUT` (output name).

## The assumptions (the knobs)

The scenario engine is `model_micro.js`; canonical settings sit at the top of
each generator (`CANON`). Every contested choice is a switch:

- `labourFrac` — share of labour income remaining (0 = fully displaced).
  Displaced income is reassigned to capital pro-rata on existing holdings.
- `mult` — total income as a multiple of 2019. Growth and displacement are
  independent dials.
- `penEq` (0–1) — share of pension-asset income that rides the capital boom.
- `penWage` — `"fixed"`: Social Security and pension cheques held at 2019
  real levels (a political choice); `"dies"`: they collapse with the wage base.
- `creditsDie` — whether the EITC (legally an earnings subsidy) survives.
- `biz`, `housing` — whether business / housing income absorbs displaced
  labour income (`"absorb"`) or stays flat (`"flat"`).
- Taxes are always recomputed under 2019 law at PSZ's observed effective
  bracket rates; transfers keep their observed 2019 recipients.

If you disagree with an assumption, flip the switch and rerun — that is the
point of publishing this.

## Rebuilding the data from source

The derived JSONs (`micro_data.json`, `micro_fracs.json`, `micro_prog.json`)
ship in this repo. To rebuild them from the source microdata:

1. Download `PSZ2022Dinafiles.zip` (~1.4 GB) from
   <https://gabriel-zucman.eu/usdina/> and extract `usdina2019.dta`.
2. `pip install numpy pandas`
3. `python build_data.py path/to/usdina2019.dta`
   (add `--verify` to diff against the shipped files instead of writing)

## Data credit

All underlying data: Piketty, Saez, and Zucman, *Distributional National
Accounts: Methods and Estimates for the United States* (QJE 2018) and their
February 2022 external-use microfiles (<https://gabriel-zucman.eu/usdina/>).
The external-use files track but do not exactly reproduce their published
internal-data results. Dollar figures are converted to constant ~2023 dollars
via a WID price bridge (×1.2113).

Known limitations worth knowing before you lean on results: the bottom three
percentiles of the data have near-zero incomes (partly non-claiming of
benefits, partly unit/timing mismatch), and the EDEI welfare measure floors
incomes at $100/yr; DINA income excludes capital gains entirely; the
pension-asset layer cannot be split into DC accounts vs DB funds, so its
market exposure is a single dial.

## License

Code: MIT. Derived data files: subject to the source data's terms — cite
Piketty–Saez–Zucman if you use them.
