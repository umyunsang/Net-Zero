# Findings: Net-Zero consumer product UI redesign

## Raw request
> 지금 프론트엔드 개발자체가 pt용으로 개발구축이된거같아, 내부 문서 성격이 강하고, 내부설계 요구사항들이 모두 최종사용자들이 볼수 있게 공개되어있어. 이런 식으로 진행하지마. pt는 ppt자료를 이미 만들었기 때문에 pt 성격의 타이포와 uiux는 모두 제거해주고, 화면 구성과 설정을 추론해서 다시 잡아.

## Intake normalization
- Outcome: a real end-user product interface, not a presentation or internal specification rendered as a web app.
- Source material: `/Users/um-yunsang/Downloads/NET-ZERO-REWARD.pptx` may supply brand, audience, value proposition, and product nouns; its slide composition and presentation typography are explicitly excluded.
- Preserve: the working three-activity earn-to-voucher loop and its real local state transitions.
- Remove from consumer UI: requirements narration, architecture/governance detail, test/demo-operational wording, long explanatory sequences, and slide-like typography.
- Done signal: a first-time Thai user can understand the next action, complete an activity, see points, choose and use a voucher, while internal controls and evidence details remain role-scoped.

## Current authority classification
- The latest user message `contradicts_premise` that the existing dashboard journey/presentation surface is acceptable product UI.
- Previous functional verification remains directly supported; previous visual direction is superseded.

## Pending discovery
- PPT content and visual cues.
- Current visible UI patterns that read as presentation/internal documentation.
- Product IA options and recommended skeleton.

## Continuity evidence
- Memory points only to durable product contracts: Thai-facing activity verification, point/carbon ledgers, voucher lifecycle, and explicit demo-data boundaries. It does not provide approval for the current visual design; the checkout and runtime remain authoritative.
- The supplied file is a valid 3.4 MB PowerPoint document. The bundled workspace runtime provides `python-pptx`, LibreOffice, and `pdftoppm`, so its text and visual system can be inspected without modifying the source file.
- The deck contains seven 16:9 slides. Its visible content is image-based rather than editable PowerPoint text, so visual rendering—not XML text extraction—is the authoritative inspection surface.
- A read-only PDF and seven slide PNGs were rendered under `/tmp/net-zero-reward-ppt.q0k9aq`; the source PPTX was not modified.

## PPT-derived product cues
- Product promise worth retaining: everyday climate-helpful actions become verified, banked points and spendable rewards.
- Core actions worth retaining: ride the bus, recycle, plant a tree.
- Human motivation worth retaining: make a useful action feel acknowledged and repeatable, rather than presenting an abstract carbon-accounting system.
- Community feature worth retaining as secondary: an opt-in, pseudonymous weekly leaderboard using verified points.
- Trust principles worth retaining: verified claims only; pseudonyms; immediate opt-out; anonymous community totals.
- Brand cues that can inform—but not dictate—the app: deep forest green, restrained orange reward accent, quiet neutral surfaces, and an urban nature/transport illustration.

## PPT elements explicitly excluded from product UI
- Giant editorial serif headlines such as “Get rewarded.” and wide 16:9 compositions.
- Slide labels, numbered 01/02/03 narratives, roadmap panels, pitch-problem exposition, and presentation progress bars.
- Long verification/program-sustainability explanations on ordinary user screens.
- Presentation-only demo narration and future-product roadmap content.
- Deck typography and slide-card layout are not UI design authority.

## Current runtime surface
- The in-app browser still exposes the local product at `http://127.0.0.1:5173/` with title `ก้าวลดคาร์บอน`, so the rejected UI can be inspected against the live current state rather than a stale screenshot.
- The ambient tab is listed by the browser but is not currently returned as an already user-owned tab handle. This is a browser attachment detail, not an application failure.

