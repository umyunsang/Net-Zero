import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-12T00:00:00.000Z";
const claim = (id: string, status: "submitted" | "pending" | "pending_review" | "verified" | "rejected", activity: "bus" | "recycling" | "tree" = "recycling") => ({
  claim: {
    id,
    activity,
    status,
    impact_status: status === "verified" ? "credited" : "pending",
    data_scope: "mock_demo",
    is_mock: true,
    is_synthetic: true,
    demo_only: true,
    fixture_id: "FIXTURE-BKK-20260812-01",
    reason_code: status === "pending"
      ? "bus_metric_unavailable"
      : status === "pending_review"
        ? "recycling_pending_review"
        : status === "verified"
          ? "reviewer_confirmed"
          : status === "rejected"
            ? "reviewer_rejected"
            : "submitted",
    submitted_at: now,
    decided_at: status === "verified" ? now : null,
    awarded_points: status === "verified" ? 25 : 0,
    impacts: status === "verified" ? [{ kg_co2e: "2.50", impact_type: "avoided" }] : [],
    evidence_ids: [`evidence-${id}`],
  },
});

async function mockApi(page: Page, options: {
  reviewClaims?: ReturnType<typeof claim>[];
  dashboardPoints?: number;
  dashboardClaims?: Array<{ id: string; activity: "bus" | "recycling" | "tree"; state: "submitted" | "pending" | "pending_review" | "verified" | "rejected"; submitted_at: string }>;
  dashboardVouchers?: Array<{ id: string; title_th: string; state: "issued" | "redeemed" | "expired" | "cancelled"; issued_at: string; expires_at: string }>;
  vouchers?: Array<{ voucherId: string; code: string; state: "issued" | "redeemed" | "expired" | "cancelled"; titleThai: string; expiresAt: string; redeemedAt?: string | null }>;
  factorDraft?: boolean;
  leaderboardOptedIn?: boolean;
  leaderboardMalformed?: boolean;
  leaderboardRefreshFailsAfterConsent?: boolean;
  evidenceOpenFails?: boolean;
} = {}) {
  let voucherUsed = false;
  let leaderboardOptedIn = options.leaderboardOptedIn ?? false;
  let leaderboardConsentUpdated = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api", "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/auth/demo-login" && method === "POST") return json({ accessToken: "deterministic-token" });
    if (path === "/dashboard") return json({
      data_scope: "mock_demo",
      is_mock: true,
      demo_only: true,
      points: options.dashboardPoints ?? 120,
      pending_count: 2,
      personal: { estimated_avoided_co2e: "12.50", projected_sequestration_co2e: "3.00" },
      community: { estimated_avoided_co2e: "100", projected_sequestration_co2e: "20" },
      recent_claims: options.dashboardClaims ?? [],
      recent_vouchers: options.dashboardVouchers ?? [],
    });
    if (path === "/claims") return json({ items: [claim("submitted", "submitted"), claim("pending", "pending", "bus"), claim("review", "pending_review"), claim("verified", "verified", "tree"), claim("rejected", "rejected")] });
    if (path === "/review/claims") return json({ items: options.reviewClaims ?? [] });
    if (path.startsWith("/review/claims/") && method === "PATCH") return json({});
    if (path.startsWith("/evidence/") && path.endsWith("/content")) return options.evidenceOpenFails ? json({ code: "NOT_FOUND" }, 404) : route.fulfill({ status: 200, contentType: "image/jpeg", body: "fixture" });
    if (path === "/rewards") return json({ items: [
      { rewardId: "product", titleThai: "ส่วนลดสินค้า 20 บาท", pointsCost: 20, active: true },
      { rewardId: "drink", titleThai: "ส่วนลดเครื่องดื่ม 40 บาท", pointsCost: 40, active: true },
    ] });
    if (path === "/rewards/vouchers" && method === "GET") return json(options.vouchers ?? []);
    if (path === "/rewards/vouchers" && method === "POST") return json({ voucher: { voucherId: "voucher-1", code: "DEMO-0001", state: "issued", titleThai: "ส่วนลดสินค้า 20 บาท", expiresAt: "2026-08-19T00:00:00.000Z" } });
    if (path === "/leaderboard/weekly") {
      if (leaderboardConsentUpdated && options.leaderboardRefreshFailsAfterConsent) return json({ code: "INTERNAL_ERROR" }, 503);
      return json({
        week_starts_at: "2026-08-10T00:00:00.000Z",
        data_scope: options.leaderboardMalformed ? "unknown" : "demo",
        is_mock: true,
        demo_only: true,
        viewer: { opted_in: leaderboardOptedIn, pseudonym_th: leaderboardOptedIn ? "เมฆสีเขียว" : null },
        entries: [
          { rank: 1, pseudonym_th: "ใบไม้ยามเช้า", weekly_points: 75 },
          { rank: 2, pseudonym_th: "สายลมเจ้าพระยา", weekly_points: 63 },
          { rank: 3, pseudonym_th: "สวนเล็กกลางเมือง", weekly_points: 48 },
          ...(leaderboardOptedIn ? [{ rank: 4, pseudonym_th: "เมฆสีเขียว", weekly_points: 40 }] : []),
          { rank: leaderboardOptedIn ? 5 : 4, pseudonym_th: "รถเมล์สีเขียว", weekly_points: 39 },
          { rank: leaderboardOptedIn ? 6 : 5, pseudonym_th: "เมล็ดพันธุ์วันใหม่", weekly_points: 30 },
          { rank: leaderboardOptedIn ? 7 : 6, pseudonym_th: "เพื่อนโลกหมายเลขเจ็ด", weekly_points: 24 },
          { rank: leaderboardOptedIn ? 8 : 7, pseudonym_th: "คลองใสใจดี", weekly_points: 18 },
          { rank: leaderboardOptedIn ? 9 : 8, pseudonym_th: "ต้นกล้าริมทาง", weekly_points: 12 },
        ],
        community_totals: {
          estimated_avoided_co2e: "100",
          projected_sequestration_co2e: "20",
          verified_weekly_points: 309,
        },
      });
    }
    if (path === "/leaderboard/consent") {
      leaderboardOptedIn = Boolean((request.postDataJSON() as { optedIn?: boolean }).optedIn);
      leaderboardConsentUpdated = true;
      return json({ opted_in: leaderboardOptedIn, pseudonym_th: leaderboardOptedIn ? "เมฆสีเขียว" : null });
    }
    if (path === "/merchant/vouchers/scan") {
      if (voucherUsed) return json({ code: "VOUCHER_ALREADY_REDEEMED", message: "English provider text must not leak" }, 409);
      voucherUsed = true;
      return json({ status: "redeemed", voucherId: "voucher-1" });
    }
    if (path.startsWith("/merchant/vouchers/") && path.endsWith("/cancel")) return json({});
    if (path === "/admin/factors") return json({ items: options.factorDraft ? [{ id: "factor-1", activity: "bus", code: "BUS-1", version: "1", value: "0.1", unit: "kg", source_url: "https://example.test/factor", methodology_code: "MVP", disclaimer_th: "ค่าประมาณ", proxy_copy_th: "คำอธิบาย", status: "draft", mock_approval_scope: null, mock_is_mock: null, mock_demo_only: null }] : [] });
    if (path === "/admin/factors/demo-readiness") return json({
      mockDemoReady: false,
      readinessKind: "factor-prerequisites-only",
      databaseScope: "mock_demo",
      productionFactorsReady: true,
      productionReady: false,
      tgoEndorsed: false,
      physicalEvidence: false,
      activities: {
        bus: { ready: false, factorId: "factor-1", approvalScope: "mock_demo", isMock: true, demoOnly: true },
        recycling: { ready: false, factorId: "factor-2", approvalScope: "mock_demo", isMock: true, demoOnly: true },
        tree: { ready: false, factorId: "factor-3", approvalScope: "mock_demo", isMock: true, demoOnly: true },
      },
    });
    if (path === "/admin/factors/factor-1/approve") return json({});
    if (path === "/account" && method === "DELETE") return route.fulfill({ status: 204 });
    return json({});
  });
}

