# Project Skeleton — Net-Zero City Tycoon Adversarial Review & Research (Revision)

## Metadata
- Skeleton ID: `SK`
- Version: `v5`
- Content fingerprint: `sha256:ee37ff82457c8021881e4d5bb8f4ecf6ee3d0164014150ac8641b49bf22ccd4b` (SHA-256 of this UTF-8 file with this entire line omitted)
- Status: `SKELETON_APPROVAL_PENDING(SK@v5)` during `REVISION_REQUIRED(SK@v4 → SK@v5)`
- Created: 2026-08-11
- Stable locator: `.planning/2026-08-11-net-zero-city-adversarial-review/project_skeleton_v5.md`
- Nearest project authority: no `AGENTS.md`; current user request; approved baseline design at `docs/superpowers/specs/2026-08-11-net-zero-city-tycoon-design.md`
- Current code baseline: `main@0b23005`; implementation lineage through `da8f349`
- Base skeleton: approved `SK@v4` / `sha256:3718d379796737fae25330ef7feec4fd258cfe80effb22ca44495c96c1aa0c18`
- Revision trigger: the bounded material contradiction inventory recorded in `contradiction_notice_SK_v4_to_v5.md`

## Raw request (verbatim)

```text
https://github.com/openfrontio/OpenFrontIO 이 게임은 https://github.com/WarFrontIO 이 레포를
  포크해서 고도화하고 설계를 더 게임성에 어울리게 만든 게임인데, 이 것처럼 나는
  도시건설시물레이션 게임을 만들고 싶어 타이쿤,심시티 처럼 하지만 최종사용자는 그냥 막 건물을
  건축하고 땅을 밀고, 전기를 까는게 아니라 모든요소요소에 탄소배출량을 매핑하는 차별점을 두고
  싶은거야 net-zero가 탄소 해커톤이기도 해서 해커톤에서 해당 게임을 통해 프로토타입을 만들고
  피티하려고해. 심시티나 타이쿤 같은 프로덕션 프로젝트는 인구밀집도나 불쾌지수같은 내부 산식을
  통해 스코어를 계산되는 방식인데,

  이 방식에 추가로 최종 사용자는 탄소배출량도 고려하겠끔하고 싶은거야. 게임은 openfront처럼 최종
  사용자는 별도의 설치없이 url 접속만으로 게임플레이가 가능하도록 하고싶어. openfront도 다른 프로
  덕션 프로젝트들과 다르게 집,공장,항구,핵,사드 > 5가지 요소로 축소하여 primitive 하게 만들어서
  직관성과 uiux 편의성을 챙겼는데, 우리 프로젝트도 최대한 의미있는요소가 유지되도록 축소하여 핵심
  primitive만 정해두고 싶어. 이미 fable 5로 어느정도 파운데이션을 잡고 일부 작업을 진행했는데 코드베이스를 확인해서 적대적리뷰까지 진행하고, 작업스코프도 잡아 >> 무작정 나의 질의 그대로 반영하는것이 아니라, 방향만 인지하고 딥리
  서치하여 스켈레톤으로 셋팅한다음 프로덕션 게임 프로젝트의 구성과 요소들을 딥리서치해서 적용할만
  한 모듈이나 컴포넌트가 있는지? 운영방식이 있는지? 등등 스코프를 넓게 잡고 다양하게 리서치하여
  인사이트를 확보한후 스켈레톤에 지속적으로 추가해봐, 디자인부분(모델링,랜더링)과 uiux 부분도 포
  함해서 리서치해
```

## Authority split

### Authoritative intent and constraints
- Outcome: turn the existing Fable 5 foundation and partial implementation into a defensible, hackathon-ready, zero-install browser city-tycoon prototype whose distinctive mechanic maps meaningful city decisions to transparent carbon emissions.
- Target/context: K-CAMT’26 Net-Zero Carbon Hackathon; non-expert players; a short live prototype and pitch; repository `/Users/um-yunsang/Net-Zero`.
- Must:
  - inspect the current codebase and perform an adversarial rather than confirmatory review;
  - preserve the direction, but do not implement the wording of the request mechanically;
  - research production city-builders/tycoons and reusable modules, components, operating practices, modelling/rendering, and UI/UX broadly;
  - keep the core game legible through a small set of meaningful primitives;
  - let the final player open a URL and play without installation;
  - make carbon consequences part of decisions and scoring, not a detached dashboard;
  - distinguish factual evidence, transferable patterns, assumptions, and proposals.
