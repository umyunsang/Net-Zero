# DS@v1 — Net-Zero Rewards consumer wallet design

## Artifact
- Type: synthesized product design
- Stable ID: `DS`
- Exact version: `v1`
- Base skeleton: `SK@v1`
- Stable locator: `.planning/2026-08-13-net-zero-product-ui-redesign/design_DS_v1.md`
- Status: pending exact user approval

## Design decision
Implement the product as a Thai-first consumer wallet. The business model appears through live state changes—balance, review state, reward affordability, voucher issue, and used state—not through presentation copy or architecture explanations.

## Approved concept sources

| Surface | Inspection source |
|---|---|
| Mobile Home, 0 points | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-home-v1.png` |
| Mobile Activity hub | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-activities-v1.png` |
| Mobile Tree capture | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-tree-v1.png` |
| Mobile Wallet, 23 points | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-wallet-v1.png` |
| Mobile active Voucher, 3 points | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-mobile-voucher-v1.png` |
| Desktop Home | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-desktop-home-v1.png` |
| Desktop Wallet | `/Users/um-yunsang/.codex/visualizations/2026/08/13/019ff90e-4437-7c40-a473-5553a64d6af9/concept-desktop-wallet-v1.png` |

## Field-level resolution from SK@v1
- Community is not primary navigation. A small Home preview may link to Profile, where pseudonym and weekly opt-in are managed.
- Demo role switching is hidden under a low-prominence Profile section; it is never visible on Home or Wallet.
- Illustration amount is fixed: one small eco-city line motif on balance modules, one contextual line scene per activity, and one empty-state illustration per empty surface.
- Icon direction is fixed: consistent 2 px outline SVG, rounded caps/joins, green for domain actions, near-black for navigation, filled green only for the selected destination.
- The visual background is true white. No cream/beige substitution is allowed.

## Information architecture

### Consumer shell
- `หน้าแรก`
- `ทำกิจกรรม`
- `กระเป๋า`
- `ฉัน`

### Secondary routes
- Activity detail: bus, recycling, tree.
- Activity history and claim detail.
- Voucher detail.
- Community preferences and About Demo under Profile.

### Operational shells
- Reviewer, Merchant, and Admin remain separate role-gated utility workspaces.
- Consumer navigation and consumer decorative illustrations do not appear in operational workspaces.

## Required consumer state sequence
1. Home at 0 points with one next action.
2. Select bus, recycling, or tree.
3. Submit one focused capture flow.
4. History shows `กำลังตรวจสอบ`.
5. Verified activity shows awarded points; rejected activity shows a plain-language reason and retry action where allowed.
6. At 23 points, the 20-point reward shows `แลกได้ตอนนี้`.
7. Successful exchange creates an active voucher and leaves 3 points.
8. Voucher detail shows code/QR, expiry, and `ใช้ได้ครั้งเดียว`.
9. Merchant redemption changes the consumer voucher to `ใช้แล้ว`; QR/action disappear and redemption time is shown.

## Exact screen design

### Mobile Home
- Top app bar: brand mark, `ก้าวลดคาร์บอน`, small `สาธิต`, neutral initials/profile icon.
- Title: `เริ่มกิจกรรมแรกของคุณ` at 26 px/1.25.
- Balance module: `0 คะแนน`, progress to `อีก 20 คะแนน รับส่วนลด 20 บาท`.
- Primary CTA: `ทำกิจกรรมรับคะแนน`.
- Activity title: `ทำอะไรได้บ้าง`.
- Rows: `ขึ้นรถโดยสาร`, `ส่งรีไซเคิล`, `ปลูกต้นไม้`.
- Reward: `ส่วนลดสินค้า 20 บาท`, `20 คะแนน`.
- Recent state: `กิจกรรมล่าสุด`, `ยังไม่มีกิจกรรม`, `ดูประวัติ`.

### Activity hub
- Title: `ทำกิจกรรม`.
- Subtitle: `เลือกกิจกรรมที่คุณทำวันนี้`.
- Trust line: `คะแนนจะเพิ่มเมื่อกิจกรรมผ่านการตรวจสอบ`.
- Bus: `ขึ้นรถโดยสาร` / `บันทึกการเดินทางด้วยขนส่งสาธารณะ` / `คะแนนตามระยะทางที่ตรวจสอบ`.
- Recycling: `ส่งรีไซเคิล` / `นำขวด PET ไปส่งและยืนยันจำนวน` / `คะแนนตามจำนวนที่ตรวจสอบ`.
- Tree: `ปลูกต้นไม้` / `ส่งรูปและตำแหน่งเพื่อรอตรวจสอบ` / `ตัวอย่างเดโม 23 คะแนน`.
- Footer row: `ดูประวัติกิจกรรม`.