async function login(page: Page, role: "ผู้ใช้งาน" | "ผู้ตรวจสอบ" | "ร้านค้า" | "ผู้ดูแล") {
  await page.goto("/");
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  if (role === "ผู้ใช้งาน") return;
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByText("สลับบทบาทสาธิต", { exact: true }).click();
  await page.getByRole("button", { name: role, exact: true }).click();
}

test("consumer-first entry and role workspaces expose only their allowed navigation", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByRole("heading", { name: "เริ่มกิจกรรมแรกของคุณ" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["หน้าแรก", "ทำกิจกรรม", "กระเป๋า", "ฉัน"]);
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByText("สลับบทบาทสาธิต", { exact: true }).click();
  await page.getByRole("button", { name: "ผู้ตรวจสอบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "คิวตรวจหลักฐาน" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["คิวตรวจ"]);
  await page.getByRole("button", { name: "กลับไปแอปผู้ใช้" }).click();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["หน้าแรก", "ทำกิจกรรม", "กระเป๋า", "ฉัน"]);
});

test("header language control switches Thai, English, and Korean immediately and persists", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await page.goto("/");
  await expect(page.getByLabel("Net Zero")).toHaveText("Net Zero");
  const languageTrigger = page.getByRole("button", { name: "ภาษา" });
  await expect(page.getByRole("combobox", { name: "ภาษา" })).toHaveCount(0);
  const triggerBox = await languageTrigger.boundingBox();
  expect(triggerBox?.width).toBeLessThanOrEqual(52);
  expect(triggerBox?.height).toBeLessThanOrEqual(36);
  await languageTrigger.click();
  await page.getByRole("menuitemradio", { name: "EN" }).click();
  await expect(page.getByLabel("Net Zero")).toHaveText("Net Zero");
  await expect(page.getByRole("heading", { name: "Cut carbon. Earn points." })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["Home", "Activities", "Wallet", "Me"]);
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "한국어" }).click();
  await expect(page.getByLabel("Net Zero")).toHaveText("Net Zero");
  await expect(page.getByRole("heading", { name: "첫 활동을 시작하세요" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["홈", "활동", "지갑", "내 정보"]);
  await page.reload();
  await expect(page.getByLabel("Net Zero")).toHaveText("Net Zero");
  await expect(page.getByRole("heading", { name: "탄소를 줄이고 포인트를 받으세요" })).toBeVisible();
});

