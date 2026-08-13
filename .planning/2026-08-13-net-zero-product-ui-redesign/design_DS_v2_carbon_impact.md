# DS@v2 — Carbon-impact extension for the approved Net Zero consumer wallet

## Artifact

- Type: evidence-backed product design extension
- Stable ID: `DS`
- Exact version: `v2`
- Base: approved `DS@v1`, retained Fable 5 typography/illustrations, `SK@v2`, and `research_report_v2_carbon_impact.md`
- Design intent: make the climate result visible at the moment it is earned and cumulative on Home, without weakening the point/reward CTA or implying a carbon credit.

## Locked presentation outcomes

| Activity | Points | Climate receipt |
|---|---:|---|
| Fixed demo bus trip (`0.799211 km`) | `+3` | `≈0.09 kg CO₂ less than a car` |
| `46` PET bottles | `+20` | `≈1.8 kg CO₂e avoided` |
| One eligible tree | `+15` | `≈30 kg CO₂e projected absorption over 5 years` |
| After all three | `38` | Home: `≈1.9 kg CO₂e estimated avoided`; separately `≈30 kg CO₂e projected absorption (5 years)` |
| After 20-point voucher | `18` balance | climate values remain unchanged; voucher redemption never changes impact history |

## Hierarchy and flow

### 1. Activity success screen

Keep the current Fable stamped-success composition and activity scene. Insert one compact `ClimateReceipt` below the point result and above the return CTA.

Hierarchy:

1. completion icon/status;
2. awarded points — largest and primary;
3. climate receipt — secondary bordered/tinted row;
4. one short assumption sentence;
5. return to Home/activity CTA.

The receipt must not compete with the point number. Use the existing green line system, neutral surface, and orange only for rewards/points. Do not introduce charts, badges, methodology IDs, or a new illustration family.

### 2. Home

Add `ClimateImpactSummary` immediately after the existing green activity CTA and before `Available activities` in the main column. This makes the result visible without displacing the point hero, next-reward progress, or primary CTA.

The module contains exactly two rows:

- `Estimated avoided` — raw sum of eligible bus and PET impacts;
- `Projected absorption (5 years)` — raw sum of tree projections with the same horizon.

Zero state shows both rows as `0`, not a tutorial. The module updates immediately when the activity returns success and reloads from the same persisted mock dashboard state. It never renders a grand total.

On desktop, keep the approved `248 px` rail, `1180 px` cap, and main/secondary Home columns. The climate module stays in the main column; the reward/recent/leaderboard secondary column is unchanged. On 1024–1199 px it remains a two-row card inside the width-safe main track. On mobile 390/430 px it is a full-gutter card after the CTA; rows stack only when localization cannot retain a readable value track.

### 3. Activity history

Replace the generic `Estimated {value} kg CO₂e` line with type-aware receipt copy. Store/display the activity's original result and method version; future factor changes never rewrite old history.

- Bus: car comparison, `kg CO₂`, operational boundary.
- PET: estimated avoided, `kg CO₂e`, conditional recycling disclosure.
- Tree: projected absorption, `kg CO₂e`, five-year horizon.

### 4. Calculation disclosure

Each receipt has one `How calculated` details row. It may show a plain-language comparison and source family (`Thailand TGO method`) but not factor IDs, hashes, formula code, fixture IDs, approval gates, or architecture language.

## Exact consumer copy

### Thai

```text
Home heading: ผลกระทบคาร์บอนของฉัน
Avoided row: การปล่อยที่หลีกเลี่ยง (โดยประมาณ)
Tree row: การดูดซับที่คาดการณ์ (5 ปี)
Disclosure action: คำนวณอย่างไร

Bus value: น้อยกว่ารถยนต์ประมาณ 0.09 กก. CO₂
Bus note: เปรียบเทียบการปล่อยช่วงใช้งานในระยะทางเดียวกัน

PET value: หลีกเลี่ยงประมาณ 1.8 กก. CO₂e
PET note: ประเมินจากขวด PET 46 ใบ โดยสมมติว่ารีไซเคิลสำเร็จ

Tree value: คาดว่าจะดูดซับประมาณ 30 กก. CO₂e ใน 5 ปี
Tree note: ปรับตามอัตรารอด ไม่ใช่คาร์บอนเครดิตที่รับรองแล้ว

Shared disclosure: เป็นค่าประมาณจากแนวทาง TGO ไม่ใช่คาร์บอนเครดิต
```

### English

```text
Home heading: My carbon impact
Avoided row: Estimated avoided
Tree row: Projected absorption (5 years)
Disclosure action: How calculated

Bus value: ≈0.09 kg CO₂ less than a car
Bus note: Same-distance operational emissions comparison

PET value: ≈1.8 kg CO₂e avoided
PET note: Estimated for 46 PET bottles, assuming successful recycling

Tree value: ≈30 kg CO₂e projected over 5 years
Tree note: Survival-adjusted estimate, not a certified carbon credit

Shared disclosure: Estimated using TGO methods; not a certified carbon credit
```

### Korean

```text
Home heading: 나의 탄소 영향
Avoided row: 추정 회피량
Tree row: 예상 흡수량 (5년)
Disclosure action: 계산 기준

Bus value: 승용차 대비 약 0.09 kg CO₂ 적게 배출
Bus note: 같은 거리의 운행단계 배출량을 비교했어요

PET value: 약 1.8 kg CO₂e 회피
PET note: PET병 46개가 재활용된다고 가정한 추정치예요

Tree value: 5년간 약 30 kg CO₂e 흡수 예상
Tree note: 생존율을 반영한 예상치이며 인증 탄소크레딧이 아니에요

Shared disclosure: TGO 방법을 활용한 추정치이며 인증 탄소크레딧이 아닙니다
```

