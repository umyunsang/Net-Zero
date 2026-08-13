# Implementation Plan v1 — DS@v1 consumer wallet

## Authority
- Approved design: `DS@v1`
- Design SHA-256: `6607e306dcb68870a5e892b69073216342a8f979e78ca47aeeabe2c78e478f13`
- Approval message: `DS@v1 승인`
- User outcome already requested: replace the presentation/internal-document frontend with the approved consumer product and verify it in Codex rendering.
- Excluded: backend/scoring/ledger/voucher semantic changes, deployment, production credentials, and external partner/payment work.

## Target flow
`consumer entry → 0-point Home → choose one activity → submit → pending/history → verified 23 points → exchange 20-point reward → 3 points + active voucher → merchant redeem → used voucher`

## Write ownership

### Shared product foundation
- `apps/web/src/product-types.ts`: shared role, claim, dashboard, reward, voucher, factor, and leaderboard response types.
- `apps/web/src/api.ts`: token-aware API calls, Thai error mapping, idempotency key, evidence upload/open helpers, and synthetic demo capture implementation.
- `apps/web/src/ui.tsx`: semantic form/notice primitives, brand mark, and production-quality local SVG icon family.

### Consumer product
- `apps/web/src/consumer/ConsumerApp.tsx`: four-job shell and consumer-owned Home, Activity hub/detail, History, Wallet/Voucher, and Profile screens.
- Consumer screens may show points, costs, remaining points, review states, timestamps, consumer reasons, expiry, one-use rule, and concise demo disclosure.
- Consumer screens must not render raw data scope, fixture/factor/evidence IDs, methodology codes, endpoint/atomicity/RBAC language, GPS heuristics, provider internals, or operator instructions.

### Operational product
- `apps/web/src/operations/OperationsApp.tsx`: reviewer, merchant, and admin workspaces copied from the current behavior and isolated from the consumer shell.
- Operational workflows keep their current privileged evidence, factor, readiness, scan, cancel, and decision controls.

### Composition and visual system
- `apps/web/src/App.tsx`: session/role composition only, including consumer-first entry and role switching delegated from Profile.
- `apps/web/src/styles.css`: replace presentation/dashboard CSS with DS tokens, true-white shell, mobile bottom navigation, desktop rail, focused task forms, reward cards, ticket states, and separate utility styles.
- Add a QR dependency only if needed to render an actual code-derived QR; no remote runtime asset/CDN.

### Verification contracts
- Update `apps/web/e2e/app.spec.ts` and `apps/web/e2e/device-gate.spec.ts` to approved Thai navigation/copy without weakening API assertions or role boundaries.
- Add consumer DOM assertions for prohibited internal terms.
- Preserve assertions for 0 points, 23→3 exchange, redeemed persistence, leaderboard consent, reviewer non-bypass, merchant single-use, Thai error mapping, and admin readiness separation.

## Execution order
1. Extract shared types/API/UI and create the consumer shell/screens.
2. Move privileged workspaces behind `OperationsApp`; reduce `App` to composition.
3. Replace the stylesheet and add any local/code-generated assets.
4. Update E2E locators and consumer disclosure assertions.
5. Run typecheck, build, focused web tests, then E2E on desktop and Pixel 7.
6. Use the in-app Browser first for desktop/mobile render and interaction QA.
7. Capture implementation screenshots outside the repository, inspect them with `view_image` beside the accepted concepts, write the fidelity ledger, fix drift, and leave the verified app open at `http://127.0.0.1:5173/`.

## Done signal
- All Phase 4 checks pass.
- The live consumer DOM contains none of the prohibited internal terms.
- The real local UI proves the complete business loop across mocked deterministic E2E states.
- Desktop and mobile renders are faithful to the accepted concepts with no material mismatch.
- Reviewer, merchant, and admin flows remain role-gated and their focused regression assertions pass.
