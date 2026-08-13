# Research report v2 — Thailand carbon impact for the three presentation activities

## Decision summary

The prototype can show a useful and defensible carbon result, but it must not present all three activities as one homogeneous, measured reduction.

For the exact presentation inputs, the selected model is:

| Activity | Internal result | Consumer display | Accounting class |
|---|---:|---:|---|
| Bus, fixed 0.799211 km trace | `0.09263 kg CO₂` | `≈0.09 kg CO₂ less than a car` | comparison / estimated avoided operational CO₂ |
| Recycling, 46 PET bottles | `1.7609 kg CO₂e` | `≈1.8 kg CO₂e avoided` | estimated avoided lifecycle emissions, conditional on recycling |
| Tree, one eligible planted tree | `29.925 kg CO₂e over 5 years` | `≈30 kg CO₂e projected absorption over 5 years` | projected sequestration, survival-adjusted |
| Home after all three | `1.8536 kg` avoided-class subtotal and `29.925 kg` projected-class subtotal | `≈1.9 kg CO₂e estimated avoided` and `≈30 kg CO₂e projected absorption (5 years)` | two separate totals; never one unlabeled sum |

The point policy remains independent: bus `3`, recycling `20`, tree `15`. Carbon factors do not set points and points are not convertible to kgCO₂e.

## Research method

- Scope: the four questions authorized by approved `SK@v2`: Thai passenger transport, Thai PET recycling, Thai tree sequestration, and cross-cutting accounting/uncertainty.
- Evidence priority: current TGO/T-VER methods and factor tables, Thai government data, IPCC/UNFCCC/GHG Protocol methods, then peer-reviewed Thai studies for triangulation or parameters missing from the official methods.
- Deep reads: the applicable TGO transport, PET, and forestry methods; a recent TGO transport monitoring report; the TGO Premium methodology guide; GHG Protocol Project Protocol; IPCC uncertainty/forestry chapters; and the principal Thai PET/tree field studies.
- Evidence labels:
  - `directly_supported`: stated by an applicable primary method/source.
  - `derived`: arithmetic performed from supported values.
  - `assumption`: necessary prototype choice not established by the user's activity evidence.
  - `insufficient`: not supportable with the present mock inputs.
- Selection rule: prefer an applicable Thai official method over a newer but mismatched global or lifecycle number. Preserve the source's native boundary and GWP basis instead of silently mixing factors.

## RQ1 — bus compared with a private car

### Selected model

The TGO modal-shift method and a recent Bangkok E-Bus monitoring report use:

- private car: `127.10 g CO₂/passenger-km`;
- scheduled bus: `11.20 g CO₂/passenger-km`.

For a verified route distance `d`:

```text
car_reference_kg = d × 0.12710
bus_operational_kg = d × 0.01120
comparison_difference_kg = max(0, car_reference_kg - bus_operational_kg)
```

Exact mock calculation:

```text
d = 0.799211 km
car = 0.799211 × 0.12710 = 0.1015797 kg CO₂
bus = 0.799211 × 0.01120 = 0.0089512 kg CO₂
difference = 0.0926286 kg CO₂
display = 0.09 kg CO₂
```

### Applicability and limits

- `directly_supported`: the two passenger-km operational CO₂ factors and the distance-times-factor structure.
- `derived`: the exact mock result.
- `assumption`: the participant would otherwise have made the same trip by private car. The prototype has no prior-mode survey.
- `insufficient`: full lifecycle CO₂e, current route-specific occupancy, CH₄/N₂O, vehicle/fuel manufacture, infrastructure, or an actual certified reduction.
- The TGO method's `2.64%` system leakage parameter is not applied. It belongs to an electric public-transport project boundary and would be a weak transplant to one generic passenger trip; it also does not change the displayed two-decimal result.
- The preferred consumer phrase is a comparison: `about 0.09 kg CO₂ less than a car for the same distance`, not `0.09 kg carbon removed`.

### Cheap falsification check

Ask the presenter/user for prior travel mode. If the bus did not replace a car/taxi trip, retain the trip comparison in the receipt but do not add it to the Home avoided subtotal. A future route/vehicle feed can replace the scheduled-bus average when available.

## RQ2 — 46 PET bottles delivered for recycling

### Selected model

TGO Standard T-VER `T-VER-S-METH-09-06 v2` accounts for virgin-plastic baseline emissions, recycling electricity, and applicable transport leakage. The prototype must first convert bottle count into estimated accepted mass and then into qualifying dry PET output because the TGO functional quantity is output, not submitted bottle count.

