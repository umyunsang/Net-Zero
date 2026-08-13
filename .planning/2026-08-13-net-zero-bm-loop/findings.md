# Findings: Net-Zero earn-to-voucher BM loop

## Raw request
> 랜더링 확인했고 화면흐름, flow 도 확인했는데, 0점부터 시작해서 어떻게 점수를 모을 수 있는지(대중교통이용, 재활용품 배출, 나무심기 등등 mvp로 잡은 3가지 활동) 그리고 점수가 바우처랑 어떻게 연동이되고 사용이 가능하지 보여주면 좋겠어, 보여줄수 없으면 변경 수정개발을 진행해줘. 소프트웨어와 요구사항에만 너무 집중해서 bm 부분을 놓치고 간과한거 같아.

## Intake normalization (provisional until bounded authority read)
- Outcome: a visible, understandable, runnable earn-to-voucher loop starting from 0 points.
- Target/context: Thai hackathon MVP demo used by a general audience/judge, not a production service.
- Deliverable: current-flow demonstration if complete; otherwise an approved minimal frontend/data-flow change with tests and Codex render.
- Included: public transit, recycling, tree planting; verification outcome; point credit; voucher exchange; merchant use.
- Excluded: new external partner integration, payments, carbon credits, production deployment, or silent scoring-policy changes.
- Must: preserve mock/synthetic disclosure and real ledger/voucher semantics.
- Avoid: presenting an unverified action as credited or production-ready.
- Provisional premise: the current UI exposes components of the loop but does not narrate or let a viewer follow the full economic journey from 0 points.
- Candidate solutions: (A) guided BM journey layered over current real flows; (B) deterministic end-to-end demo scenario; (C) documentation-only explanation. No choice is locked yet.
- Done signal: a user can follow the three activities, see exactly when/why points are awarded, see balance changes, issue an affordable voucher, and observe its terminal used state.
- Open item: none; use the reversible assumption that the existing locked scoring policy remains unchanged.

## Memory-derived navigation hints
- Prior notes say the MVP contract includes verification state machines, separate point/carbon ledgers, voucher lifecycle, and demo separation; current files must be reopened before reuse.

## Current findings
- `directly_supported`: README defines the product as a mock/synthetic demo of activity recording, verification, calculation, point ledger, voucher logic, and dashboard—not a production or carbon-credit system.
- `directly_supported`: `pnpm demo:reset` is the canonical deterministic demo initializer and prepares reviewed fixtures for all three activities (`bus`, `recycling`, `tree`).
- `directly_supported`: architecture invariant 1 allows value only from `verified` claims and at most one positive credit per claim.
- `directly_supported`: point ledger is the audit source, while the balance row is the concurrency authority and both change in one transaction.
- `directly_supported`: voucher issue and point debit are atomic; redemption succeeds once; cancellation/refund and expiry follow the existing lifecycle.
- `directly_supported`: Thai-only product copy and explicit mock/demo, estimate, recycling-delivery, bus-heuristic, and one-year tree-projection labels are required. Carbon-credit, offset, real-activity proof, real partner, and payment claims are prohibited.
- `directly_supported`: the current UI exposes activity capture, claim review, balances, reward issue, and merchant redemption as separate screens, but the dashboard has no guided 0-point → activity → verification → points → voucher path.
- `directly_supported`: the 21-round deep-interview specification passed with 2.3% ambiguity and locks the full earn-to-voucher product loop.
- `directly_supported`: original acceptance criterion 21 requires the demo to show all three claim flows, carbon/points update, one-time voucher redemption, dashboard, and leaderboard.
- `directly_supported`: approved stage-05 AC-17 requires the same complete mock-only hackathon demo while keeping core ledger/voucher/RBAC/idempotency logic real.
- `directly_supported`: the stage-05 approval record is Architect `CLEAR/APPROVE`, Critic `OKAY`, with user execution authorization through Ultragoal and an explicit note that executor should not ask for approval again.
- Result: this request executes an identified approved plan rather than defining a new product skeleton. No additional external research or approval gate is needed before auditing and implementing the missing delta.
- `directly_supported`: reset starts every demo account at 0 points and seeds 20-point and 40-point rewards without seeding claims, carbon entries, point entries, or vouchers.
- `directly_supported`: the locked point rule is `floor(kgCO2e / 0.1)` for avoided impact and 25% of that rate for projected tree sequestration, capped at 100 per claim.
- `directly_supported`: one verified demo tree produces 9.5 kg projected one-year sequestration and 23 points, so it alone can unlock the 20-point reward and leave 3 points.
- `directly_supported`: 46 reviewer-approved demo PET bottles produce 20 points under the current factor; other materials or insufficient approval stay fail-closed.
- `directly_supported`: the current short synthetic bus route can verify but can round down to 0 points. The UI must explain this instead of implying every verified trip awards a positive integer.
- `directly_supported`: the rewards GET endpoint returns `status/title` while the frontend reads `state/titleThai/voucherId`; after a merchant redemption and user reload, the terminal voucher state cannot render reliably. The list response must reuse the issue response shape.
- Minimal approved delta: add a live BM journey to the dashboard using current dashboard/reward data; add live balance, affordability, point debit, merchant handoff, and terminal status explanation to rewards; add a merchant redemption receipt; normalize voucher list output; cover the 0-point, affordability, and redeemed-state surfaces with focused tests.

## Evidence ledger for implementation
- `apps/web/src/App.tsx`: dashboard/reward/merchant product flow and client data contracts.
- `apps/web/src/styles.css`: existing visual system; extend without redesign or new assets.
- `apps/web/e2e/app.spec.ts`: 0-point explanation, affordability gate, issue flow, and merchant terminal receipt.
- `apps/api/src/rewards/rewards.service.ts`: normalized persisted voucher representation.
- `apps/api/test/demo-separation/full-demo.test.ts`: real end-to-end persisted voucher state after redemption.