- Unaffected approved baseline decisions retained during research:
  - 3D browser game using Three.js + React Three Fiber;
  - fixed-length deterministic city-simulation goal;
  - money and carbon remain visible strategic constraints, but the exact hard-budget enforcement contract is reopened;
  - embodied construction and operational emissions stay in separate ledgers, with removals separate from gross;
  - single-player MVP, asynchronous basic-validation leaderboard later, no real-time multiplayer in the hackathon core;
  - mobile Safari remains a stated target; no AI/LLM, hardware, or live external API dependency.
- Affected decisions/acceptance contracts explicitly unfrozen pending evidence and DS@v2 approval:
  - D2: whether the carbon constraint uses exact pre-commit reservation, soft overage, run termination, annual settlement, or another clearly defined rule;
  - D10: whether `G` must test carbon compliance, how K avoids redundant incentive, and how population/housing/mobility/exposure are assigned and aggregated;
  - D11/D17: whether waste is a seventh placed primitive, a policy, or a staged facility mechanic;
  - D11 power: separate provenance and factors for external grid, on-site fossil, and solar supply;
  - D13: whether local UHI and upgrade embodied-carbon mechanics remain P0 or are explicitly relabelled/cut;
  - D15: the road network/frontage invariant and whether unsafe road removal remains in P0;
  - D7/D14/D18 and PRD FR-10/11: keyboard/touch parity, non-colour validity, zoom/reflow and mobile acceptance;
  - FR-03/05/07: truthful quote→commit carbon deltas, complete-state deterministic receipt and factor/activity reconciliation.
- Avoid:
  - blindly adding every researched feature;
  - copying proprietary game code/assets, names, UI trade dress, or unverifiable formulas;
  - treating an official carbon factor as universally applicable outside its boundary;
  - score soup, dominant one-button strategies, per-agent simulation, real-time multiplayer, or backend work before the playable core is proven;
  - new source code, dependency, asset, deployment, or external-action changes before the later design/implementation approvals.
- Permissions already granted: read supplied/local foundation and current authority files; prepare this intake skeleton.
- Explicit approvals already recorded: the local design specification says the user approved its decisions on 2026-08-11; it does **not** approve unknown deltas from this new research or authorize implementation under SK@v4.

### Provisional premises requiring evidence
1. OpenFrontIO is a source-derived rewrite of WarFrontIO/client, not a public Git fork with shared ancestry; exact base commit and exact fork delta are unavailable.
2. The isolated fixed-step simulation structure is promising, but the current `stateHash` is not a complete-state receipt and no current build/browser/device acceptance result exists.
3. The smallest meaningful primitive set and the status of waste as placed facility versus policy are unresolved; current documents/code disagree.
4. The intended hard-carbon constraint needs an enforceable, explainable rule; the current pre-action check and population-only `G` do not implement the approved guarantee.
5. External-grid, on-site fossil and solar supply require separate provenance; the exact on-site fossil factor or game proxy remains unresolved.
6. A·H·Q·M·K weights, temporal aggregation, population/housing/mobility assignment and simultaneous hard-budget/K incentives remain provisional and exploit-prone.
7. Local UHI, road-network/frontage and upgrade-carbon rules may be fixed or cut/relabelled for P0; current code does not implement their approved meaning.
8. R3F/Three.js may meet desktop Chrome and iPhone Safari needs at the current scale; no measured result exists, and current zoom/keyboard/touch/colour surfaces contradict acceptance requirements.
9. Procedural silhouettes are present, but overall modern/accessibility usability and asset-notice compliance are not acceptance-ready.
10. Production-game architecture and operating practices can be reduced to a hackathon-safe slice without importing production-scale complexity.

