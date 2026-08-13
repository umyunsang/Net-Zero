# Task Plan: Net-Zero consumer product UI redesign

## Goal
Replace the presentation/deck-like frontend with a consumer-facing Thai product experience. Preserve the proven activity-to-points-to-voucher business loop while hiding internal architecture, requirements, governance, and demo-operation details from ordinary users.

## Workflow State
`IMPLEMENTATION_AUTHORIZED(DS@v2_CARBON_IMPACT)`

## Current Phase
Phase 12

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
- [x] Implement the consumer product shell and role-specific surfaces without changing ledger or voucher semantics
- [x] Remove or relocate presentation/internal-design content from end-user screens
- **Status:** complete

## Implementation artifact
- `IP@v1`: `.planning/2026-08-13-net-zero-product-ui-redesign/implementation_plan_v1.md`
- Base: approved `DS@v1`
- Authorization basis: the original user request explicitly requested modification/development, and exact `DS@v1` approval completed the final design gate. No deployment or external action is included.

### Phase 4: Verification and Codex rendering
- [x] Refine consumer copy and type hierarchy from live user feedback
- [x] Run focused tests, typecheck, build, and E2E
- [x] Verify the complete 0-point to voucher-use flow on desktop and mobile
- [x] Compare accepted concepts and browser renders with `view_image`
- [x] Leave the verified consumer product open in the in-app browser
- **Status:** complete

### Phase 5: Presentation-speed activity completion
- [x] Confirm the current bus and recycling verification boundaries
- [x] Reduce demo bus recording to approximately 2–3 seconds and finish automatically
- [x] Auto-verify demo recycling submissions and reflect awarded points without reviewer action
- [x] Run static, unit, E2E, and in-app browser verification
- [x] Leave the verified fast demo flow open in the in-app browser
- **Status:** complete

### Phase 6: Demo reward policy, leaderboard, and live language switching
- [x] Confirm the current ledger, leaderboard, shell, and translation surfaces
- [x] Set mock-demo verified tree rewards to 15 points and bus rewards to 3 points without changing production carbon factors
- [x] Populate a pseudonymous mock leaderboard and make rankings directly visible to consumers
- [x] Add a persistent Thai, English, and Korean language selector to the global header
- [x] Translate consumer and privileged workspaces with immediate language switching
- [x] Restore the mobile header/bottom navigation and desktop sidebar/card composition from the seven user-approved reference renders
- [x] Run migration, static, unit, E2E, responsive, and in-app browser verification
- [x] Reset mock-demo state and leave the multilingual product open for presentation
- **Status:** complete

### Phase 7: DS@v1 fidelity correction and Open Design leaderboard
- [x] Record the user's rejection of the visually drifted implementation as superseding the prior Phase 6 visual sign-off
- [x] Reconfirm the exact `DS@v1` hash and all seven approved render files
- [x] Generate a polished cross-platform leaderboard prototype through Open Design from the confirmed brief
- [x] Integrate the Open Design leaderboard without adding a fifth primary navigation destination
- [x] Restore exact DS@v1 shell, token, spacing, card, and responsive composition where the current code drifted
- [x] Audit Thai, English, and Korean typography for font fallback, weight, hierarchy, line height, wrapping, and numeric emphasis
- [x] Rerun static, API, E2E, responsive, visual-fidelity, and in-app browser verification
- [x] Reset mock-demo state and leave the accepted Thai product open for presentation
- **Status:** complete

### Phase 8: Korean desktop wallet wrapping correction
- [x] Reproduce the user-reported Korean reward-card text collapse at the 1024 px desktop boundary
- [x] Replace the over-constrained reward-card grid with a width-safe responsive layout
- [x] Verify Korean word-level wrapping at 1024 px and the approved two-column layout at wider desktop widths
- [x] Rerun focused typecheck, E2E, visual, and console checks
- **Status:** complete

