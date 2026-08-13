# Findings & Decisions

## Requirements
- Source: `/tmp/deep-interview-net-zero-thailand-rewards.md`
- Deliverable: one existing Google Doc containing a Korean PRD and a Thai PRD
- Target: Google Doc ID `12By7hZepMf-odsEqBl0bEcUBSdWWtxJZ2hGC1nUKi0Y`
- Preserve sharing state, file organization, and unrelated existing content unless the target proves blank
- Treat confirmed interview decisions separately from assumptions, open issues, and later-phase scope

## Research Findings
- Interview metadata: 21 rounds, final ambiguity 2.3%, status `PASSED`, no auto-researched or auto-answered rounds, no disputed established facts, and closure audit `READY` across six components.
- Functional MVP boundary: bus, recycling, tree verification; carbon/points ledger; voucher redemption; impact dashboard/community/leaderboard. Core logic is real; only external services and clearly labeled demo data may be mocked.
- Carbon claims must remain `TGO-informed consumer estimates`; avoided CO2e and projected one-year sequestration stay separate and neither is a carbon credit, offset, or TGO-certified result.
- Target Google Doc is a native, multi-tab document with four existing top-level tabs: the initial tab, `Pitching`, `Requirement`, and `Feedback`.
- Existing tabs contain prior project material and must remain unchanged. The safest requested structure is two new top-level tabs: `PRD (한국어)` and `PRD (ไทย)`.
- Google Docs mode is `in-place` on an explicitly targeted working document. Existing tabs receive structural treatment `retain` and content treatment `carry current content`; the two requested PRD tabs receive `add` plus source-grounded content.
- The initial full document topology is recorded. Before the first write, the required file-backed trusted read must be run without a tab filter so protected controls across the multi-tab document are visible.
- Write batches will use a fresh revision guard, add the two tabs, re-read their generated tab IDs, then insert and style content in tab-scoped batches.
- A final deliverable requires connector readback plus PDF export/raster inspection when available; PDF checks layout, while source-to-section reconciliation checks completeness.
- The target already contains hackathon requirements stating a prototype and presentation are mandatory and carbon emission factors must be reported as final outcomes; this aligns with the interview's auditable factor ledger.
- Bus oracle: target sample every 30 seconds; valid GPS coverage >=80%; >=80% non-stop-geofence speed windows within 20-40 km/h; >=80% detected stop pairs spaced 300-500 m; >=80% valid points in versioned route corridor; all metrics must pass.
- Claim states are `pending`, `verified`, and `rejected`; only verified claims create one immutable ledger credit. Retries and replays are idempotent.
- Recycling requires one-time QR session, in-app photo, duplicate screening, one credited claim per user/bin/day, and authorized reviewer approval or downward correction before carbon/points.
- Tree verification uses in-app photo, GPS/time, versioned AI threshold and cross-account fingerprint. GPS <=5 m plus visual similarity >=90% is duplicate/rejected; a single matching signal routes to manual review.
- One verified tree claim uses a versioned one-year proxy of 9.5 kgCO2e/tree/year, awarded once without survival or credit claim.
- Points formulas: avoided `min(100, floor(kgCO2e / 0.1))`; projected `min(100, floor((kgCO2e / 0.1) * 0.25))`.
- Voucher lifecycle: atomic issue/deduct; states issued/redeemed/expired/cancelled; 7-day expiry; atomic and idempotent redemption; refund only on pre-use cancellation, not expiry.
- Leaderboard: opt-in pseudonyms; Monday 00:00 Asia/Bangkok weekly boundary; verified weekly points only; demo accounts excluded; opt-out removes current/future listing while anonymous totals remain.
- Raw GPS/photos retained for 30 days after decision and deleted immediately on account deletion; only non-reversible fingerprints and anonymized audit/ledger records remain.
- Source technical context explicitly marks the project greenfield and technology stack undecided. PRD must remain implementation-neutral while defining invariants and external boundaries.
- TGO source URLs and version/effective-date pinning are part of every immutable calculation record; factor changes must not rewrite historical ledger entries.
- The `/tmp` source and canonical `.gjc` spec are byte-identical at SHA-256 `8259eb547bafa1b7161fb9f0dac5634f2a921dfeb36b1ef47f590f59c8801697`.
- Source approval status permits no product source edit, implementation-worker invocation, commit, push, or deploy. The current request authorizes only PRD synthesis and writing to the identified Google Doc, so no implementation activity is in scope.
- The source includes 21 acceptance checks covering real core state machines, 80% bus boundaries, reviewer-gated recycling, AI/manual tree outcomes, immutable ledger reproducibility, point caps, atomic voucher transitions, leaderboard/privacy behavior, retention, disclosures, and end-to-end demo coverage.
- Technology selection remains explicitly open; the PRD must define domain states, records, workflows, and integration boundaries without selecting a stack.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Existing-document native edit route | User supplied an existing Google Doc, so direct Google Docs update and readback are required |
| No external product research unless a source gap is material | The interview record is the requested authority; unverified facts should remain assumptions/open issues |
| Add two new PRD tabs instead of replacing existing content | Preserves all existing tabs and makes the two requested language versions independently navigable |
| Treat current user message as authorization for document synthesis only | It identifies the exact source and target but does not authorize product implementation, Git, or deployment |
| Shared PRD skeleton | Title/status; executive summary; problem; goals/success; scope; users/roles; end-to-end flows; detailed functional requirements; data/audit model; integrations/mock boundary; surfaces; nonfunctional requirements; acceptance criteria; demo scenario; non-goals; roadmap; risks/mitigations; open implementation decisions and sources |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Current workspace is not a Git repository and contains no product files outside `.gjc` | Keep product code untouched and use only task-local `.planning` artifacts |
| Initial phase-status patch failed because a context line belonged to `findings.md`, not `task_plan.md` | Re-read the live task plan and issued a corrected patch |

## Resources
- Korean draft: `.planning/2026-08-12-net-zero-thailand-rewards-prd/prd-ko.md`
- Thai draft: `.planning/2026-08-12-net-zero-thailand-rewards-prd/prd-th.md`
- Four supplied TGO reference labels are preserved for hyperlinking after live document insertion.