The invariant `Net Zero` wordmark is unchanged and never translated.

## Calculation authority

Create one shared, pure calculation module used by both API-aligned fixtures and the browser-local public demo. The UI must not contain factor literals.

```ts
type ImpactType = "avoided" | "projected_sequestration";

type ImpactReceipt = {
  activity: "bus" | "recycling" | "tree";
  impactType: ImpactType;
  rawKgCo2e: number;
  displayUnit: "kg_co2" | "kg_co2e";
  horizonYears?: 5;
  methodId: string;
  methodVersion: string;
  sourceUrl: string;
  assumptions: string[];
  disclosureKey: string;
};
```

Selected method identifiers:

- `TH-BUS-CAR-COMP-v1`: `distance × (0.12710 − 0.01120)`; fixed demo trace `0.799211 km`.
- `TH-PET-TVER-PROXY-v1`: count-to-mass proxy, `0.75` qualifying-output yield, TGO substitution/electricity factors, zero mock transport leakage.
- `TH-TREE-PROJ-v1`: one eligible tree, `9.5 kg/tree/year × 5 years × 0.63 survival`.

Required behavior:

- aggregate raw values, then format;
- bus and PET contribute only to `avoided`;
- tree contributes only to `projected_sequestration`;
- claims with ineligible/unsupported input produce no numeric receipt;
- non-PET recycling materials produce `impact unavailable`, never the PET result;
- factors and assumptions are copied into immutable calculation snapshots;
- public-demo and API path return the same result for the same presentation fixture.

## Factor/data changes after approval

- Replace the backend bus candidate's `0.09 kg/pkm` bus factor with the supported scheduled-bus operational factor `0.01120 kg CO₂/pkm`; retain car `0.12710` and record the operational-CO₂ boundary.
- Replace the existing PET per-item shortcut with the complete proxy inputs. If the schema requires a per-item factor, derive and document it from the selected parameters rather than hiding the equation.
- Retain TGO tree `9.5 kg/tree/year`, add explicit `5-year` horizon and `0.63` survival parameter, and classify the output as projected sequestration.
- Keep all historical factors versioned rather than overwriting previously credited snapshots.

## Responsive and visual acceptance

- Preserve Fable/Fraunces/Sarabun/Noto Serif Thai typography, shared wordmark, city hero, and all bus/recycling/tree Fable scenes.
- Preserve the approved point-first hierarchy and green primary CTA.
- Use existing surface, border, radius, spacing, green, and orange tokens; no dashboard chart, carbon gauge, gradient, or additional brand color.
- 390/430 px: no horizontal overflow; title and two localized rows remain readable above bottom-nav safe area.
- 1024 px: no zero-width/collapsed value track; climate card does not cause the point hero or right rail to compress.
- 1440/1586 px: retain the approved main/secondary proportions and content cap.
- Reduced-motion users receive no counting animation; values update atomically with an `aria-live="polite"` status.

## Verification contract

### Formula tests

- Bus exact result for `0.799211 km`: `0.0926285549 kg`; zero distance and negative delta clamp to zero.
- PET exact result for 46 items: approximately `1.7609 kg CO₂e`; zero count, unsupported material, and missing verification return no credited numeric result.
- Tree exact result: `29.925 kg CO₂e / 5 years`; missing eligibility/verification returns no credited numeric result.
- Formatting: `0.0926286 → 0.09`, `1.7609 → 1.8`, `29.925 → 30`, and raw accumulation `0.0926286 + 1.7609 → 1.9` for Home.

### Flow tests

- Fresh mock: avoided `0`, projected `0`.
- Bus success: `+3`, bus climate receipt, Home avoided updates without reload and persists after reload.
- Recycling 46 PET success: `+20`, PET receipt, Home avoided becomes about `1.9`.
- Tree success: `+15`, five-year projected receipt, Home projected becomes about `30`; avoided remains about `1.9`.
- Redeem 20-point voucher: balance `18`; both climate totals remain unchanged.
- History renders all three semantic types correctly.
- Public demo and API/fixture result parity for all three activities.

### Language and rendering tests

- Complete Thai/English/Korean key coverage and immediate language switching.
- `Net Zero` remains invariant.
- Desktop Chromium and Pixel 7 functional suite.
- Direct rendered QA at 390, 430, 1024, 1440, and 1586 px with zero horizontal overflow and no console warning/error.
- Fresh public Cloudflare verification after local acceptance and explicitly authorized publication/deployment.

## Claim and scope exclusions

- No TGO approval, verified carbon unit, offset, additionality, permanence, carbon neutrality, or production MRV claim.
- No monetary/THB carbon valuation.
- No production database or real participant data on the Cloudflare presentation surface.
- No redesign of the approved DS@v1 shell, navigation, Fable scenes, wordmark, point policy, leaderboard, reward catalog, or voucher lifecycle.

## Approval scope requested

Exact approval of `DS@v2` authorizes implementation of this carbon calculation/data/UI extension, local verification, scoped commits and push to `main`, and redeployment of the existing browser-local Cloudflare presentation mock. It does not authorize production-data connection, carbon-credit issuance, TGO approval claims, or any value outside the formulas and boundaries above.