### Candidate solutions (options, not decisions)
- keep the current custom deterministic TypeScript simulation and harden its seams;
- move simulation off the render path or into a Worker only if profiling shows a need;
- adopt/adapt isolated patterns (command log, replay receipt, data-driven definitions, objective director, overlay system, save migration, telemetry events) rather than fork a whole game;
- reduce, merge, or stage primitives based on distinct-decision and demo-time tests;
- use procedural low-poly art for the hackathon, with a licensed modular asset pipeline only where it improves legibility;
- replace an all-at-once 20-year scope with a shorter vertical-slice scenario if evidence shows onboarding or balance risk;
- compare carbon-cap contracts without choosing prematurely: pre-commit cost reservation, operational reserve, soft overage with an explicit gate/penalty, or run termination;
- separate `grid_import_kWh`, `onsite_fossil_kWh`, and `solar_kWh`, or remove/rename the fossil primitive if a claim-safe factor and distinct decision cannot be justified;
- compare six-family-plus-policy against seven placed primitives using distinct-decision, onboarding-time, ledger-clarity and demo-narrative tests;
- keep the isolated fixed-step core but replace the acceptance oracle with canonical complete-state serialization and a tick-stamped action receipt;
- either enforce road/frontage connectivity after every action or cut road removal from P0; either implement local environmental fields or relabel/cut the claimed spatial mechanic;
- define one typed action quotation used by preview and commit so money/activity/factor/ledger deltas reconcile exactly;
- make responsive, zoomable, semantic keyboard/touch controls a release gate before new visual features;
- keep onboarding and a small awareness pilot in the local P0 slice, while deferring leaderboard/backend if it would block a reliable offline run.

## Normalized direction
- Outcome: an evidence-backed red-team diagnosis and a revised, buildable product/technical design that identifies what to keep, cut, fix, or defer before any implementation begins.
- Deliverables after approved research:
  1. current-code adversarial audit with severity, file/line evidence, reproduction, and missing-test inventory;
  2. verified OpenFront/WarFront lineage and transferable-pattern analysis;
  3. production city-builder/tycoon mechanics and operating-practice module map;
  4. carbon-accounting/game-mechanic integrity report;
  5. browser architecture, performance, deployment, save/replay, leaderboard, and mobile risk report;
  6. modelling/rendering/art-asset pipeline report;
  7. UI/UX/onboarding/accessibility/user-test report;
  8. `adopt / adapt / reject / defer` decision matrix split into hackathon P0, P1, and post-hackathon;
  9. a separately versioned synthesized design `DS@v2` and, only after approval, an implementation plan.
- Included research boundary: current tracked code/docs, non-mutating diagnostic commands, primary-source web/GitHub research, selected scholarly and industry evidence, licensing and asset provenance, comparable product workflows.
- Excluded before `DS@v2` approval: tracked code edits, scaffolding, dependency changes, asset imports, backend provisioning, deployment, submissions, purchases, outreach, or claims that tests/devices were passed when not run.
- Done signal for research: every material recommendation has a re-findable source or local code locator, confidence/evidence tag, transfer limit, implementation cost, and explicit `keep/cut/fix/defer` implication; contradictions and unknowns remain visible.
- Open item: `reversible assumption` — retain the current approved 3D/R3F design as the audit baseline, while allowing research to recommend a versioned change rather than silently changing it.

### Canonical skeleton
> Audit the existing 3D browser city-tycoon against its carbon-learning goal and hackathon constraints; preserve unaffected design decisions, explicitly reopen the contradicted carbon-cap/G-gate, power-factor, and primitive-status fields; independently research production mechanics, architecture, operations, carbon integrity, rendering/modelling and UI/UX; then synthesize only evidence-backed, licence-safe `keep/cut/fix/defer` deltas into DS@v2 without implementation before exact approval.

## Project-local authority and gates

| Gate/rule | Exact criterion | Current state | Authority locator |
|---|---|---|---|
| Event outcome | Prototype must report Carbon Emission Factor as a final outcome | confirmed locally | supplied OT PDF p.4 and foundation packet |
| Product design | 3D/R3F, fixed run, dual budget, carbon ledgers, current primitive baseline | locally recorded as user-approved | `docs/superpowers/specs/2026-08-11-net-zero-city-tycoon-design.md` |
| Team PRD | zero-install, play-first carbon learning, transparent factors, P0/P1 bounds | draft, not proof of completion | `docs/PRD.md` v0.1 |
| Current code | code exists through `da8f349`; main includes PRD commit `0b23005` | presence confirmed; correctness untested in this intake | git history and `app/package.json` |
| Research gate | SK@v4 exact approval required before broad local audit/external research | pending | this artifact |
| Design gate | DS@v2 exact approval required before implementation planning | not created | future synthesis |
| Implementation gate | approved DS@v2 + written plan + explicit authorization | not authorized | future approval receipt |