### Activity capture
- One activity per route; never render all three forms together.
- Bus: start/stop capture, visible elapsed state, route name only when needed, submit.
- Recycling: drop-off/QR code, material, count, photo, submit.
- Tree: photo, species, location, submit.
- Tree exact copy: `เพิ่มรูปต้นไม้`, `ถ่ายให้เห็นต้นไม้และบริเวณโดยรอบ`, `ถ่ายรูป`, `ชนิดต้นไม้`, `เช่น ตะแบก`, `ตำแหน่ง`, `กรุงเทพฯ · พร้อมส่ง`, `ตรวจอย่างไร`, `ส่งให้ตรวจสอบ`.
- Success: `ส่งแล้ว · กำลังตรวจสอบ` and link to history.
- Verification detail is collapsed by default and expressed in plain language.

### Activity history
- Header: `ประวัติกิจกรรม`.
- Rows contain activity icon/title, submitted date, one state, and awarded points when verified.
- Pending: `กำลังตรวจสอบ`.
- Verified: `ผ่านการตรวจสอบ` and `+{points} คะแนน`.
- Rejected: `ต้องตรวจสอบอีกครั้ง` plus a mapped consumer reason; never render raw reason codes.
- Claim detail may show estimated impact with the label `ค่าประมาณ`, but no factor/methodology/fixture/evidence identifiers.

### Wallet
- Title: `กระเป๋าของฉัน`.
- Balance: `{points} คะแนน`, `พร้อมใช้`, `ดูประวัติคะแนน`.
- Catalog title: `รางวัล`.
- Affordable: title, cost, `แลกได้ตอนนี้`, `แลกรางวัล`.
- Locked: title, cost, `อีก {points} คะแนน`, lock/progress; no pointless disabled CTA.
- Voucher title: `บัตรของฉัน`.
- Empty: `ยังไม่มีบัตร`, `แลกรางวัลแล้วบัตรจะอยู่ที่นี่`.
- Maximum transaction explanation: `คะแนนจะถูกใช้เมื่อออกบัตรสำเร็จ`.

### Voucher detail
- Title: `บัตรของฉัน`.
- Balance row: `คะแนนคงเหลือ {points}`.
- Active: reward title, `พร้อมใช้`, `ใช้ได้ถึง {date}`, QR, grouped code, `แสดงให้ร้านค้า`, `ใช้ได้ครั้งเดียว`, `เงื่อนไขการใช้`.
- Used: reward title, `ใช้แล้ว`, redemption date/time, check illustration; remove QR and primary action.
- Expired: reward title, `หมดอายุ`, expiry date; remove QR and primary action.
- Cancelled: reward title, `ยกเลิกแล้ว`; display point return only when the backend actually records it.

### Profile
- `ฉัน`, pseudonym, weekly community opt-in/out, privacy/account controls.
- `เกี่ยวกับเวอร์ชันสาธิต` opens a sheet with concise text: demo identities/evidence/provider activity are simulated; displayed impact is an estimate and not a certified carbon credit.
- `สลับบทบาทสาธิต` is visually de-emphasized below product/account controls.

## Responsive container model

### Mobile: below 768 px
- True-white full viewport.
- 16–20 px horizontal gutters.
- Fixed bottom navigation, 72 px plus safe area.
- App bar 64–72 px.
- Single content column.
- Primary buttons minimum 48 px high.

### Tablet: 768–1023 px
- Single-column or stacked two-section layout with max-width 760 px.
- Bottom navigation may remain to preserve product continuity.

### Desktop: 1024 px and above
- 230–250 px fixed/sticky left rail.
- Main content 32–48 px gutters, max width about 1180 px.
- Home: primary column plus 300–340 px secondary column.
- Wallet: reward/voucher columns near 1.25:1, stacking before mobile shell transition.
- No top-level dashboard header, banner, or footer disclaimer wall.

## Design tokens

### Color
- `--color-bg: #FFFFFF`
- `--color-surface: #FFFFFF`
- `--color-surface-soft: #F5F8F6`
- `--color-text: #151A17`
- `--color-text-muted: #66716B`
- `--color-border: #D8E0DB`
- `--color-green-900: #0F5A3D`
- `--color-green-700: #146447`
- `--color-green-100: #EAF5EF`
- `--color-orange-600: #E77800`
- `--color-orange-100: #FFF3E8`
- `--color-danger: #B42318`
- `--color-pending: #8A6100`

