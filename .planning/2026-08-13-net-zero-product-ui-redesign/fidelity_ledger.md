# Fidelity ledger: Phase 7 DS@v1 restoration

## Authority
- Final visual authority: the seven original PNGs under `/Users/um-yunsang/.codex/generated_images/019ff90e-4437-7c40-a473-5553a64d6af9/` explicitly re-declared by the user.
- Design contract: `design_DS_v1.md`, SHA-256 `6607e306dcb68870a5e892b69073216342a8f979e78ca47aeeabe2c78e478f13`.
- The Phase 4 and Phase 6 visual sign-offs are superseded. Functional evidence from those phases remains valid where rerun.

## Locked design checks
| Surface | Approved requirement | Current implementation status |
|---|---|---|
| Canvas and palette | True white, deep forest green, orange only for progress/reward state | Implemented; no cream, gradient card field, or shadow layer |
| Consumer shell | Four bottom destinations on mobile; 230–250 px left rail on desktop | Implemented with four destinations and 248 px rail |
| Home | Approved first-activity heading, bordered balance module, one CTA, three activity rows, reward/recent column | Implemented with approved labels and responsive composition |
| Wallet and voucher | Green balance band, bordered reward rows, voucher ticket/QR and terminal variants | Preserved without changing ledger or voucher semantics |
| Leaderboard | Secondary Home/Profile flow, never a fifth primary navigation destination | Rebuilt through Open Design and implemented as a separate screen |
| Illustration | Thin green 2 px domain linework and local SVG assets | Preserved; no runtime image/CDN dependency |
| Typography | TH/EN/KO local stacks, 26/32 mobile title, 30/38 desktop title, 18/26 section title, 16/24 row title | Implemented and statically audited |
| Numeric hierarchy | Tabular lining numerals for points, ranks, and costs | Implemented |
| Thai setting | No negative Thai tracking, faux weights, clipped line boxes, or aggressive word breaks | Rendered at 390, 430, and 1440 px with no clipping or horizontal overflow |
| Brand | Latest user-approved invariant project name `Net Zero` in every language | Preserved as the explicit newer override; it supersedes the Thai reference wordmark only |

## Open Design evidence
- Project: `net-zero-rewards-ds-v1-leaderboard`.
- Deliverable: `net-zero-weekly-leaderboard.html`.
- Final SHA-256: `8fd7e4718bc764fe98a962af64473f3a8b3d9f31e4efae4ea7bc364ca668da66`.
- The artifact contains Home preview → full list → current row → opt-out confirmation → still-visible community list → rejoin/back.
- Static checks pass for TH/EN/KO stacks, 500/600/700 weights, tabular numerals, 390/430/1024/1440 contracts, four-item navigation, and prohibited-copy scan.
- Open Design image export is not visual evidence: it failed with `UPSTREAM_UNAVAILABLE` because the local desktop renderer socket was absent. Product browser inspection remains the rendered acceptance surface.

## Current verification
- Repository typecheck, build, unit tests, and whitespace checks pass.
- Translation audit: 207 statically used Thai keys, zero missing in English, zero missing in Korean.
- Playwright: 30/30 across Chromium desktop and Pixel 7, including the invariant `Net Zero` wordmark, separate leaderboard, and opt-out recovery flow.
- Database: fresh 001–003 migration verification passes 3/3; demo separation and full flow pass 10/10 with tree 15 + recycling 20 + bus 3 = 38 points.
- In-app product rendering passes at 390, 430, and 1440 px: no horizontal overflow, four primary destinations, 248 px desktop rail, 1180 px content cap, and 320 px leaderboard participation card.
- Rendered typography passes for TH/EN/KO local stacks, mobile 26/32.5 and desktop 30/38.1 titles, 16/24 activity and reward titles, tabular ranks/points, and Korean keep-all headings.
- The deterministic demo is reset to 0 points; Home still shows all eight community mock rows through Top 3 plus a 0-point joined viewer preview.
- Korean Wallet responsive correction: the 1024 px reward-card copy track is 142 px instead of 0 px, the card returns from 386 px to 164 px height, and 390/1024/1440 px rendered checks all retain word-level copy with zero horizontal overflow.

## Current decision
- Phase 7 implementation, interaction, typography, responsive, database, and rendered product-browser gates pass.
- Open Design's unavailable standalone image export remains an evidence limit only for that auxiliary artifact; the integrated product was rendered and inspected directly.