## Research questions
1. What does the current code actually implement, and which acceptance claims must be fixed, cut, relabelled or deferred?
2. Which OpenFront/WarFront architecture patterns transfer from a source-derived rewrite without copying code/assets/branding or claiming an exact fork delta?
3. Which production mechanics are useful in a deterministic 10–13 minute educational run, and which long-simulation systems must be cut?
4. Should waste be a seventh placed facility, a policy or a staged mechanic, and what minimum catalog passes the five-gate distinct-decision test?
5. Which carbon-cap contract is truly hard, understandable and compatible with unavoidable tick emissions; what must `G`, K and end conditions test?
6. How should external-grid, on-site fossil and solar activity be provenance-separated, and what exact factor/proxy is claim-safe for each?
7. How should population, housing, mobility, exposure and score be assigned/aggregated so demolition, one-building and last-tick exploits fail?
8. Which P0 spatial invariants remain: local UHI, road connectivity/frontage, road removal and upgrade embodied carbon; which should be cut rather than faked?
9. What canonical state/action receipt proves deterministic equality and supports later replay without pretending a client hash is authoritative?
10. Which browser/game modules are justified now: action quotation, fixed-step bridge, save schema, replay, Worker threshold, telemetry, error capture and asset pipeline?
11. What rendering/model/lighting/camera/animation/LOD/instancing approach provides modern legibility and measured Safari performance with legal assets?
12. What responsive UI/UX achieves first action under 60 seconds, keyboard/touch parity, non-colour validity, zoom/reflow and a persuasive reconciled result?
13. What must be P0, P1 or post-hackathon, and which recorded tests define the cut line?

## Research manifest

All lanes are read-only, own no shared source edits, and return evidence rows plus a bounded report. They stop when their questions are answered or their bound is exhausted; they escalate on authority conflict, an exact contradiction to the frozen baseline, licence uncertainty that changes reuse, scope overlap, or implementation pressure.

| Lane | Exclusive ownership | Allowed sources and bound | Explicit exclusions | Output |
|---|---|---|---|---|
| `LA-CODE` | Full adversarial audit of `main@0b23005`: architecture, spec drift, deterministic simulation, tests, carbon math, UX state, performance hazards, security/data handling | all tracked `app/` and current design/PRD; at most two complete audit passes; native test/typecheck/build only without changing dependencies/tracked files | no fixes, installs, asset changes, deployment, or external product research | severity-ranked findings with file:line, reproduction/logic trace, test gap, and keep/fix/cut/defer |
| `LR-LINEAGE` | OpenFrontIO/WarFrontIO lineage, fork delta, licence/assets/closed-service boundary, transferable browser-game patterns | pinned Git history/source, licences, official docs/releases; ≤6 repos and ≤30 material locators | no city-mechanic synthesis, no copying | verified lineage graph + adopt/adapt/reject patterns |
| `LR-GAME` | Production city-builder/tycoon mechanics, scoring, onboarding, pacing, objectives, progression, balance and anti-dominant-strategy patterns | official manuals/docs/source/postmortems plus scoped scholarly/industry material; ≤12 games/projects and ≤35 material locators | no engine winner, no carbon factor validation | mechanic/module matrix, primitive test, hackathon transfer limits |
| `LR-CARBON` | Carbon-system correctness and educational serious-game evidence | TGO/GHG Protocol/GPC/IPCC/EN-related primary guidance already licensed/available plus ≤20 primary or peer-reviewed locators | no broad game architecture or UI implementation | boundary/unit audit criteria, factor/ledger/scoring risks, claim-safe recommendations |
| `LR-WEBOPS` | Browser architecture, performance, mobile Safari, static/offline deploy, save/replay, basic leaderboard validation, observability and release operations | official Three/R3F/Vite/browser/standards/platform docs and proven OSS patterns; ≤30 locators | no art-direction decision or source edits | capability/risk matrix, P0 operational checklist, benchmark plan |
| `LR-ART` | 3D modelling/rendering/art direction: procedural vs modular assets, silhouettes, camera, lighting, animation, instancing/LOD, compression, provenance | official engine/tool docs, primary asset licences, production talks/case studies; ≤25 locators and ≤8 asset/tool families | no asset download/import, no gameplay rule changes | art bible skeleton, legal asset matrix, performance budgets, production pipeline |
| `LR-UX` | City-builder UI/UX, first-minute onboarding, information hierarchy, causal feedback, touch, accessibility, usability/pilot method | official accessibility standards/guidelines, primary UX talks/docs, scoped HCI/game studies; ≤25 locators | no visual asset selection or score-formula validation | journey/interaction audit rubric, HUD/control recommendations, test protocol |
| `LR-PRODOPS` | Production game operating model: content/data versioning, balancing workflow, telemetry events, feature flags, crash/error handling, QA matrix, releases and rollback | official platform/vendor docs, credible postmortems and mature OSS processes; ≤25 locators | no hosted-service purchase/provisioning | minimal hackathon ops model vs post-hackathon model |

