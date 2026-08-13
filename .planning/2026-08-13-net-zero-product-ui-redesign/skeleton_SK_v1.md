# SK@v1 — Net-Zero Rewards consumer product UI redesign

## Artifact
- Type: product skeleton
- Stable ID: `SK`
- Exact version: `v1`
- Stable locator: `.planning/2026-08-13-net-zero-product-ui-redesign/skeleton_SK_v1.md`

## Normalized request
- Outcome: replace the presentation/internal-document frontend with a Thai consumer rewards product.
- Audience: an everyday Thai user who wants to earn and spend points; reviewer, merchant, and admin users remain separate operational roles.
- Inputs: current working activity/ledger/voucher flows and the supplied PPT's product promise, activity nouns, trust principles, and restrained brand cues.
- Exclusions: PPT slide composition, editorial headline typography, roadmap/pitch content, numbered narrative panels, and public exposure of internal design or system requirements.
- Done signal: from a 0-point state, a first-time user can choose one of three activities, submit it, understand review status, see verified points, exchange them for a voucher, and present that voucher for one-time use without reading system architecture or a presentation narrative.

## Recommended product model
Use a mobile-first consumer wallet model. The product should behave like a small rewards app, not a dashboard or marketing site.

### Consumer navigation
1. `หน้าแรก` — Home
2. `ทำกิจกรรม` — Do activity
3. `กระเป๋า` — Wallet
4. `ฉัน` — Profile

Community is secondary: show a small opt-in preview on Home and manage participation under Profile. Activity history is accessible from Home and the Activity hub rather than occupying a system-module tab.

### Screen inventory

#### 1. Home
- Compact app bar with product name, avatar/profile access, and a small demo indicator.
- Point balance and progress to the next attainable reward.
- One primary next action: `ทำกิจกรรมรับคะแนน`.
- Three activity shortcuts: bus, recycling, tree planting.
- A short recent-activity row showing pending/verified/rejected state in natural language.
- One featured reward preview; no point-to-voucher tutorial.

#### 2. Activity hub
- Three clear choices with a familiar icon/illustration, one-line instruction, and contextual point expectation.
- Selecting an activity opens only that activity's capture flow; never stack all three forms on one page.

#### 3. Activity detail/capture
- Bus: start/stop journey capture, visible duration/progress, submit.
- Recycling: scan/drop-off code, choose material/count, attach evidence, submit.
- Tree: species, attach evidence/location, submit.
- Short `ตรวจอย่างไร` disclosure is expandable and activity-specific.
- Success returns a human state such as `ส่งแล้ว · กำลังตรวจสอบ`; internal fixture/provider/factor identifiers stay hidden.

#### 4. Activity history/detail
- Timeline/list grouped by recent date.
- States: pending, verified with points, or needs attention/rejected with a plain-language reason.
- Show awarded points and estimated impact when relevant; keep audit IDs and system reason codes out of the consumer view.

#### 5. Wallet
- Current point balance.
- Reward catalog with available/locked states and the exact number of points still needed.
- `บัตรของฉัน` with active, used, and expired vouchers.
- Voucher detail reveals the code/QR only when the user chooses to use it; shows expiry and one-use terms concisely.
- Redemption remains a separate merchant-role console. The consumer app never instructs the user to switch roles.

#### 6. Profile
- Pseudonym and weekly-community opt-in/out.
- Privacy/account controls.
- `เกี่ยวกับเวอร์ชันสาธิต` opens a plain-language information sheet.
- Demo role switching is a low-prominence developer/demo control here, not the product homepage.

### Operational roles
- Reviewer: evidence queue and decision workspace.
- Merchant: voucher scan/redeem/cancel workspace.
- Admin: factor/readiness management workspace.
- These roles use separate utility layouts and never share consumer navigation. Internal identifiers, methodology fields, audit receipts, and demo readiness details remain visible only where operationally necessary.

## Core user flow
`0 points → Home next action → choose activity → capture/submit → pending history → verified points → Wallet progress/availability → issue voucher → show voucher to merchant → used state`

The business model is communicated through changing product state, not through a slide-like explanation of the entire system.

## Disclosure boundary

### Consumer-visible
- Small `สาธิต` indicator.
- `คะแนนจะเพิ่มเมื่อกิจกรรมผ่านการตรวจสอบ` where relevant.
- Estimated-impact wording where a number is shown.
- Voucher cost, remaining points, expiry, and single-use status.
- A short About Demo sheet explaining that demo evidence/data are simulated and estimates are not certified carbon credits.

### Hidden from ordinary users
- `mock_demo`, fixture IDs, correlation/evidence IDs, factor IDs, methodology codes, approval scopes, reviewer digests, role/RBAC terminology, idempotency/atomicity language, raw retention architecture, production-hardening roadmap, and test-provider mechanics.
- Detailed legal/technical caveats repeated across Home, Rewards, and footer.
- Merchant/admin operating instructions.

## Visual direction
- Product UI typography: Thai-first sans-serif system stack; no editorial serif display type, all-caps eyebrow labels, giant H1, or slide numbering.
- Scale: screen title 24–28 px, section title 18–20 px, body/control text 14–16 px.
- Palette: true white and cool neutral surfaces, deep forest green as the primary action color, restrained orange only for reward/progress emphasis.
- Layout: open mobile-first pages with a compact app bar and fixed bottom navigation; desktop uses the same product hierarchy in a wider shell, not a 16:9 deck.
- Containers: use cards only for activities, rewards, and vouchers; avoid nested panels and repeated presentation grids.
- Motion: short state transitions for point credit, progress, and voucher issue; respect reduced motion.

## Locked functional semantics
- Keep the three MVP activities and current verification state machines.
- Credit points only after verification; preserve the point/carbon ledgers and current scoring.
- Preserve atomic voucher issue/debit and one-time redemption behavior.
- Preserve Thai-first copy and demo/production separation.
- Do not invent partner, payment, carbon-credit, certification, or production-readiness claims.

## Responsive expectation
- Primary acceptance view: 390–430 px mobile width.
- Secondary acceptance view: current desktop browser width.
- All core controls and status changes must remain usable with keyboard and screen-reader semantics.

## Provisional choices and unknowns
- Provisional: community is a secondary Home/Profile feature rather than a primary navigation tab.
- Provisional: demo role switching lives under Profile and is visually de-emphasized.
- Unknown until concept review: exact icon family, Thai microcopy, illustration amount, and precise spacing/radius tokens.
- No external research question is required before concepting; the supplied deck and current runtime are sufficient inputs.

## Post-approval design work
- Generate a complete mobile concept for Home, Activity hub/detail, Wallet, and voucher state plus a coordinated desktop Home/Wallet concept.
- Derive `DS@v1` with exact copy, tokens, component inventory, responsive behavior, and role-boundary rules.
- Obtain exact approval for `DS@v1` before product-code changes.

## Approval scope requested
Approval of `SK@v1` authorizes only concept generation and preparation of `DS@v1`. It does not authorize code changes, deployment, external research, or external actions.
