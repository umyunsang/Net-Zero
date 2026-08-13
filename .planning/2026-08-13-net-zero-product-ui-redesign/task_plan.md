# Task Plan: Net-Zero consumer product UI redesign

## Goal
Replace the presentation/deck-like frontend with a consumer-facing Thai product experience. Preserve the proven activity-to-points-to-voucher business loop while hiding internal architecture, requirements, governance, and demo-operation details from ordinary users.

## Workflow State
`IMPLEMENTATION_AUTHORIZED(DS@v1)`

## Current Phase
Phase 3

## Phases

### Phase 1: Bounded redesign discovery
- [x] Inspect the supplied PPT for brand, audience, product promise, and essential product nouns only
- [x] Inspect the current visible product surface and frontend structure for the rejected presentation patterns
- [x] Separate consumer content from privileged operator/reviewer/admin content
- **Status:** complete

### Phase 2: Product skeleton and design approval
- [x] Propose 2-3 product information-architecture approaches with trade-offs
- [x] Present recommended `SK@v1` with screens, user flow, disclosure boundary, and visual direction
- [x] Obtain exact user approval for `SK@v1`
- [x] Generate the complete desktop/mobile concept set
- [x] Obtain exact design approval for `DS@v1`
- **Status:** complete

## Approval artifact
- `SK@v1`: `.planning/2026-08-13-net-zero-product-ui-redesign/skeleton_SK_v1.md`
- SHA-256: `e655a489249628ec64c1b5a0947df01270122ee0e50e05d891a5696b32dcc8ca`
- Scope requested: concept generation and `DS@v1` preparation only; no product-code change.
- Approval receipt: `.planning/2026-08-13-net-zero-product-ui-redesign/approval_receipts.md`
- Research manifest result: no external or deep-research lanes required; supplied PPT, live UI, current source, and locked product contracts already answer the bounded design questions.

## Design artifact
- `DS@v1`: `.planning/2026-08-13-net-zero-product-ui-redesign/design_DS_v1.md`
- SHA-256: `6607e306dcb68870a5e892b69073216342a8f979e78ca47aeeabe2c78e478f13`
- Base: approved `SK@v1`
- Scope requested: implementation planning only; no deployment or external action.

### Phase 3: Implementation plan and redesign
- [x] Write the approved design specification and implementation plan
- [ ] Implement the consumer product shell and role-specific surfaces without changing ledger or voucher semantics
- [ ] Remove or relocate presentation/internal-design content from end-user screens
- **Status:** in_progress

## Implementation artifact
- `IP@v1`: `.planning/2026-08-13-net-zero-product-ui-redesign/implementation_plan_v1.md`
- Base: approved `DS@v1`
- Authorization basis: the original user request explicitly requested modification/development, and exact `DS@v1` approval completed the final design gate. No deployment or external action is included.

### Phase 4: Verification and Codex rendering
- [ ] Run focused tests, typecheck, build, and E2E
- [ ] Verify the complete 0-point to voucher-use flow on desktop and mobile
- [ ] Compare accepted concepts and browser renders with `view_image`
- [ ] Leave the verified consumer product open in the in-app browser
- **Status:** pending

## Constraints
- Do not use the PPT as a page-layout or typography template.
- Preserve the three MVP activities, scoring rules, verification state machines, point ledger, voucher lifecycle, Thai-first UI, and mock-demo/production separation.
- Ordinary users must not see internal requirements, architecture, factor identifiers, fixture/correlation identifiers, RBAC terminology, or implementation disclaimers.
- Necessary consumer trust disclosures must remain short, contextual, and human-readable.
- Do not modify product code until the user approves the product skeleton and generated design concept.

## Superseded direction
- The previously implemented presentation-style BM journey is retained only as current-state evidence. Its visual hierarchy, narrative panels, and internal-facing copy are no longer approved design authority.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Existing browser tab could not be attached with `iab.tabs.claim`; that method is not part of the current browser API | 1 | Resolved with the current `iab.user.claimTab` method; no application state changed |
| Browser screenshot paths were not visible to the image-inspection tool in either browser `/tmp` or the nominal shared visualization path | 2 | Stop repeating path-based transfer; emit the screenshot directly for current visual inspection and revisit shared-file transfer only during approved implementation QA |
| Two read-only automation clicks on the current `บันทึก` navigation control did not change the rendered page despite an exact single locator | 2 | Stop repeating the browser interaction during discovery; inspect the bounded `Actions` source instead and re-test navigation after an approved redesign |
| First Image Gen call passed `num_last_images_to_include: 0`, but the API accepts only 1–5 when the field is present | 1 | Omit the field entirely for the brand-new Home concept, as required by the tool contract |
| `view_image(original)` returned only a narrow top strip for the full-height generated Home PNG | 1 | Produce a downscaled inspection derivative outside product code and inspect that file before design approval |
| Inspecting both large concept contact sheets in one tool call exceeded the available output context | 1 | Inspect the mobile and desktop review sheets in separate calls; the seven standalone concepts were already verified |
| First attempt to append the contact-sheet QA note used a stale progress anchor | 1 | Read the current file tails and patch against the live `Errors Encountered` and progress sections |
| First findings update used a non-existent end-of-file anchor | 1 | Read the current findings tail and append after the live DS self-review conclusion |
| `git status --short` could not run because `/Users/um-yunsang/Net-Zero` is not a Git repository | 1 | Keep the scope claim limited to this turn's tool record: only planning artifacts and concept-review files were written; no product source was edited |