```text
accepted_mass_kg = accepted_count × average_bottle_body_mass_kg
qualifying_output_kg = accepted_mass_kg × qualifying_output_yield
avoided_kg_co2e = qualifying_output_kg
  × ((virgin_pet_ef × substitution_quality_factor)
     - (recycling_electricity_kwh_per_kg × thailand_grid_ef))
  - transport_leakage_kg_co2e
```

Selected parameters:

| Parameter | Value | Status |
|---|---:|---|
| Mean PET bottle-body mass | `0.0292917 kg/item` | `derived` from a Thai hospital dataset covering 158,748 mixed 500/600/1,000 mL bottles and 4.65 t PET |
| Qualifying output yield | `0.75` | `assumption`; conservative until partner output data exist |
| Virgin PET factor | `2.9389 kg CO₂e/kg` | `directly_supported`, current TGO/Thai National LCI factor |
| Substitution/quality factor | `0.75` | `directly_supported`, TGO/UNFCCC method parameter |
| Recycling electricity | `0.83 kWh/kg` | `directly_supported`, small-scale method default |
| Thai grid factor | `0.5562 kg CO₂e/kWh` | `directly_supported`, current TGO factor |
| Transport leakage | `0` | `assumption` for the mock; no dedicated collection trip and no route beyond the TGO threshold |

Exact mock calculation:

```text
accepted_mass = 46 × 0.0292917 = 1.3474182 kg
qualifying_output = 1.3474182 × 0.75 = 1.0105637 kg
net_factor = (2.9389 × 0.75) - (0.83 × 0.5562)
           = 1.742529 kg CO₂e/kg output
result = 1.0105637 × 1.742529 = 1.7609 kg CO₂e
display = 1.8 kg CO₂e
```

### Applicability and limits

- `directly_supported`: method structure, PET factor, grid factor, quality factor, recycling electricity default.
- `derived`: mixed-bottle mean mass and the 46-bottle result.
- `assumption`: `75%` qualifying output yield, zero collection-trip leakage, and eventual manufacture that substitutes virgin PET.
- `insufficient`: actual submitted weight, dry rPET output, final use, and partner electricity/transport.
- The activity is eligible for a numeric climate receipt only when material is PET in the presentation mock. Paper, glass, metal, and electronics must not reuse the PET factor.
- Delivery confirmation proves collection, not final recycling. Copy therefore says `assuming successful recycling` and never claims a T-VER reduction or credit.

### Cheap falsification check

Weigh 10–20 actual demo bottles. If mean body mass differs from `29.3 g` by more than 15%, replace the count proxy. Ask a partner for input kg, dry output kg, electricity, and destination; any yield below `0.75` or non-substitution use requires a lower result, and disposal/fuel use makes this avoided claim inapplicable.

## RQ3 — one planted tree

### Selected model

TGO's current Standard T-VER tree-count tool gives `9.5 kg CO₂/tree/year`. A 2026 five-year Bangkok urban-park observation found that 37% of the original trees were lost, giving a local observed survival factor of `0.63`. The consumer prototype therefore uses a five-year, survival-adjusted projection:

```text
projected_tree_kg_co2e = eligible_tree_count
  × 9.5 kg CO₂/tree/year
  × 5 years
  × 0.63 survival factor
  × verification factor
```

Exact mock calculation:

```text
1 × 9.5 × 5 × 0.63 × 1 = 29.925 kg CO₂
display = about 30 kg CO₂e projected absorption over 5 years
```

The numeric equivalence uses CO₂'s GWP of 1; it remains a future projection, not an avoided-emissions entry.

### Applicability and limits

- `directly_supported`: TGO tree-count factor, eligibility rule, and conservative zero treatment for dead/unidentifiable trees; the Bangkok study's observed five-year survival result.
- `derived`: the five-year `29.925 kg` survival-adjusted projection.
- `assumption`: the planting resembles a managed Bangkok urban setting and the tree remains identifiable/maintained over five years.
- `insufficient`: species, height, DBH, site, maintenance, planting/irrigation/fertilizer emissions, soil carbon, and future survival of this individual tree.
- The TGO count method applies to an eligible tree/sapling above the specified height threshold, not an arbitrary young seedling. The mock activity should state `eligible sapling (about 1.3 m or taller)` or describe its number as an educational estimate that assumes eligibility.
- A photo and GPS point do not satisfy T-VER permanence, monitoring, validation, or verification requirements. The product must say `projected absorption`, never `verified reduction`, `offset`, or `carbon credit`.

### Upgrade path and falsification check

Follow up annually and set future contribution to zero when the tree cannot be identified/alive. A measurement-grade version collects species, DBH, height, and site, then applies a Thai allometric equation and the relevant root/shoot and carbon fractions. Do not apply `44/12` or carbon fraction again to the count factor; `9.5` is already expressed as CO₂.