## Rejected UI diagnosis from the live Rewards screen
- The app opens with a large role/demo banner and a full-width legal/architecture warning before the user's task. This makes the implementation boundary the primary content.
- The ordinary user sees internal transaction language such as atomic debit/issue behavior, role switching to a merchant, single-use state mechanics, mock-provider scope, production-readiness disclaimers, and carbon-credit qualification.
- A four-step “how points connect to vouchers” explainer uses numbered narrative blocks. This is the exact presentation/deck pattern the user rejected.
- Navigation exposes five system modules (`overview`, `record`, `claims`, `rewards`, `community`) as peer destinations. A consumer should instead see task-oriented navigation and a single wallet/history destination.
- Reward cards expose demo suffixes, point arithmetic, voucher codes, expiry, and system policy in one dense page; functional data is useful, but system mechanics and long caveats need progressive disclosure.
- The live state itself is valuable and should remain: balance 3, two unaffordable rewards, and one already-used voucher prove that the business loop works.
- Current screenshot was captured read-only, but both attempted browser-save paths were isolated from the image-inspection tool. Current discovery will use direct browser image emission; implementation QA will need a verified shared-file transfer before final concept/render comparison.

## Frontend structure diagnosis
- `App.tsx` is a 1,209-line monolith containing user, reviewer, merchant, and admin domains plus API parsing, forms, role login, and presentation copy. The visual redesign should split product shell/navigation from role-specific feature screens.
- The user surface directly renders `mock_demo`, synthetic fixture IDs, factor approval states, system reason codes, idempotency-adjacent transaction explanations, and product-readiness caveats. These data remain useful for privileged operations and testing, but are not consumer content.
- User navigation currently mirrors backend modules (`dashboard/actions/claims/rewards/leaderboard`) instead of the user's jobs (`Home`, `Do`, `Wallet`, `Profile`).
- The current dashboard explicitly adds “from 0 points to reward” and a numbered journey rail. That business logic is useful, but the narrative component is presentation UI and should be replaced by contextual progress and a next-best-action.
- Merchant and admin functions are already role-gated at the app level. The redesign can keep those separate consoles while changing the default user experience without weakening core controls.
- The styles file is compact but highly compressed, so a later implementation should first extract an approved token/component system instead of layering more one-off selectors.

## Rejected Home-screen diagnosis
- The home page is titled “traceable overview” and leads with four audit metrics rather than a welcoming state, point balance, and one next action.
- It then renders the full pitch narrative: reward goal, three numbered activity explainers, a five-step system flow, two CTA buttons, data-retention policy, account deletion, and carbon-credit/TGO qualification on the same page.
- Copy includes GPS heuristics, reviewed factors, synthetic fixtures, one-year sequestration accounting, and specific demo equations. These belong in contextual help, claim detail, or privileged evidence views—not the home screen.
- The correct consumer transformation is not to delete business truth; it is to distribute it by moment: show activity name and estimated points before capture, review status in activity history, balance/progress in Home/Wallet, and concise terms at redemption.

## Information-architecture options

### A. Consumer wallet app — recommended
- Four jobs: Home, Do Activity, Wallet, Profile.
- Best balance of user clarity and BM visibility: points and rewards are continuously visible, while verification lives in activity state/history.
- Requires a real component split and role-shell separation, but preserves all backend contracts.

### B. Activity-first utility
- Opens directly on the three activity choices; Wallet and history are secondary.
- Fastest path to capture and the least presentation-like, but the reward/value loop becomes less visible and can repeat the user's original BM concern.

### C. Guided single-page journey
- One page moves from activity to points to voucher.
- Easy to demo, but structurally close to the rejected slide narrative and likely to regress into numbered explainers and stacked panels.

## Recommendation
- Select option A and express the business model through live product state: point balance, next reward progress, pending/verified activity, voucher availability, and used state.
- Stable proposed skeleton: `SK@v1` at `.planning/2026-08-13-net-zero-product-ui-redesign/skeleton_SK_v1.md`.

## Approval and synthesis status
- `directly_supported`: the user explicitly approved `SK@v1` with the message `SK@v1 소비자 지갑형 구조 승인` on 2026-08-13.
- The approved scope permits preparing coordinated mobile/desktop visual concepts and `DS@v1`, but does not permit product-code changes.
- External research is unnecessary: exact product semantics, user roles, screen inventory, disclosure boundaries, and visual exclusions are already established by the approved skeleton and current evidence.
- The dedicated `@imagegen` skill package was not present in the installed skill paths; the built-in Image Gen capability remains available and will be used under the complete frontend-app-builder brief.