### Common lane output schema
- owned questions answered / unanswered;
- material claim ledger row: claim ID, affected skeleton field, finding, one allowed evidence tag, source locator/date, exact scope match, implication, proposed delta;
- source-quality and licence/provenance note;
- transfer decision: `adopt`, `adapt`, `reject`, or `defer`;
- placement: `P0 hackathon`, `P1 after core`, or `post-hackathon`;
- estimated implementation surface and validation needed;
- contradictions/unknowns and stop reason.

## Revision lane state
- `LA-CODE`: complete/stopped at the two-pass bound; facts and positive controls retained; affected recommendations remain quarantined until SK@v5.
- `LR-CARBON`: stopped after contradiction capture; resumes only under approved SK@v5 to compare cap semantics, supply provenance, factors and accounting invariants.
- `LR-GAME`: generic report complete; exact catalog/power/score/current-project synthesis remains paused until SK@v5.
- `LR-UX`: generic/accessibility evidence may be retained; affected carbon-report and local remediation synthesis is quarantined until SK@v5.
- `LR-LINEAGE`: source-derived rewrite terminology is frozen; architecture/legal analysis may finish without an exact base-commit delta.
- `LR-WEBOPS`, `LR-ART`, `LR-PRODOPS`: retained/continuing because their frozen inputs do not depend on contradicted carbon/game rules.
- No affected result may satisfy a design gate until revision approval.

## Initial evidence ledger