test("welcome reuses the centred Fable 3D city across cover ratios", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await page.goto("/");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 384, height: 824 },
    { width: 768, height: 600 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const scene = page.locator(".welcome-scene");
    await expect(scene.locator("canvas")).toBeVisible();
    const metrics = await scene.evaluate((element) => {
      const container = element.getBoundingClientRect();
      const motif = element.querySelector<HTMLElement>(".city-motif")?.getBoundingClientRect();
      const canvas = element.querySelector<HTMLCanvasElement>("canvas");
      const surface = canvas?.getBoundingClientRect();
      return {
        height: container.height,
        surfaceWidth: surface?.width ?? 0,
        surfaceHeight: surface?.height ?? 0,
        rendererWidth: canvas?.width ?? 0,
        rendererHeight: canvas?.height ?? 0,
        centerDelta: motif ? Math.abs((container.left + container.width / 2) - (motif.left + motif.width / 2)) : Number.POSITIVE_INFINITY,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(metrics.height).toBeGreaterThanOrEqual(149);
    expect(metrics.surfaceWidth).toBeGreaterThanOrEqual(275);
    expect(metrics.surfaceHeight).toBeGreaterThanOrEqual(149);
    expect(metrics.rendererWidth).toBeGreaterThan(0);
    expect(metrics.rendererHeight).toBeGreaterThan(0);
    expect(metrics.centerDelta).toBeLessThanOrEqual(1);
    expect(metrics.overflow).toBe(0);
  }
  const interactiveCity = page.locator(".welcome-scene .city-motif");
  await expect(interactiveCity).toHaveAttribute("data-interactive", "true");
  await interactiveCity.hover();
  await expect(interactiveCity).toHaveAttribute("data-hovered", "true");
  await page.mouse.move(0, 0);
  await expect(interactiveCity).toHaveAttribute("data-hovered", "false");
  await interactiveCity.locator("canvas").click();
  await expect(interactiveCity).toHaveAttribute("data-replaying", "true");
  await expect(interactiveCity).toHaveAttribute("data-replaying", "false", { timeout: 2_000 });
});

test("1024px home keeps the score hierarchy readable beside the secondary column", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByLabel("คะแนนของคุณ")).toBeVisible();
  const layout = await page.evaluate(() => {
    const copy = document.querySelector<HTMLElement>(".balance-copy");
    const hero = document.querySelector<HTMLElement>(".home-hero");
    const secondary = document.querySelector<HTMLElement>(".home-secondary-grid");
    return {
      copyWidth: copy?.getBoundingClientRect().width ?? 0,
      heroWidth: hero?.getBoundingClientRect().width ?? 0,
      secondaryWidth: secondary?.getBoundingClientRect().width ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(layout.copyWidth).toBeGreaterThanOrEqual(110);
  expect(layout.heroWidth).toBeGreaterThanOrEqual(420);
  expect(layout.secondaryWidth).toBeGreaterThanOrEqual(280);
  expect(layout.overflow).toBe(0);
});

test("activity hub retains all three Fable scenes without horizontal overflow", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  const scenes = page.locator(".activity-scene");
  await expect(scenes).toHaveCount(3);
  const sceneSizes = await scenes.evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  for (const scene of sceneSizes) {
    expect(scene.width).toBeGreaterThan(280);
    expect(scene.height).toBeGreaterThanOrEqual(80);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("home activity cards use the same three Fable illustrations as the activity hub", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  const homeScenes = page.locator(".activity-list .activity-scene");
  await expect(homeScenes).toHaveCount(3);
  await expect(homeScenes).toHaveClass([/bus/, /recycling/, /tree/]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("consumer home hides internal requirements while keeping the three earn paths visible", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByLabel("คะแนนของคุณ").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByText("อีก 20 คะแนน รับส่วนลด 20 บาท")).toBeVisible();
  for (const label of ["ขึ้นรถโดยสาร", "ส่งรีไซเคิล", "ปลูกต้นไม้"]) await expect(page.getByRole("button", { name: new RegExp(label) }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const body = page.locator("body");
  for (const term of ["mock_demo", "fixture_id", "factor", "idempotency", "atomic", "RBAC", "GPS สังเคราะห์", "วิธีวิทยา"]) await expect(body).not.toContainText(term);
});

test("0-point wallet locks rewards contextually without a presentation explainer", async ({ page }, testInfo) => {
  if (testInfo.project.name === "chromium-desktop") await page.setViewportSize({ width: 1024, height: 900 });
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "กระเป๋า", exact: true }).click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByText("อีก 20 คะแนน", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "แลกรางวัล", exact: true })).toHaveCount(0);
  await expect(page.getByText("คะแนนจะถูกใช้เมื่อออกบัตรสำเร็จ")).toBeVisible();
  await expect(page.getByText("คะแนนเชื่อมกับบัตรอย่างไร")).toHaveCount(0);
  await page.getByRole("button", { name: "ภาษา" }).click();
  await page.getByRole("menuitemradio", { name: "한국어" }).click();
  const firstReward = page.locator(".reward-card").first();
  await expect(firstReward.getByRole("heading", { name: "상품 20바트 할인" })).toBeVisible();
  const rewardLayout = await firstReward.evaluate((card) => {
    const copy = card.children.item(1) as HTMLElement | null;
    const title = card.querySelector("h3");
    return {
      columns: getComputedStyle(card).gridTemplateColumns,
      copyWidth: copy?.getBoundingClientRect().width ?? 0,
      titleHeight: title?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(rewardLayout.columns).not.toContain("0px");
  expect(rewardLayout.copyWidth).toBeGreaterThanOrEqual(120);
  expect(rewardLayout.titleHeight).toBeLessThanOrEqual(48);
});

test("23 points issue a 20-point voucher, leave 3 points, and render a code-derived QR", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 23 });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "กระเป๋า", exact: true }).click();
  await page.getByRole("button", { name: "แลกรางวัล", exact: true }).first().click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("ออกบัตรแล้ว")).toBeVisible();
  await page.getByRole("button", { name: /ส่วนลดสินค้า 20 บาท\s+พร้อมใช้/ }).click();
  await expect(page.getByRole("heading", { name: "บัตรของฉัน", exact: true })).toBeVisible();
  await expect(page.getByText("DEMO 0001")).toBeVisible();
  await expect(page.getByRole("img", { name: "คิวอาร์โค้ดบัตร DEMO-0001" })).toBeVisible();
  await expect(page.getByRole("button", { name: "แสดงให้ร้านค้า" })).toBeVisible();
});