## Concept synthesis — mobile Home v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-1c01ada0-806f-4f24-b604-485d64e378ff.png`.
- The generated Home successfully reads as a consumer app: compact app bar, 0-point balance, next-reward progress, one green CTA, three unnumbered activity rows, featured reward, empty activity state, and four-item bottom navigation.
- It removes the rejected presentation patterns: no deck sections, giant editorial serif, numbered system narrative, legal warning banner, or internal identifiers.
- Positive visual system: true white, deep green, restrained orange, consistent outline icons, thin borders, low shadow, Thai sans-serif, and a small urban line motif.
- Refinements for `DS@v1`: reduce the Home title and balance card vertical footprint slightly for a real 390–430 px viewport; use a neutral non-photographic avatar/initial rather than a realistic portrait; keep exact Thai copy code-native during implementation.
- The first direct `view_image(original)` attempt displayed only a narrow top crop even though Image Gen returned the full concept. Before design approval, create an inspection-friendly derivative and re-run `view_image` rather than relying on the generated-image preview alone.

## Concept synthesis — mobile Activity hub v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-7983aef0-c90f-497e-9776-7866629e4a91.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-activities-v1.png`.
- `view_image(high)` confirms the Home design system carries over: same app bar, typography, palette, outline icon family, gutters, and bottom navigation.
- The activity choices read as open task rows with small contextual line scenes rather than a numbered card grid. Each shows only user-relevant capture purpose and point expectation.
- The quiet verified-points sentence provides the necessary trust boundary without becoming a warning banner.
- No internal fixture/factor/GPS heuristic terminology is exposed. The Activity hub is ready to serve as the approved high-level selection screen.
- Refinement for `DS@v1`: use exact code-native Thai text and ensure the three scene illustrations can be reproduced with consistent SVG/icon components or a coordinated lightweight asset set.

## Concept synthesis — mobile Tree capture v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-9df06b7d-0b24-4c9e-b121-467709fb8816.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-tree-v1.png`.
- `view_image(high)` confirms a single-task capture flow: photo capture, species, location, contextual point expectation, collapsed verification help, submit, and post-review point note.
- The page demonstrates progressive disclosure correctly: the user sees only `ตรวจอย่างไร`; verification mechanics remain behind the row and internal identifiers never appear.
- The large dashed upload surface is the dominant interaction, not a marketing image. It is practical to implement with a native file/photo control and a coordinated SVG empty-state illustration.
- The fixed navigation and top back bar remain consistent with the Home/Activity system.
- Refinement for `DS@v1`: bottom navigation can remain on capture screens for MVP continuity, but the submit control must stay visible without overlap at 390–430 px and with mobile safe-area padding.

## Concept synthesis — mobile Wallet v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-0698d168-547a-4ec8-a28c-2b9108f936e1.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-wallet-v1.png`.
- `view_image(high)` confirms the BM is legible through product state: 23 available points, a 20-point reward marked exchangeable, a 40-point reward with 17 points remaining, and an empty voucher area.
- There is no instructional panel explaining atomic debit/issue, merchant role switching, or redemption internals. Affordability and the next action are self-evident.
- The wallet uses a stronger green balance band and orange only for the exchange-ready state, keeping the Home/Activity visual family coherent.
- Refinement for `DS@v1`: treat reward cards as the main card family and avoid using the dashed empty-state border elsewhere; keep balance and point-history controls keyboard accessible.

## Concept synthesis — active Voucher detail v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-cbbc3a22-fc95-4da6-a3fc-f38686e5c446.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-voucher-v1.png`.
- `view_image(high)` confirms the post-exchange state is immediately legible: remaining balance 3, active 20-baht voucher, expiry, QR/code, merchant-facing show action, and one-use term.
- The consumer never sees merchant role switching or redemption endpoint/process language. The single action `แสดงให้ร้านค้า` replaces the rejected internal handoff instructions.
- The ticket silhouette provides a distinctive product motif while remaining implementable with CSS borders/pseudo-elements and a code-generated QR.
- Refinement for `DS@v1`: define active, used, and expired visual variants; when used, replace QR/action with a check state and redemption time while retaining the voucher title and code receipt in history.