### Phase 9: Fable 5 responsive fidelity and shared brand lockup
- [x] Trace the live Vite process to the active `design-canopy-press` worktree and compare it with the seven approved references
- [x] Restore the approved white/green/orange shell, point hierarchy, CTA, containers, and 390/430/853/1024/1440/1586 responsive contracts while preserving Fable typography
- [x] Replace the oversized native language select with a compact TH/EN/KO popover and keep `Net Zero` invariant
- [x] Apply one new shared Net Zero wordmark/symbol to Welcome, consumer, and operational headers
- [x] Keep the full Fable activity scenes in the activity hub and add focused Fable scene thumbnails to all three Home activity cards
- [x] Verify reward ordering, 1024 px copy width, no horizontal overflow, production build, typecheck, repository tests, and desktop/Pixel E2E
- **Status:** complete

### Phase 10: Cloudflare public presentation demo
- [x] Confirm the active worktree, runtime dependencies, Cloudflare authentication, and mock-only frontend/API boundary
- [x] Add the minimum public-demo configuration without changing the approved consumer UX or reward semantics
- [x] Validate build and Cloudflare configuration locally before external deployment
- [x] Deploy the mock presentation surface and verify the public URL, demo flow, responsive layout, and multilingual switching
- [x] Record the deployment URL, version evidence, and remaining infrastructure boundary
- **Status:** complete

### Phase 11: Thailand-based carbon-impact extension
- [x] Inspect the existing factor catalog, calculation authority, carbon ledger, dashboard totals, consumer result/history surfaces, and public-demo adapter
- [x] Record the mismatch between the versioned backend calculations and public-demo hard-coded impact values
- [x] Create the bounded `SK@v2` measurement, UI, claim-boundary, and research skeleton
- [x] Obtain exact user approval for `SK@v2`
- [x] Complete the approved Thailand/TGO/IPCC/peer-reviewed research manifest and source ledger
- [x] Produce and obtain approval for evidence-backed `DS@v2`
- [x] Implement the approved calculation and consumer impact surfaces
- [x] Verify locally, publish to main, redeploy the mock presentation, and verify the public URL
- **Status:** complete

### Phase 12: Carbon-impact implementation and publication
- [x] Implement shared calculations, receipts, dashboard totals, history copy, and persistence
- [x] Verify one-of-each and repeated-activity accumulation, responsive UI, language switching, and the complete presentation path
- [x] Commit by work unit, push `main`, redeploy the presentation mock, and verify the public URL
- **Status:** complete

## Approved carbon-impact artifact
- `SK@v2`: `.planning/2026-08-13-net-zero-product-ui-redesign/skeleton_SK_v2_carbon_impact.md`
- SHA-256: `35d13bb0c0655489582152fb03f56fc5f434d69c83843c594a0059057c0f26d9`
- Approval receipt: `.planning/2026-08-13-net-zero-product-ui-redesign/approval_receipts.md`
- Authorized scope: bounded read-only deep research and `DS@v2` preparation only; no product-code or deployment change.
- Research report: `.planning/2026-08-13-net-zero-product-ui-redesign/research_report_v2_carbon_impact.md`
- Research report SHA-256: `f7b9dc207cf4f0187f4138c35015a914c0949c91dfaf7e35e4cc8008af2201b5`
- `DS@v2`: `.planning/2026-08-13-net-zero-product-ui-redesign/design_DS_v2_carbon_impact.md`
- `DS@v2` SHA-256: `d774521b4ba29bbb28fb93446385c768b533ee29f8bb98b88d737f094cb89be2`
- Approved scope: carbon calculation/data/UI implementation, local verification, scoped `main` publication, and redeployment of the existing browser-local presentation mock; no production-data or carbon-credit claim.