| Claim ID | Affected field | Finding | Evidence tag | Source locator/date | Scope match | Implication | Proposed delta |
|---|---|---|---|---|---|---|---|
| C-LOCAL-01 | Authority | No project `AGENTS.md` was found; current spec and user request are nearest local authorities | `directly_supported` | bounded local intake, 2026-08-11 | exact repository | use approved spec as frozen baseline | none |
| C-LOCAL-02 | Current stack | `app/package.json` declares Vite, React 19, Three/R3F, Zustand, TypeScript, Vitest | `directly_supported` | `app/package.json`, 2026-08-11 | exact code baseline | confirms audit stack, not runtime quality | none |
| C-LOCAL-03 | Implementation presence | git history shows simulation/render/UI work through `da8f349`; main is `0b23005` | `directly_supported` | local git log, 2026-08-11 | exact checkout | audit current main rather than assume PRD status | none |
| C-LOCAL-04 | Test status | dependencies are not installed in this checkout and no test/build/device result was executed during intake | `directly_supported` | local filesystem intake, 2026-08-11 | exact checkout | all quality and device claims remain unverified | audit after approval; do not claim pass |
| C-LOCAL-05 | Fork premise | supplied URL identifies a WarFrontIO organization, not an exact repository/commit lineage | `insufficient` | user request + no external lookup yet, 2026-08-11 | exact wording only | verify before using the analogy as evidence | LR-LINEAGE |
| C-LOCAL-06 | Design completeness | local approved spec and PRD contain a broad P0 that may exceed hackathon capacity | `insufficient` | local docs only, 2026-08-11 | no implementation/runtime audit yet | adversarial scope review required | LA-CODE + synthesis |
| C-CONTRA-01 | D2/D10 carbon cap and G gate | Pre-action gross checks can overshoot and ticks continue emitting, while G tests population only | `contradicts_premise` | `simulation.ts:39-60,96-103,130-174`; `score.ts:58-61`; design §5:137, 2026-08-11 | exact code/design | current run may exceed budget and still score | reopen cap/G contract; add invariant options to LR-CARBON/LR-GAME |
| C-CONTRA-02 | D11 power/factor boundary | External grid and on-site fossil supply are pooled and both charged with TGO purchased-grid Scope 2 EF | `contradicts_premise` | `power.ts:12-25`; `simulation.ts:136-139`; `factors.ts:23-33`, 2026-08-11 | exact code/factor | EF report and K can mislabel fossil activity | provenance split; exact factor/proxy research |
| C-CONTRA-03 | D11/D17 primitive baseline | Design says six plus policy and also treatment primitive; code exposes seven placed primitives | `contradicts_premise` | design D11/D17/§3; `types.ts:2`; `buildings.ts:9-16`; `ruleset.ts:104-106`, 2026-08-11 | exact design/code | count, palette and P0 scope are unresolved | test both models; no silent normalization |
| C-CONTRA-04 | FR-03/07 action/carbon truth | Expansion preview is 1000× low; HVAC/AD omit upfront carbon; factor values duplicate/disagree; report omits boundary/activity bridge | `contradicts_premise` | LA-CODE P0-03–06/P1-01, exact file locators, 2026-08-11 | exact current code/PRD | core learning and EF result are materially false/incomplete | typed quote→commit and reconciliation questions reopened |
| C-CONTRA-05 | D13/D15 spatial rules | Local UHI is global; road removal can break seed/network/frontage while access ignores roads | `contradicts_premise` | LA-CODE P0-07/P0-09, 2026-08-11 | exact current code/design | placement causality and road primitive meaning are false | fix/cut/relabel options added |
| C-CONTRA-06 | FR-05 determinism | State hash omits seed/grid/material state and can alias distinct runs | `contradicts_premise` | `simulation.ts:262-283`; tests `:34-43`, 2026-08-11 | exact receipt/tests | current determinism oracle cannot certify equality | canonical state/action receipt research |
| C-CONTRA-07 | D10 viability/score | Population may survive housing removal; nominal residence weights citywide mobility; expansion weighting is omitted | `contradicts_premise` | population/transport/simulation/score paths, 2026-08-11 | exact current code | gate/categories are exploitable | assignment/aggregation reopened |
| C-CONTRA-08 | D7/D14/D18 accessibility | Zoom disabled; no keyboard grid target; colour-only validity; dashboard lacks touch path | `contradicts_premise` | local UI + W3C ACT/WCAG 1.4.1/1.4.4/2.1.1, 2026-08-11 | exact code and official criteria | mobile/accessibility acceptance is not met | P0 responsive semantic input gate |
| C-CONTRA-09 | OpenFront analogy | Not a Git fork/shared history; exact evidence supports a source-derived rewrite with unavailable base commit | `contradicts_premise` | GitHub metadata/root commit/initial files, 2026-08-11 | exact lineage | no exact fork-delta audit | correct terminology; patterns only |
| C-LEGAL-01 | D18 asset distribution | Fluent SVGs match MIT upstream but checkout lacks the required retained notice | `directly_supported` | LR-ART pinned commit + local inventory, 2026-08-11 | exact files/licence | public distribution gate remains | third-party notice/provenance artifact later |
| C-AUDIT-01 | Acceptance readiness | Onboarding/survey/submission absent; current test/build/browser/device result unavailable; remaining defects in LA-CODE report | `directly_supported` | complete tracked audit, 2026-08-11 | exact checkout | PRD P0 must be recut and validated | synthesize explicit P0/P1 cuts after revision |

## Contradiction and revision protocol
- Current state: `REVISION_REQUIRED(SK@v4 → SK@v5)`.
- Revision-driving fields: D2 carbon constraint; D10 viability/G/K/aggregation; D11 power and D11/D17 catalog; D13 local environmental/upgrade-carbon; D15 road invariants; D7/D14/D18 accessibility; FR-03/05/07 quote, receipt and reconciliation; exact OpenFront lineage terminology.
- Downstream dependencies: action validation/quotation, tick/end semantics, score, activity/factor ledgers, EF result, population/transport assignment, road/local placement, replay, build palette, onboarding and device acceptance.
- Paused work: LR-CARBON; affected LA-CODE/LR-GAME/LR-UX recommendations; all affected root synthesis and gate evaluation.
- Unaffected results retained: completed generic production evidence, source-lineage architecture/legal facts, browser operations, art, production operations and verified code positive controls.
- No `DS@v2` exists; affected fields of the existing local design are invalidated pending revision.
- Ordinary code defects that do not change purpose remain audit findings and do not independently force another skeleton version.