## Concept synthesis — desktop Home v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-511c03e7-8a6f-4de8-8304-5f1526f179b6.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-desktop-home-v1.png`.
- `view_image(high)` confirms the mobile product model expands cleanly to desktop: four-job left rail, compact first-action heading, one balance/CTA module, three task rows, next reward, and recent activity.
- The desktop screen avoids presentation drift: no 16:9 pitch layout, no giant editorial heading, no metric dashboard, no full-width warning, and no numbered journey.
- The right column is subordinate and functional rather than a grid of internal status cards.
- Refinement for `DS@v1`: maintain a 230–250 px rail, 32–48 px main gutters depending on width, one primary content column plus a 300–340 px secondary column, and collapse back to the mobile bottom navigation below the desktop breakpoint.

## Concept synthesis — desktop Wallet v1
- Source: `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/exec-fabd46ca-4306-4024-af0b-fb80aca91bc3.png`.
- Inspection derivative: `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-desktop-wallet-v1.png`.
- `view_image(high)` confirms responsive continuity rather than simple enlargement: the same 23-point balance spans the content width, the reward catalog occupies the primary column, and the voucher empty state occupies a secondary column.
- The wallet remains consumer-facing and action-oriented; no dashboard charts, merchant operations, or transaction internals are introduced at desktop width.
- The single contextual sentence `คะแนนจะถูกใช้เมื่อออกบัตรสำเร็จ` is the maximum transaction explanation allowed on the catalog screen.
- Refinement for `DS@v1`: use the same desktop rail and breakpoints as Home, cap reward/voucher columns at roughly 1.25:1, and stack them before switching to the mobile shell.

## Concept set synthesis verdict
- The required product states and desktop continuations are represented across six concepts: 0-point Home, activity selection, focused capture, 23-point reward availability, active voucher with 3 remaining points, desktop Home, and desktop Wallet.
- Missing as a separate image but fully specifiable from the existing component family: pending/verified/rejected activity-history rows, used/expired voucher variants, Profile/community preferences, and role-specific operator consoles.
- These downstream states do not require new visual primitives; `DS@v1` can define them as variants of the accepted rows, ticket, app shell, form, and utility-console families.
- No concept contradicts `SK@v1`. The design set is ready for exact design synthesis and user approval.

## DS@v1 self-review
- Stable design fingerprint: `6607e306dcb68870a5e892b69073216342a8f979e78ca47aeeabe2c78e478f13`.
- Placeholder scan found only the intentional artifact status `pending exact user approval`; there are no TBD/TODO implementation gaps.
- All seven inspection concept files exist and are non-empty.
- Internal consistency check passes: navigation, 0→23→3 point states, reward costs, responsive shell, copy boundary, and locked backend semantics agree across the design and concepts.
- Scope check passes: this is one consumer-frontend redesign with role-shell separation, not a new backend or partner/payment project.
- Remaining approval choice is exact and user-owned: accept `DS@v1` as the implementation-planning authority or request a visual revision.
- Final mobile review-sheet inspection confirms one coherent product journey: 0-point Home, three-action hub, focused tree capture, 23-point Wallet, and active voucher after the 20-point exchange with 3 points remaining.
- Final desktop review-sheet inspection confirms the same four-job navigation and wallet semantics scale to a desktop shell without presentation-deck hierarchy or internal operations content.
- The contact sheets are review summaries only; the seven individually inspected concept derivatives remain the visual authority for implementation details.

