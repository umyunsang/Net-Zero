# Findings: net-zero-reward runtime review

## Prior context (navigation hint only)
- Memory records an earlier React/R3F Net-Zero City preview at `localhost:5199`, but explicitly says preview state is checkout-specific and must be reverified.

## Current findings
- The project is the monorepo rooted at `/Users/um-yunsang/Net-Zero`; the root package name is `net-zero-thailand` and contains `apps/web`, `apps/api`, `apps/worker`, `packages/domain`, and `packages/contracts`.
- The delivery has no `.git` directory, so branch, commit, and dirty-worktree state are not verifiable from this copy.
- Package contract: `pnpm@10.28.2`, Node `>=24 <27`. Current runtime is Node `v26.7.0` and pnpm `10.28.2`, both compatible.
- The web app is React 19 + Vite 7 PWA. Its documented local URL is `http://localhost:5173`; `/api` proxies to `http://localhost:3000`.
- The root validation surface provides `pnpm typecheck`, `pnpm build`, `pnpm test`, database-from-empty checks, and Playwright E2E.
- Runtime dependencies include PostgreSQL, MinIO, the NestJS/Fastify API, and Graphile Worker. The repository has `compose.yaml`, `.env`, installed `node_modules`, and a populated pnpm lockfile.
- No app process is currently listening on ports 3000, 5173, 5199, 4173, or 8787.
- Product boundary from README: this is a mock/synthetic demo only, not production readiness, carbon credit, offset, TGO endorsement, real-device proof, or real partner integration.
- `pnpm typecheck` passes across domain, contracts, API, web, and worker.
- `pnpm build` passes across all workspace projects. The web production bundle and PWA service worker are generated successfully; main JS is 237.31 kB (71.73 kB gzip).
- `pnpm test` exits 0: contracts 18/18, domain 23/23, worker 5/5, API unit/config/readiness 26/26, evidence-library 3/3. The web unit command has no source test files and is explicitly configured to pass; 43 database/integration API cases are skipped without the dedicated test database contract.
- Docker is available. The repository's PostgreSQL and MinIO services are already running and healthy.
- Playwright is configured for Chromium desktop and Pixel 7, Thai locale, Bangkok timezone, and `http://127.0.0.1:5173`. Its webServer starts only the web app, so the individual E2E flows must be inspected to determine whether API startup is separate.
- The E2E suite deterministically mocks `/api/**` and covers Thai role navigation, dashboard disclosures, claims, rewards, community consent, reviewer controls, merchant replay prevention, localized errors, admin readiness, and a synthetic device gate.
- `pnpm test:e2e` passes all 24 cases across desktop Chromium and Pixel 7 emulation.
- A pre-existing isolated `netzero_test` database allowed the full integration contract to run without touching the demo database.
- `TEST_DATABASE_URL=.../netzero_test pnpm test` passes with API 63/63 and no skipped API tests. The logged `calculation_id` database error is intentionally induced by the rollback test; that test and the full suite pass.
- `pnpm dev` starts the web app, API, and worker successfully. The worker connects to PostgreSQL and begins polling registered jobs.
- Live checks: web root returns HTTP 200; `/health/live` returns `status=ok`; `/health/ready` reports `operational`, `dataScope=mock_demo`, `mockDemoEnabled=true`, and correctly keeps `productionReady=false`.
- Codex in-app Browser is available and connected to the local app. Initial identity: URL `http://127.0.0.1:5173/`, title `ก้าวลดคาร์บอน`.
- Initial Thai login page is meaningful and visibly contains the explicit mock-demo and non-carbon-credit boundaries; there is no framework overlay and no browser warning/error log.
- Primary interaction proof passes: selecting `ผู้ใช้งาน` renders `ภาพรวมที่ตรวจสอบย้อนกลับได้` with the five expected navigation controls and live API-backed zero-state metrics; browser warning/error log remains empty.
- Desktop QA at 1280x800: all five nav controls are present, the two-column dashboard renders, document width equals viewport width, no horizontal overflow, and warning/error log is empty.
- Mobile QA at 412x915: all five nav controls remain inside the viewport, cards stack vertically, document width equals viewport width, no horizontal overflow, and warning/error log is empty.
- Actual API-backed rewards navigation succeeds after load and shows two demo rewards (40 and 20 points) with the no-real-payment disclosure. No redemption was triggered, so no points or voucher state was mutated.
- Server receipts confirm the browser flow reached the real local API: demo login 201; dashboard, rewards, and vouchers all 200. The worker also completed scheduled evaluation and orphan-upload cleanup tasks successfully.
- The app is returned to the user dashboard for handoff. Browser warning/error log remains empty.
- Desktop and mobile screenshot evidence is stored outside the repository under the Codex visualization workspace.
- Screenshot files were read back as non-empty (desktop 23K, mobile 46K). No product source or migration file has a current-session modification timestamp.
- The live dashboard tab was finalized as a Codex deliverable and remains open; the dev server session remains active.
