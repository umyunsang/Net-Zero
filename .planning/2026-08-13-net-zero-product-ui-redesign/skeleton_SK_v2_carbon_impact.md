# SK@v2 — Thailand-based activity carbon-impact extension

## Artifact
- Type: product and research skeleton
- Stable ID: `SK`
- Exact version: `v2`
- Stable locator: `.planning/2026-08-13-net-zero-product-ui-redesign/skeleton_SK_v2_carbon_impact.md`
- Base: approved `SK@v1` / `DS@v1`; this is a bounded extension, not a redesign.

## Normalized request
- Outcome: calculate a defensible Thailand-context climate impact for the three mock-demo activities, show it with the point result after each completed activity, and update the participant's cumulative impact on Home immediately.
- Audience: Thai consumer first, with the existing English and Korean translations.
- Primary display unit: `kgCO₂e`.
- Interpretation of “total value”: cumulative climate quantity, not a THB monetary valuation. A carbon-price conversion is excluded unless separately requested and sourced.
- Done signal: after bus, recycling, and tree activities, the success view shows points plus the correct impact label/value; Home updates without reload and preserves separate avoided-emissions and projected-tree-sequestration totals; the same state survives reload in the public browser-local demo.

## Why a new research/design gate is required
- The repository already has a versioned factor catalog, immutable calculation snapshots, and separate `avoided` / `projected_sequestration` carbon ledgers.
- The deployed public-demo adapter bypasses that formula and currently hard-codes bus `0.30`, recycling `2.50`, and tree `3.00` kgCO₂e.
- The database candidates currently use a bus passenger-km delta, a PET count/mass proxy, and a one-year tree proxy, but their source fitness, currentness, uncertainty, and precise consumer claim have not been revalidated for this request.
- Therefore, adding one combined “carbon reduced” number now would present non-equivalent quantities as if they were measured and current.

## Recommended measurement model

### Shared rule
`estimated impact = verified activity quantity × versioned factor × explicitly declared adjustments`

The factor is only one part of the calculation. The result also depends on the functional unit, counterfactual baseline, system boundary, time horizon, and uncertainty. Points remain a product reward policy and are not converted from kgCO₂e.

### 1. Bus — avoided emissions
- Functional unit: passenger-kilometres (`passenger-km`).
- Candidate structure: `verified distance × max(0, private-car baseline EF − public-bus EF)`.
- Research must determine the most appropriate Thailand/Bangkok private-car baseline, bus technology/occupancy basis, gas coverage, and the route distance represented by the fixed presentation trace.
- Consumer claim: estimated emissions avoided for this trip compared with the declared private-car baseline; never “zero-emission trip.”

### 2. PET recycling — avoided lifecycle emissions
- Preferred functional unit: kilograms of accepted PET, not bottle count.
- Candidate structure: `accepted PET mass × (virgin-production/disposal baseline − collection/recycling process emissions − quality or yield loss)`.
- If the mock cannot collect weight, a sourced bottle-mass proxy may convert accepted count to mass, but the assumption and uncertainty must be retained in the calculation snapshot.
- Consumer claim: estimated lifecycle emissions avoided from the accepted PET scenario; delivery evidence alone does not prove final recycling.

### 3. Tree planting — projected sequestration
- Functional unit: one verified planted tree over an explicit period.
- Candidate structure: `species/site growth estimate × carbon-to-CO₂ conversion × survival adjustment × time horizon`, using the applicable Thai forestry/T-VER/IPCC method.
- This is not an immediate avoided emission. It must remain `projected sequestration`, with its horizon visible in plain language.
- Consumer claim: projected absorption under stated survival/time assumptions; never a realized offset or carbon credit.

## Consumer information architecture

### Activity success
- Preserve the current success hierarchy and Fable visual language.
- First: awarded reward, e.g. `+3 points`.
- Second: climate receipt row.
  - Bus/recycling: `Estimated avoided · {value} kgCO₂e`.
  - Tree: `Projected absorption · {value} kgCO₂e / {horizon}`.
- One short `How calculated` disclosure may explain the comparison/assumption in natural language. Factor IDs, methodology codes, fixture IDs, and approval digests remain hidden.

### Home
- Add one compact impact module after the point/reward hero, without displacing the primary activity CTA.
- Primary figure: `Your climate impact` only if the two classes are visually separated directly beneath it.
- Required split:
  - `Estimated avoided` — bus + recycling.
  - `Projected absorption` — trees, with time horizon.