## Approved implementation discovery
- `DS@v1` was explicitly approved on 2026-08-13 with the message `DS@v1 승인`; its verified SHA-256 remains `6607e306dcb68870a5e892b69073216342a8f979e78ca47aeeabe2c78e478f13`.
- The frontend is React 19 + Vite 7 under `apps/web`, with React Router available but the current surface controlled by local `page` state.
- Existing Playwright coverage already exercises the 23→3 point exchange, persisted redeemed voucher state, and desktop/mobile device gates; implementation should preserve observable flow labels or revise the tests in lockstep with approved Thai consumer copy.
- The current 1,209-line `App.tsx` owns API helpers, evidence capture, all four roles, consumer and operator screens, and navigation. The approved component split can be introduced without changing API endpoints.
- The current 36-line compressed stylesheet is presentation/dashboard-oriented and is small enough to replace with the approved token/component system rather than layering overrides.
- There is no project-local `AGENTS.md` in the repository root; the supplied global project instructions and approved local planning artifacts remain the implementation authority.
- Consumer activity submission already uses three stable endpoints (`/actions/bus`, `/actions/recycling`, `/actions/tree`) and dedicated evidence upload/finalize calls. The redesign can change capture presentation without changing payloads or device-gate behavior.
- Current consumer tests are coupled to rejected labels such as `ภาพรวม`, `บันทึก`, `คำขอ`, `รางวัล`, and `ชุมชน`; they must be revised to the approved destinations `หน้าแรก`, `ทำกิจกรรม`, `กระเป๋า`, and `ฉัน` while preserving their API-level assertions.
- The current E2E mock infrastructure is suitable for visual states: it can seed 0 or 23 points, issued/redeemed vouchers, claim status mixes, role-specific queues, and leaderboard consent without altering the local database.
- Operator behaviors that must remain unchanged are explicitly covered: reviewer evidence failure copy, tree/recycling decisions, bus-oracle non-bypass, merchant single-use rejection, server-error Thai mapping, and admin confirmation/readiness separation.
- Existing styles are a single compressed dashboard layer. Replacing this file with true-white tokens, mobile bottom navigation, desktop rail, focused forms, reward cards, and voucher tickets is the cleanest fidelity path.
- The approved split is now implemented with `App.tsx` as role/session composition, `ConsumerApp.tsx` as the consumer product, and `OperationsApp.tsx` as privileged workspaces. API paths and payloads remain unchanged.
- An actual QR image can be generated locally from each voucher code with the installed `qrcode` package, satisfying the design without a remote service or concept-image substitution.

## Verification discovery
- Repository-wide static and unit verification passes. Existing API suites that require integration/database conditions remain skipped by their pre-existing test guards; the deterministic web E2E independently covers the redesigned flow.
- The local Vite server is listening on port 5173 and the API process is listening on port 3000. The tested health-path guesses return 404, so readiness is established by the successful E2E/API interactions rather than an undocumented health URL.
- The Codex in-app browser is available with explicit visibility and viewport controls. No prior user tab is claimable in the current browser run, so rendered QA should create one deliverable tab and keep it open at the verified product.
- In-app Browser page identity passes at `http://127.0.0.1:5173/` with title `ก้าวลดคาร์บอน`. The welcome DOM contains only the approved consumer promise and one `เริ่มใช้งาน` action; the first viewport has no framework overlay or console warnings/errors.
- The default in-app viewport is below the desktop breakpoint, so the consumer shell correctly uses the compact header and four-job bottom navigation. Immediately after login, navigation appears before Home data resolves; rendered QA must wait for the screen heading, not merely the shell navigation.
- The live database currently represents the completed business loop: 3 available points, a verified tree activity, and a used 20-baht product voucher. Home renders these as contextual product state without internal identifiers or architecture copy.
- The live Wallet clearly separates the 3-point balance, locked 20/40-point rewards, and the used voucher. The used voucher detail shows redemption time and readable code while rendering zero QR images and zero `แสดงให้ร้านค้า` actions, matching the approved terminal state.
- No console warning/error appeared on the loaded Home or Wallet states.