## RQ4 — common accounting, uncertainty, and display

### Accounting boundary

- GHG Project Protocol and TGO project methods define a reduction against a baseline and require material project/leakage effects. The app instead has evidence of an activity plus model assumptions, so all results remain estimates.
- Bus and PET are comparison/avoided quantities. Tree is future projected sequestration. They may appear in one module only as visibly separated rows.
- Home can add bus and PET raw values into one `estimated avoided` subtotal because both are modeled avoided emissions, while retaining the bus's narrower operational-CO₂ disclosure. It must never add the tree projection to that number.
- Carbon-price/THB value, offsets, additionality, permanence crediting, and verified-carbon-unit claims are excluded.

### Gas and GWP basis

- Bus source: operational CO₂ only; numeric GWP equivalence is 1, but omitted gases and lifecycle stages remain disclosed.
- TGO PET source: kgCO₂e using its native IPCC 2013 GWP100a/Thai LCI basis.
- Tree count factor: CO₂ absorption. Consumer impact rows can share a `kg CO₂e` family label only when the bus detail explicitly states `operational CO₂ only`; the bus success receipt itself should retain `kg CO₂`.
- Do not silently recalculate older/native factors to AR6. Store source methodology and GWP basis with the calculation snapshot.

### Precision and accumulation

- Store raw results to at least six decimal places and accumulate raw values, not rounded UI strings.
- Display `<0.01` below one hundredth; display two decimals below `1 kg`; one decimal from `1–9.9 kg`; whole numbers at `10 kg` or more.
- Use approximation language (`≈`, `about`, `ประมาณ`, `약`) and no fake confidence interval. The current inputs do not support one.
- Preserve the assumptions alongside every result so future factor/version changes do not rewrite history.

### Claim language

Allowed:

- `estimated`, `compared with`, `assuming successful recycling`, `projected over 5 years`, `not a certified carbon credit`.

Disallowed:

- `measured reduction`, `verified carbon reduction`, `offset`, `carbon neutral`, `TGO approved`, or adding the tree projection to an all-time `carbon reduced` total.

## Source ledger (28 sources)

### Cross-cutting