## Public presentation deployment receipt
- URL: `https://net-zero-reward-demo.umyunsang.workers.dev`
- Cloudflare Worker version: `b67ef2ac-5f94-4e2d-939d-7fb37925414c`
- Hosting: Cloudflare Workers Static Assets with SPA fallback
- Data boundary: browser-local mock state only; no production database, administrator workflow, or real-user data
- Verified presentation path: 0 points -> bus 3 + recycling 20 + tree 15 = 38 -> redeem 20-point voucher -> 18-point balance -> leaderboard reflects 38 weekly points
- The `38` value is only the one-of-each presentation example, never a fixed balance or cap. Every accepted activity creates another claim and immediately increments points, Home carbon totals, history, and weekly earned points. Recycling points and avoided impact scale with accepted item count.
- Remote verification: one-of-each, repeated accumulation, and responsive-gate coverage passed on Chromium desktop and Pixel 7. One initial Pixel one-of-each run rendered a blank transient frame; the parallel repeated-activity Pixel test passed and the exact failed case passed on focused retry.

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
| First redesigned E2E run passed 20/28 but timed out on four repeated locators across both desktop and Pixel 7: voucher rows, reviewer evidence button, and recycling submit copy | 1 | Inspect failure DOM/screenshots once, then correct accessible locators or routing; do not weaken API/state assertions |
| Focused retry fixed device flow but exposed voucher display grouping as `DEMO -000 1` and reviewer mocks returning `{}` because pathname excludes the query string | 2 | Normalize display grouping after removing separators, and match reviewer queue mocks on `/review/claims`; keep the raw code for QR/API use |
| Initial in-app Browser screenshot call used `tab.playwright.screenshot`, but this runtime exposes screenshots on `tab.screenshot` | 1 | Reuse the existing tab binding and call the documented tab-level screenshot method; initial navigation itself succeeded |
| First typography-refinement E2E run passed 23/28; the shortened Home CTA duplicated the `ทำกิจกรรม` navigation name, and one wallet assertion still expected the previous locked copy | 1 | Rename the primary CTA to the equally concise but distinct `เริ่มกิจกรรม`, and update the stale assertion to `ขาด 20 คะแนน`; no product state or API behavior changed |
| First post-reload Home wait omitted the required explicit visibility state, and the corrected wait then found the welcome screen because React role state resets on reload | 2 | Inspect the live DOM, enter through the rendered `เริ่มใช้งาน` control, and wait on the loaded Home heading; do not treat session storage as restored in-memory role state |
| First mobile tab-level screenshot retained the outer desktop canvas around the 390×844 responsive page | 1 | Keep the verified viewport override, then capture the mobile content with an explicit screenshot clip rather than repeating the uncropped call |
| The explicit 390×844 screenshot clip showed only half the intended CSS width because this in-app renderer emits the mobile surface at 2× pixel density; locator bounding boxes are not exposed by this browser API | 2 | Use a 780×1688 source capture for a 390×844 CSS viewport, verify the complete render, and produce a 390×844 inspection derivative; do not diagnose overflow from the invalid half-width crop |
| Running the completion checker from the repository root did not resolve the slug-scoped active plan and reported no `task_plan.md` | 1 | Run the checker from the concrete active plan directory; the plan file itself remains complete and unchanged |
| After resetting the temporary viewport override, clicking the already-active Home item failed because the in-app browser mapped its bottom-nav point outside the visible canvas | 1 | Home was already the active page; skip the redundant click, wait on the existing `คะแนนของคุณ` heading, capture, and finalize the tab |
| Focused Playwright retry used a stale project name `chromium` | 1 | Re-ran the same focused test with the configured `chromium-desktop` project; the following product-test failure was a stale `พร้อมตรวจสอบ` assertion and passed after updating it to the approved `พร้อมส่ง` copy |
| A parent-directory `rg --files ..` discovery crossed macOS-protected locations and emitted permission noise | 1 | Restrict every remaining search to `/Users/um-yunsang/Net-Zero` and never repeat the broad parent scan |
| First Phase 6 planning patch used stale checklist wording | 1 | Read the live plan tail and patched against its exact current text |
| The default database migration test skipped because `TEST_DATABASE_URL` was unset | 1 | Created a uniquely named isolated PostGIS database, ran all three migration assertions successfully, and removed only that temporary database |
| The first isolated demo-separation run passed all product behavior but retained a stale expectation for `evidence.content.read` even though the current mock tree path deliberately never calls the external verifier | 1 | Updated the audit expectation to the actual `factor.mock_demo_approved` event and reran the complete isolated suite: 10/10 passed |
| The first Phase 7 database rerun returned the former 23-point tree value because the persistent test database had only migration 001 | 1 | Applied migrations 002 and 003 to that test database, reran demo separation 10/10, then independently verified 001–003 from empty in a uniquely named database and removed it |
| The first Korean Wallet regression assertion assumed the live API's 40-point reward order, while the E2E fixture correctly returned the 20-point reward first | 1 | Asserted the fixture's actual first localized title and retained the layout measurements; the focused desktop/Pixel rerun passed 2/2 |