test("a persisted redeemed voucher renders its terminal used state without a QR action", async ({ page }) => {
  await mockApi(page, {
    dashboardPoints: 3,
    vouchers: [{ voucherId: "voucher-1", code: "DEMO-0001", state: "redeemed", titleThai: "ส่วนลดสินค้า 20 บาท", expiresAt: "2026-08-19T00:00:00.000Z", redeemedAt: now }],
  });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "กระเป๋า", exact: true }).click();
  await page.getByRole("button", { name: /ส่วนลดสินค้า 20 บาท\s+ใช้แล้ว/ }).click();
  await expect(page.getByText("ใช้แล้ว", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("DEMO 0001")).toBeVisible();
  await expect(page.getByRole("button", { name: "แสดงให้ร้านค้า" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /คิวอาร์โค้ด/ })).toHaveCount(0);
});

test("activity history maps claim states and reasons to consumer Thai copy", async ({ page }) => {
  await mockApi(page);
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: "ดูประวัติกิจกรรม" }).click();
  for (const label of ["กำลังตรวจสอบ", "ผ่านการตรวจสอบ", "ต้องตรวจสอบอีกครั้ง"]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("ข้อมูลการเดินทางยังไม่ครบ กรุณารอตรวจสอบ")).toBeVisible();
  await expect(page.getByText("+25 คะแนน")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("bus_metric_unavailable");
  await expect(page.locator("body")).not.toContainText("FIXTURE-BKK");
});

