# Task Plan: Net-Zero earn-to-voucher BM loop

## Goal
Make the existing Thai MVP visibly demonstrate how a user starting at 0 points completes the three approved activities (public transit, recycling, tree planting), passes verification, earns points, exchanges those points for a voucher, and uses the voucher—without weakening the existing mock-demo, evidence, ledger, or production-readiness boundaries.

## Workflow State
`REVISION_REQUIRED(previous visual direction superseded by user)`

## Current Phase
Paused after Phase 4 first pass

## Phases

### Phase 1: Authority and intake
- [x] Read bounded canonical project requirements and current approval records
- [x] Normalize requested outcome, scope, assumptions, and done signal
- [x] Identify the exact approved acceptance criteria governing the BM loop
- **Status:** complete

### Phase 2: Existing approval reconciliation
- [x] Confirm the requested flow is already covered by approved AC-17 and the original demo AC-21
- [x] Confirm the approved stage-05 plan explicitly says no repeated approval is required for executor work
- **Status:** complete

### Phase 3: Current implementation audit and delta
- [x] Inspect the current point, claim, voucher, seed, and UI contracts within approved scope
- [x] Determine the smallest implementation delta that makes the approved BM loop visible and runnable
- [x] Record the evidence ledger and exact files/tests to change
- **Status:** complete

### Phase 4: Implementation
- [ ] Implement the approved minimal BM loop without altering locked scoring/verification semantics
- [ ] Add or update focused tests
- **Status:** paused; functional changes preserved, presentation-style UI rejected

### Phase 5: Verification and Codex handoff
- [ ] Run targeted tests, typecheck, build, and relevant E2E
- [ ] Demonstrate 0 points → three activities → points → voucher issue → voucher use in Codex
- [ ] Leave the verified flow open and report exact remaining limitations
- **Status:** pending

## Constraints
- Preserve the existing three MVP activities and their verification state machines.
- Preserve point/carbon ledgers, idempotency, voucher lifecycle, Thai-first UI, and mock-demo/production separation.
- Do not invent or silently change point values before current authority is inspected and an identified design is approved.
- No external research is needed unless an approved skeleton exposes a specific unresolved BM question.
- Do not modify product code before the required skeleton and synthesized-design approval receipts exist.

## Approval authority reused
- Deep-interview spec status: `PASSED`; original acceptance criterion 21 requires all three claim flows, carbon/points update, one-time voucher redemption, dashboard, and leaderboard.
- Stage-05 plan: Architect `CLEAR/APPROVE`, Critic `OKAY`, and explicit execution authorization through Ultragoal.
- Stage-05 AC-17 requires a deterministic complete mock-only demo with real core state machines, ledgers, and voucher logic.
- The current user request asks to expose or complete that already-approved flow; it does not change the locked formula, oracle, trust scope, architecture, or non-goals.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| None | - | - |