## Live typography refinement
- The approved consumer-wallet layout remains valid, but the current render still gives explanatory sentences too much visual and verbal weight.
- The user explicitly requested a more concise, instantly legible typographic treatment after viewing the live implementation.
- Revised hierarchy: screen noun or outcome first, live number second, one action third; supporting copy is reduced to short fragments and trust detail remains progressive.
- Primary consumer vocabulary is locked to `คะแนน`, `กิจกรรม`, `รางวัล`, and `บัตร`; long journey narration will not be reintroduced.
- This feedback supersedes the exact DS copy where needed but does not change navigation, layout, score semantics, verification states, or voucher lifecycle.
- Desktop render at 1440×1000 now reads in the intended order: `คะแนนของคุณ` → `3 คะแนน` → `อีก 17 คะแนน ถึงรางวัล` → `เริ่มกิจกรรม`; activity, reward, and recent-history labels no longer compete with explanatory paragraphs.
- The desktop rail and two-column Home remain faithful to the approved structure. The short CTA `เริ่มกิจกรรม` is distinct from the navigation label `ทำกิจกรรม`, improving both comprehension and accessible targeting.
- A 390×844 responsive override correctly activates the mobile layout, but the first tab-level capture retained the outer desktop canvas around the narrow page. A cropped mobile evidence capture is required before visual sign-off; this is a screenshot-framing issue, not a layout overflow finding.
- The in-app renderer outputs the mobile viewport at 2× pixel density. A 780×1688 capture corresponds to the requested 390×844 CSS viewport; that render shows no clipping, overlap, or accidental wrapping. The earlier 390-pixel source capture represented half the CSS width and was not valid layout evidence.
- Mobile Activity now resolves to three compact rows whose hierarchy is title → capture noun → point basis (`ตามระยะทาง`, `ตามจำนวน`, `23 คะแนน`). The trust sentence is reduced to `ผ่านตรวจ · รับคะแนน` and remains secondary.
- Mobile Wallet resolves to `กระเป๋า` → `3 คะแนน` → reward cost/deficit → `บัตร`. No tutorial narrative is visible; the only transaction disclosure is `ออกบัตรสำเร็จ · หักคะแนน`.
- Activity and Wallet DOM snapshots remain semantically structured, navigation active states are correct, and the error/warning console remains empty.
- Direct `view_image` comparison confirms desktop structure, palette, rail, balance/CTA sequence, three activity rows, reward, and recent-state column remain faithful while the user-authorized shorter copy improves hierarchy.
- The first 390×844 derivative made from a 780-wide browser source is visually too dense and cannot serve as native mobile sign-off evidence. The fidelity ledger keeps mobile pending until a fresh native-width render resolves the capture-scale ambiguity.
- A fresh 430-wide in-app capture renders the compact Home hierarchy cleanly with no clipped title, balance, CTA, activity, reward, or history content. Pixel 7 E2E receives an explicit document-width assertion so mobile overflow is verified independently of screenshot framing.

## Presentation-speed activity feedback
- New outcome: the presenter should complete the bus path in roughly 2–3 seconds from one start action, and a recycling submission should be accepted and reflected without switching to an admin/reviewer role.
- The request is explicitly for the presentation prototype, so any assumption of valid activity must remain isolated to `mock_demo`; production verification behavior must not silently weaken.
- Target flows: `ขึ้นรถโดยสาร → เริ่ม → 2–3 วินาที → สำเร็จ` and `ส่งรีไซเคิล → ส่ง → ยืนยันอัตโนมัติ → คะแนนเข้า`.
- The approved consumer-wallet IA, typography, reward catalog, voucher lifecycle, and non-demo trust boundary remain unchanged.
- The bus verifier already evaluates the synthetic route from 30-second timestamps. The presentation can therefore replay those seven samples every 400 ms while retaining the verification payload's original timing, yielding one-click completion in about 2.4 seconds without weakening the route oracle.
- Recycling previously always created `pending_review`. The safe fast path is scoped by all three conditions: the redeemed QR/account is demo data, `MOCK_DEMO_ENABLED` is true, and database scope is `mock_demo`; all other submissions remain `pending_review`.
- Demo auto-verification records `approved_count = declared_count`, runs the existing immutable carbon/point credit function, and writes an explicit `mock_demo_auto_verified` audit marker. It does not bypass the factor ledger or voucher accounting.
- Consumer success copy now follows the returned claim: a verified action shows `สำเร็จแล้ว` and the awarded points, while any non-verified response still shows `ส่งแล้ว` and `รอตรวจสอบ`.
- Live in-app verification passed against the running API: bus reached `สำเร็จแล้ว / ยืนยันแล้ว` after one Start and roughly 2.4 seconds; recycling 46 PET items reached `สำเร็จแล้ว / +20 คะแนน` without a reviewer role.
- The first live recycling retry correctly exposed that the deterministic QR is one-time and had been consumed by prior prototype state. Resetting only the isolated `mock_demo` fixture restored the 0-point start and QR; the same live flow then passed.
- After verification, `mock_demo` was reset again so the presenter receives a clean 0-point account and unused recycling QR. The in-app browser is left on the three-activity hub, ready for the first presentation action.

## Reward, leaderboard, and multilingual expansion
- User-authorized outcomes: mock-demo tree verification must award 15 points; mock-demo bus verification must award 3 points; consumers must be able to see a populated mock leaderboard; and the whole product must switch immediately among Thai, English, and Korean from a header control.
- Preserve the approved wallet skeleton, carbon-impact factors, voucher costs, evidence verification, and production scoring behavior. New reward overrides must be explicit mock-demo policy rather than altered carbon factors.
- The language selector is a global product control, not another primary navigation destination. Selection should persist locally and update the document language plus all visible role surfaces without reload.
- The user reattached seven approved renders and explicitly rejected current visual drift. Those renders are the visual authority for mobile Home, Activity, Wallet, tree detail, voucher detail and desktop Home/Wallet: white canvas, green line-illustration language, mobile top header plus bottom tabs, desktop left sidebar, generous whitespace, and restrained bordered cards.