test("weekly leaderboard keeps four-job navigation and confirms opt-out", async ({ page }) => {
  await mockApi(page, { leaderboardOptedIn: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByRole("button", { name: /อันดับประจำสัปดาห์/ }).click();
  await expect(page.getByRole("heading", { name: "อันดับประจำสัปดาห์" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveText(["หน้าแรก", "ทำกิจกรรม", "กระเป๋า", "ฉัน"]);
  await expect(page.locator(".full-list li")).toHaveCount(9);
  await expect(page.getByText("เมฆสีเขียว")).toBeVisible();
  await page.getByRole("button", { name: "ออกจากอันดับสัปดาห์นี้" }).click();
  const confirmation = page.getByRole("group", { name: "ออกจากอันดับประจำสัปดาห์?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "ออกจากอันดับ", exact: true }).click();
  await expect(page.getByText("คุณไม่ได้เข้าร่วมสัปดาห์นี้")).toBeVisible();
  await expect(page.getByText("เมฆสีเขียว")).toHaveCount(0);
  await expect(page.getByText("ใบไม้ยามเช้า").first()).toBeVisible();
});

test("leaderboard Fable city stays centred and visible across viewport ratios", async ({ page }) => {
  await mockApi(page, { leaderboardOptedIn: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByRole("button", { name: /อันดับประจำสัปดาห์/ }).click();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 393, height: 852 },
    { width: 640, height: 480 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const city = page.locator(".leaderboard-city");
    await city.scrollIntoViewIfNeeded();
    await expect(city.locator("canvas")).toBeVisible();
    const metrics = await city.evaluate((element) => {
      const container = element.getBoundingClientRect();
      const motif = element.querySelector<HTMLElement>(".city-motif")?.getBoundingClientRect();
      const canvas = element.querySelector<HTMLCanvasElement>("canvas");
      const surface = canvas?.getBoundingClientRect();
      return {
        containerHeight: container.height,
        motifWidth: motif?.width ?? 0,
        surfaceWidth: surface?.width ?? 0,
        surfaceHeight: surface?.height ?? 0,
        rendererWidth: canvas?.width ?? 0,
        rendererHeight: canvas?.height ?? 0,
        centerDelta: motif ? Math.abs((container.left + container.width / 2) - (motif.left + motif.width / 2)) : Number.POSITIVE_INFINITY,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(metrics.containerHeight).toBeGreaterThanOrEqual(157);
    expect(metrics.motifWidth).toBeGreaterThanOrEqual(220);
    expect(metrics.motifWidth).toBeLessThanOrEqual(481);
    expect(metrics.surfaceWidth).toBeGreaterThanOrEqual(220);
    expect(metrics.surfaceHeight).toBeGreaterThanOrEqual(157);
    expect(metrics.rendererWidth).toBeGreaterThan(0);
    expect(metrics.rendererHeight).toBeGreaterThan(0);
    expect(metrics.centerDelta).toBeLessThanOrEqual(1);
    expect(metrics.overflow).toBe(0);
  }
});

test("leaderboard keeps committed opt-out when the refresh fails", async ({ page }) => {
  await mockApi(page, { leaderboardOptedIn: true, leaderboardRefreshFailsAfterConsent: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByRole("button", { name: /อันดับประจำสัปดาห์/ }).click();
  await page.getByRole("button", { name: "ออกจากอันดับสัปดาห์นี้" }).click();
  await page.getByRole("group", { name: "ออกจากอันดับประจำสัปดาห์?" }).getByRole("button", { name: "ออกจากอันดับ", exact: true }).click();
  await expect(page.getByText("คุณไม่ได้เข้าร่วมสัปดาห์นี้")).toBeVisible();
  await expect(page.getByText("เมฆสีเขียว")).toHaveCount(0);
  await expect(page.getByText("บันทึกความยินยอมแล้ว แต่โหลดอันดับล่าสุดไม่สำเร็จ")).toBeVisible();
});

test("leaderboard rejects an unknown community data scope instead of masking it", async ({ page }) => {
  await mockApi(page, { leaderboardMalformed: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ฉัน", exact: true }).click();
  await page.getByRole("button", { name: /อันดับประจำสัปดาห์/ }).click();
  await expect(page.getByRole("alert")).toHaveText("ข้อมูลอันดับจากระบบไม่ถูกต้อง");
});

test("reviewer sees Thai evidence failure and cannot bypass the bus oracle", async ({ page }) => {
  const decisions: unknown[] = [];
  await mockApi(page, { reviewClaims: [claim("open-error", "pending", "tree"), claim("reduce", "pending", "recycling"), claim("bus", "pending_review", "bus")], evidenceOpenFails: true });
  await page.route("**/api/review/claims/*", async (route: Route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    decisions.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: "{}" });
  });
  await login(page, "ผู้ตรวจสอบ");
  await page.getByRole("button", { name: /เปิดหลักฐาน/ }).first().click();
  await expect(page.getByRole("alert")).toHaveText("เปิดหลักฐานไม่ได้");
  await page.getByRole("button", { name: "อนุมัติ" }).first().click();
  await page.getByRole("spinbutton", { name: "จำนวนที่อนุมัติ" }).fill("2");
  await page.getByRole("button", { name: "ลดจำนวน" }).click();
  await expect(page.getByText("รายการรถโดยสารต้องผ่านกฎตรวจอัตโนมัติครบทุกข้อ ผู้ตรวจสอบไม่สามารถเปลี่ยนรายการนี้เป็นสถานะผ่านได้")).toBeVisible();
  await expect.poll(() => decisions).toEqual([{ decision: "approve" }, { decision: "reduce", approvedItemCount: 2 }]);
});

test("merchant prevents a voucher from being scanned twice", async ({ page }) => {
  await mockApi(page);
  await login(page, "ร้านค้า");
  const code = page.getByRole("textbox", { name: "รหัสบัตร" });
  await code.fill("DEMO-0001");
  await page.getByRole("button", { name: "ตรวจและใช้สิทธิ์" }).click();
  await expect(page.getByRole("status")).toHaveText("ใช้สิทธิ์สำเร็จและปิดรหัสบัตรแล้ว");
  await expect(page.getByLabel("หลักฐานการใช้บัตร").getByText("ใช้แล้ว", { exact: true })).toBeVisible();
  await code.fill("DEMO-0001");
  await page.getByRole("button", { name: "ตรวจและใช้สิทธิ์" }).click();
  await expect(page.getByRole("alert")).toHaveText("บัตรรางวัลนี้ถูกใช้แล้ว");
});

test("client maps API failures to Thai without exposing server text", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    if (path === "/auth/demo-login") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ accessToken: "token" }) });
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Internal database failure in English" }) });
  });
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByRole("alert")).toHaveText("ระบบขัดข้องชั่วคราว กรุณาลองใหม่");
  await expect(page.getByText("Internal database failure in English")).toHaveCount(0);
});

test("admin requires review confirmation and shows separated readiness", async ({ page }) => {
  const approvals: string[] = [];
  await mockApi(page, { factorDraft: true });
  await page.route("**/api/admin/factors/factor-1/approve", async (route) => {
    approvals.push(route.request().method());
    await route.fulfill({ contentType: "application/json", body: "{}" });
  });
  await login(page, "ผู้ดูแล");
  await expect(page.getByText("ปัจจัยเดโมจำลองยังไม่พร้อม")).toBeVisible();
  await expect(page.getByText("ปัจจัยสำหรับใช้งานจริง: ครบเฉพาะปัจจัย")).toBeVisible();
  await expect(page.getByText(/ความพร้อมใช้งานจริง: ไม่พร้อม/)).toBeVisible();
  await page.getByRole("button", { name: "ส่งตรวจทานเดโมจำลอง" }).click();
  await expect(page.getByRole("alert")).toHaveText("ต้องยืนยันการตรวจทานครบทุกหัวข้อก่อนส่งตรวจทานเดโมจำลอง");
  await page.getByRole("checkbox", { name: /ตรวจทานค่า หน่วย/ }).check();
  await page.getByRole("button", { name: "ส่งตรวจทานเดโมจำลอง" }).click();
  await expect.poll(() => approvals).toEqual(["PATCH"]);
});