## Field-level diff from SK@v4
| Field | SK@v4 | SK@v5 |
|---|---|---|
| OpenFront premise | exact fork/evolution unresolved | source-derived rewrite confirmed; no public shared ancestry/base commit |
| Current quality premise | broad adversarial audit planned | not acceptance-ready; completed 27-finding static audit and explicit positive controls retained |
| D2 carbon constraint | hard budget treated as frozen baseline | strategic carbon constraint retained; exact enforceable contract reopened |
| D10 scoring/viability | equal A/H/Q/M/K and G audited as a frozen rule | G/K, temporal aggregation and population/housing/mobility assignment reopened |
| D11 power | fossil/solar audited under existing factor model | grid/fossil/solar provenance and factor rules must separate or primitive changes |
| D11/D17 catalog | “six plus treatment/policy/upgrade” frozen wording | exact six-vs-seven and waste status reopened under distinct-decision test |
| D13/D15 spatial rules | local UHI and connected roads treated as baseline | fix/cut/relabel local UHI, road graph/frontage and road removal |
| FR-03/05/07 | quote, determinism and EF result to be audited | typed quote→commit, complete-state/action receipt and activity/factor reconciliation required |
| D7/D14/D18 | mobile Safari/accessibility target | target retained, current implementation contradicted; P0 responsive semantic parity gate added |
| Asset/legal | provenance to audit | Fluent upstream verified; missing tracked MIT notice is a distribution blocker |
| Research lanes | all active | affected work stopped/quarantined; unaffected completed/continuing results retained; targeted resumption after approval |
| Implementation | prohibited | unchanged: prohibited |

## Approval ledger

| Artifact | Decision/scope | Approving authority | Message locator | Date | Status |
|---|---|---|---|---|---|
| Existing local design spec | decisions D1–D18; affected D2/D10/D11/D13/D15/D17 and acceptance-contract fields now invalidated pending revision | user, per artifact | design header/decision log | 2026-08-11 | `PARTIALLY_INVALIDATED` |
| `SK@v4` / `sha256:3718d379796737fae25330ef7feec4fd258cfe80effb22ca44495c96c1aa0c18` | original bounded read-only research | user | message `460d3d3a` | 2026-08-11 | `APPROVED; SUPERSEDED FOR AFFECTED FIELDS` |
| `SK@v5` / this artifact | revised frozen inputs; resume affected read-only lanes; retain unaffected results | user | pending | pending | `PENDING` |
| `DS@v2` | design approval for implementation planning | user | pending | pending | `PENDING` |
| implementation authorization | approved plan and scoped tracked-file changes | user | pending | pending | `PENDING` |

## Synthesis contract
- Root will validate and deduplicate lane evidence rather than concatenate reports.
- Affected fields cannot be synthesized until SK@v5 is approved and targeted lanes resume.
- Every recommendation will state evidence/unknown, product benefit, cost, licence/asset boundary, hackathon tier and validation criterion.
- `DS@v2` will choose or preserve explicit alternatives for carbon-cap enforcement, G/K/viability aggregation, supply provenance/factors, waste primitive status, local UHI/road scope and quote/receipt/reconciliation invariants, with a field-level diff against the prior design.
- `DS@v2` will include a sharply reduced P0 vertical slice, the primitive/module cut, reference architecture, responsive accessible UI, art/legal system, operations model and staged implementation scope.
- Every retained acceptance claim will name a recorded oracle; absence of a build/device/user result remains `insufficient`.
- Research may recommend a change but may not silently edit an approved decision or implementation.

## Next action
- Current state: `SKELETON_APPROVAL_PENDING(SK@v5)` during `REVISION_REQUIRED(SK@v4 → SK@v5)`.
- Requested approval scope: retain unaffected SK@v4 lane results and authorize targeted read-only resumption for the revised D2/D10/D11/D13/D15/D17, FR-03/05/07 and accessibility questions under SK@v5.
- Still prohibited: tracked code changes, installs, assets, prototypes, deployment, provisioning and implementation.
- Next checkpoint: user explicitly approves SK@v5 by exact version/fingerprint; then only affected lanes are redispatched/resumed.
w