## Phase 9 live Fable fidelity findings
- Port 5173 is served by `.claude/worktrees/design-canopy-press`, not the main checkout. All Phase 9 product edits and live verification therefore target that worktree.
- The Fable 5 commit introduced the desired Fraunces/Sarabun/Noto Serif Thai typography, WebGL city, and three local SVG activity scenes, but its paper palette and intermediate-width composition drifted from approved `DS@v1`.
- At 1024 px the pre-fix Home grid could collapse `.balance-copy` to zero width. A dedicated 1024–1199 contract now reserves 117 px or more for the score copy beside a 176 px city scene and 280 px secondary column.
- The approved and user-retained Fable visuals are local components, not remote images: `CityCanvas`/`CitySkyline` for the point hero and `ActivityScene` for bus, recycling, and tree. The Home compact cards now use cropped views of those same scene paths rather than substituting another icon family.
- The new brand lockup is one shared `BrandMark`: a zero-ring/leaf symbol, orange terminal point, and invariant Fraunces `Net Zero` wordmark. It is used by Welcome, consumer, and operational headers and is never translated.
- Final live measurements show zero horizontal overflow at 430 and 1440 px; Home activity thumbnails are 92×58 at 430 px, full activity scenes are 388×82, the 1440 px hero/secondary tracks are 712/340 px, and primary navigation remains four destinations.
- The requested Cloudflare target is a publicly reachable mock presentation demo for PT audiences, not an operational production service. It must not connect production data, administrator workflows, or real-user state.
- The new leaderboard and language selector must be integrated into that approved composition rather than creating another navigation job or presentation-style surface.

## Phase 7 typography acceptance
- Typography is now an explicit user-owned acceptance surface, not a secondary styling check.
- The user has now re-declared the seven original generated PNGs under `.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/` as the exact approved visual authority. These originals, not derivatives or earlier implementation screenshots, govern shell proportions, whitespace, Thai type scale, border treatment, icon stroke, and responsive composition.
- The approved originals are five 853×1844 mobile screens and two 1586×992 desktop screens. Their SHA-256 values were captured in the Phase 7 progress record so later visual comparisons cannot silently substitute a different derivative.
- Preserve the approved local font policy with no remote dependency, but make fallback order language-aware so Thai, English, and Korean each receive stable glyph metrics.
- Verify screen-title, section-title, row-title, body/control, caption, and tabular-number roles independently at mobile and desktop widths.
- Reject clipped ascenders/descenders, faux-bold glyphs, accidental one-word wraps, over-tight Thai line height, mixed numeral alignment, and language-switch width jumps that disturb the approved composition.
- Verified policy result: an isolated complete demo returned tree `15`, recycling `20`, and bus `3`, with dashboard and opted-in viewer leaderboard totals of `38`; issuing the 20-point voucher left `18` in that combined-flow test.
- The fixed reward policy is enforced only for claims whose persisted `data_scope` is `mock_demo`. Production claims still use the existing calculated points and approved factor path.
- A second database trigger is required because the existing impact evaluator intentionally omits a point-ledger insert when the calculated award is zero. The fallback runs only after a mock-demo bus/tree claim becomes credited and only when no credit row exists, preserving idempotency and the immutable ledger.
- Demo rankings remain visible even when the viewer opts out; consent controls only whether that viewer joins under a pseudonym. Production leaderboard results do not receive mock rows.
- Immediate translation coverage is centralized and persistent. The live browser confirmed Thai, English, and Korean labels for brand, navigation, Home, activity names, rewards, Profile, and leaderboard, with selection retained after reload.
- The final live desktop Home aligns with the accepted desktop reference in shell, visual hierarchy, hero balance, primary CTA, activity cards, reward/recent secondary column, and white/green/orange visual system. The user-requested leaderboard is added below the existing right-column product content rather than as a fifth primary navigation job.