### Typography
- Family: `-apple-system, BlinkMacSystemFont, "Noto Sans Thai", "Leelawadee UI", sans-serif`.
- No remote font dependency.
- Screen title mobile 26/32, desktop 30/38, weight 700.
- Section title 18/26, weight 700.
- Card/row title 16/24, weight 650–700.
- Body/control 14–16/22–24, weight 400–600.
- Caption 12–13/18, weight 400–600.
- No serif, uppercase tracking labels, or display typography.

### Geometry and spacing
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Radius: 10 control, 14 row/card, 16 large module.
- Border: 1 px `--color-border`; selected/primary outlines may use green.
- Shadow: none by default; maximum `0 6px 18px rgba(15, 90, 61, 0.06)` for an elevated voucher/action only.
- Focus ring: 3 px green-100 outer plus 2 px green-700 inner/outline.

## Component families
- `ConsumerShell`: mobile app bar/bottom nav; desktop rail/main layout.
- `BrandMark`: local custom SVG leaf/route/dot, monochrome green.
- `PrimaryButton`, `SecondaryButton`, `IconButton`.
- `BalanceModule`: zero/progress and wallet variants.
- `ActivityRow`, `ActivityScene`, `ActivityStateRow`.
- `CaptureSurface`, `FieldRow`, `DisclosureRow`, `StatusNotice`.
- `RewardCard`: available/locked variants.
- `VoucherTicket`: active/used/expired/cancelled variants.
- `EmptyState`.
- `UtilityShell`: reviewer/merchant/admin only.

## Asset inventory
- Custom local SVG brand mark based on the concept leaf/route/dot geometry.
- Consistent local SVG icons/scenes for bus, recycling, tree, city line, ticket, wallet, profile, home, camera, map pin, history, status, and chevrons.
- QR is generated from the actual voucher code; never ship the concept QR as data.
- No runtime CDN or remote asset dependency.
- Before coding visible illustrations, create faithful standalone SVG/transparent references from the accepted concepts or implement production-quality vector equivalents with matching stroke/fill rules.

## Consumer/internal boundary

### Allowed consumer content
- Points, reward costs, remaining points, status, submitted/verified timestamps, awarded points, estimated impact labels, voucher expiry, one-use rule, plain-language demo disclosure.

### Prohibited consumer content
- `mock_demo`, fixture/correlation/evidence/factor IDs, methodology codes, approval scope/digest, RBAC/role terminology, idempotency, atomicity, endpoint language, GPS heuristic details, provider internals, raw retention architecture, production-hardening roadmap, merchant/admin instructions.

## Component architecture plan
- Keep `App` as role/session composition only.
- Split consumer shell, consumer screens, operational shells, shared UI primitives, API contracts, and copy/state mappers.
- Raw API reason/status values are mapped centrally to consumer Thai copy or privileged operational copy.
- Existing API, scoring, verification, ledger, and voucher semantics remain unchanged.

## Interaction and motion
- 140–200 ms color/opacity/transform transitions for selected navigation, reward availability, and success state.
- Point credit may briefly emphasize the updated balance; voucher issue may reveal the ticket with a short opacity/translate transition.
- No auto-playing decorative animation; respect `prefers-reduced-motion`.

## Accessibility
- Semantic landmarks and headings.
- Minimum 44x44 interactive targets; primary controls 48 px high.
- Visible keyboard focus.
- Status changes use `aria-live` without moving focus unexpectedly.
- Color is never the only status signal.
- QR always includes readable code and voucher title.

## Verification acceptance
- Mobile at 390–430 px and desktop at current viewport.
- No horizontal overflow or bottom-nav overlap.
- 0 points → activity submit → pending → verified/23 points → 20-point exchange → 3 points/active voucher → merchant redeem → used voucher.
- Consumer DOM contains none of the prohibited internal terms.
- Reviewer/merchant/admin functionality remains role-gated and functional.
- Concept/render comparison uses `view_image` on accepted concept and latest browser screenshot with at least five fidelity checks.

## Intentional concept-to-implementation clarifications
- Replace the generated realistic avatar on the first Home concept with initials or a neutral user icon.
- Generated Thai glyphs are visual guidance; code-native copy in this document is authoritative.
- Slightly reduce mobile Home title/balance vertical height to fit a practical first viewport.
- Use a real code-generated QR, not the raster concept QR.
- History/Profile/operator states extend the same approved primitives; no new consumer visual family is introduced.

## Approval scope requested
Exact approval of `DS@v1` authorizes implementation planning against this document and the listed concept set. It does not itself approve deployment or external actions.