1. [GHG Protocol Project Protocol](https://ghgprotocol.org/sites/default/files/standards/ghg_project_accounting.pdf) — baseline, primary/secondary effects, monitoring, conservative uncertainty treatment.
2. [TGO Premium T-VER Methodology Development Guideline v02](https://tver.tgo.or.th/images/2026/Guideline_for_Premium_T-VER_Meth_Version_02_ENG.pdf) — relevance, completeness, consistency, accuracy, transparency, conservativeness; `ER = BE − (PE + LE)`; uncertainty and non-permanence.
3. [IPCC 2019 Refinement, Vol. 1 Ch. 3 Uncertainties](https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/1_Volume1/19R_V1_Ch03_Uncertainties.pdf) — activity-data/factor uncertainty, bias, precision, and preference for country-specific higher-tier data.
4. [TGO current organizational emission factors, February 2026](https://thaicarbonlabel.tgo.or.th/tools/files.php?files=TlRrPQ&mod=YjNKbllXNXBlbUYwYVc5dVgyUnZkMjVzYjJGaw&type=WDBaSlRFVlQ) — current TGO GWP/fuel-factor context.

### Passenger transport

5. [TGO T-VER-S-METH-03-02 v01](https://tver.tgo.or.th/database/Uploads/Methodology/b51b3bf6-a51a-4b7e-a394-8743f44ff2fc.pdf) — applicable modal-shift method and passenger-km car factor.
6. [TGO current transport methodology catalog](https://tver.tgo.or.th/database/public/methodology/28?category_id=3&lang=en) — current version/effective date.
7. [TGO Bangkok E-Bus monitoring report](https://tver.tgo.or.th/database/Uploads/Project/Credit/d629bc05-8d4d-4cd8-bd32-91a0de89ee66.pdf) — current project use of car and scheduled-bus factors.
8. [Thailand OTP transport/energy final report](https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2562/Project05/TrackingDBT_Exsum-EN%20Final.pdf) — Bangkok occupancy and vehicle-km cross-check.
9. [IPCC 2006 Vol. 2 Ch. 3 Mobile Combustion](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf) — fuel-carbon fallback and methodological boundary.
10. [Thanatrakolsri & Sirithian 2025](https://doi.org/10.3390/cleantechnol7030060) — recent Thai vehicle-emission-model sensitivity check.
11. [Champeecharoensuk et al. 2022](https://doi.org/10.1016/j.esd.2022.08.019) — Thai fixed-route bus GHG study; triangulation, not selected pkm factor.
12. [Gabriel et al. 2021](https://doi.org/10.1016/j.jclepro.2021.128013) — Thai bus lifecycle comparison; evidence that lifecycle and operational factors must not be mixed.

### PET recycling

13. [TGO Standard T-VER waste methodology catalog](https://tver.tgo.or.th/database/public/methodologies/1?category_id=9&lang=en) — current `T-VER-S-METH-09-06 v2` status.
14. [TGO T-VER-S-METH-09-06 Version 02](https://tver.tgo.or.th/database/Uploads/Methodology/f6dac6a7-c83e-4bff-85d5-785ff8252f1a.pdf) — PET scope, virgin baseline, process electricity, leakage, monitoring and reduction equation.
15. [TGO product emission-factor database, July 2026](https://thaicarbonlabel.tgo.or.th/tools/files.php?files=T1E9PQ&mod=Y0hKdlpIVmpkSE5mWlcxcGMzTnBiMjQ9&type=WDBaSlRFVlQ) — PET `2.9389` and Thai grid `0.5562` factors and native LCIA basis.
16. [UNFCCC AMS-III.AJ v9.0](https://cdm.unfccc.int/methodologies/DB/LOWIXM9S6DVO7DGXB21DPVLE8N3VB9/) — qualifying dry output, final-use tracking, quality factor, and double-counting boundaries.
17. [Ramathibodi Hospital Thailand PET bottle LCA](https://ph01.tci-thaijo.org/index.php/aer/article/download/256148/172791/979759) — Thai bottle material quantities used for the mixed-bottle mass proxy.
18. [Kongseecha et al. 2023, Thai post-consumer rPET value chain](https://rs.mfu.ac.th/ojs/index.php/jfat/article/download/404/297) — collection/transport/process sensitivity.
19. [Chairat & Gheewala 2023](https://doi.org/10.1016/j.envres.2023.116788) — Thai bottle-to-bottle/fiber LCA and recycled-path comparison.
20. [Kositcharoenkul et al. 2025](https://doi.org/10.1016/j.resconrec.2024.108022) — Thai packaging LCA and allocation/end-of-life model distinctions.

### Tree planting

21. [TGO T-VER-S-TOOL-01-01 v2](https://ghgreduction.tgo.or.th/th/tver-method/tver-tool/for-agr/download/12026/3451/31.html) — current tree-count equation, `9.5 kg CO₂/tree/year`, eligibility and dead-tree treatment.
22. [TGO Large Scale Sustainable Forestation v2](https://ghgreduction.tgo.or.th/th/tver-method/t-ver-classify-methodology/t-ver-methodology13/download/12006/3447/31.html) — forestry baseline, project emissions, leakage and biomass pools.
23. [TGO Standard Tree Carbon Equations](https://tver.tgo.or.th/images/2025/%E0%B8%AA%E0%B8%A1%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A1%E0%B8%B2%E0%B8%95%E0%B8%A3%E0%B8%90%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%A1%E0%B8%B4%E0%B8%99_C_Stock.pdf) — DBH/height allometry for a measurement-grade upgrade.
24. [IPCC 2006 Vol. 4 Ch. 2](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf) — carbon-pool/change and `44/12` conversion principles.
25. [IPCC 2019 Refinement Vol. 4 Ch. 4 Forest Land](https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch04_Forest%20Land.pdf) — updated forestry parameters and uncertainty considerations.
26. [Fujimoto et al. 2016, Bangkok urban trees](https://li01.tci-thaijo.org/index.php/tjf/article/download/246985/168979/852665) — Bangkok park/street-tree field cross-check and its limits.
27. [Kasikam et al. 2026, Bangkok CU100 Park](https://www.nature.com/articles/s41598-026-36098-w) — observed five-year tree loss used for the local survival adjustment.
28. [Duangsathaporn et al. 2023](https://www.mdpi.com/1999-4907/14/8/1584) — Thai species/DBH/height research underpinning a future measurement route.

## Final verdict

- Bus `0.09 kg CO₂`: `PASS` as a same-distance private-car comparison, not as proven user-level additional reduction.
- PET `1.8 kg CO₂e`: `PASS WITH CONDITIONS` for the 46-bottle presentation mock when the count/mass/output assumptions and successful-recycling condition remain available in disclosure.
- Tree `30 kg CO₂e over 5 years`: `PASS WITH CONDITIONS` as projected, survival-adjusted absorption for an eligible maintained tree; `FAIL` as an immediate reduction or certified credit.
- Home `1.9 avoided + 30 projected`: `PASS` only as two separately labelled classes; a single `31.9 kg carbon reduced` figure is `FAIL`.