- Do not add avoided emissions and future sequestration into a single unlabeled “carbon reduced” value.
- Animate/update after activity completion and load from the existing dashboard totals on revisit/reload.

### History
- Replace the generic impact line with type-aware copy, so tree entries never read as already avoided emissions.
- Preserve `Estimated` language and the existing exclusion of internal identifiers.

## Evidence and claim boundary
- All values are model estimates, not direct measurements.
- The public surface is a presentation mock with browser-local data.
- No TGO approval, verified carbon unit, offset, carbon credit, additionality, permanence, or production MRV claim.
- A source can be authoritative without making the prototype's activity evidence sufficient for a credit claim.
- Use the newest applicable version only after checking that the method fits the functional unit and boundary; “latest” alone is not treated as “best.”
- Preserve factor version, source URL, assumptions, formula, result, and disclosure in the internal calculation/evidence record.

## Post-approval deep-research manifest

### RQ1 — Thailand passenger transport
- Determine the best current Thailand/Bangkok factors or methodologies for private passenger car and public bus per passenger-km.
- Resolve occupancy, fuel/vehicle class, route distance, and whether the source covers CO₂ or full CO₂e.
- Priority sources: TGO/T-VER and Thai government transport or energy datasets; IPCC/GHG Protocol only for missing methodological pieces; peer-reviewed Thai transport LCA as triangulation.

### RQ2 — Thailand PET recycling
- Determine a defensible cradle-to-gate or avoided-burden equation for accepted PET in Thailand.
- Resolve mass-per-bottle proxy, recycling yield/quality loss, transport/process emissions, and baseline treatment.
- Priority sources: TGO/T-VER methodology, Thai national LCI or government waste studies, and recent peer-reviewed Thai/ASEAN PET LCA.

### RQ3 — Thailand tree sequestration
- Determine a defensible Thai urban/tree-planting estimate with explicit species/site, time horizon, growth, and survival limits.
- Priority sources: TGO/T-VER forestry methodology, Thailand forestry agencies or datasets, IPCC 2019 Refinement, and peer-reviewed Thai biomass/allometry studies.

### RQ4 — Cross-cutting accounting and uncertainty
- Define common gas basis, GWP version, rounding, conservative/default assumptions, uncertainty ranges, and consumer wording.
- Check whether avoided emissions and projected sequestration can be displayed together and under what separation/labeling rules.
- Priority sources: IPCC, GHG Protocol Project Protocol/product guidance where applicable, ISO-aligned primary methodology documents, and peer-reviewed measurement studies.

### Research output requirements
- 15–30 sources total, weighted to primary official and peer-reviewed material.
- At least 3–5 full-method deep reads, not search-snippet synthesis.
- Every selected numeric factor receives: jurisdiction, year/version, functional unit, system boundary, gas/GWP basis, assumptions, uncertainty/limitations, and applicability verdict.
- Evidence labels: `directly_supported`, `derived`, `assumption`, or `insufficient`.
- Deliver a source ledger, formula comparison, selected conservative formula, example calculation for the exact mock inputs, and falsification checks.

## Design and implementation sequence after research
1. Produce the evidence ledger and factor/formula recommendation.
2. Derive `DS@v2` with exact TH/EN/KO copy, component placement, responsive behavior, calculation states, and expected three-activity totals.
3. Request exact `DS@v2` approval.
4. Only after approval: update the public-demo calculation authority, factor fixture/snapshot where warranted, consumer UI, translations, tests, and deployment.

## Verification target after implementation
- Formula unit tests for bus, PET, tree, rounding, zero/negative deltas, and horizon labeling.
- API/public-demo parity test for the same mock inputs.
- State test: success result → Home immediate totals → reload persistence.
- Semantic test: bus/recycling use `avoided`; tree uses `projected sequestration`.
- TH/EN/KO and 390/430/1024/1440 responsive QA with no point-CTA regression.
- Fresh public Cloudflare verification only after local acceptance.

## Approval scope requested
Approval of `SK@v2` authorizes only the bounded read-only deep research in RQ1–RQ4 and preparation of the evidence-backed `DS@v2`. It does not authorize product-code changes, factor mutation, Git publication, Cloudflare deployment, or claims of TGO/carbon-credit approval.
