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
    decided_at: null,
    awarded_points: status === "verified" ? 25 : 0,
    impacts: [],
    evidence_ids: [`evidence-${id}`],
  },
});

async function mockApi(page: Page, options: {
  reviewClaims?: ReturnType<typeof claim>[];
  dashboardPoints?: number;
  dashboardClaims?: Array<{ id: string; activity: "bus" | "recycling" | "tree"; state: "submitted" | "pending" | "pending_review" | "verified" | "rejected"; submitted_at: string }>;
  dashboardVouchers?: Array<{ id: string; title_th: string; state: "issued" | "redeemed" | "expired" | "cancelled"; issued_at: string; expires_at: string }>;
  vouchers?: Array<{ voucherId: string; code: string; state: "issued" | "redeemed" | "expired" | "cancelled"; titleThai: string; expiresAt: string }>;
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
    if (path === "/claims") return json({ items: [claim("submitted", "submitted"), claim("pending", "pending"), claim("review", "pending_review"), claim("verified", "verified"), claim("rejected", "rejected")] });
    if (path.startsWith("/review/claims?") || path === "/review/claims") return json({ items: options.reviewClaims ?? [] });
    if (path.startsWith("/review/claims/") && method === "PATCH") return json({});
    if (path.startsWith("/evidence/") && path.endsWith("/content")) return options.evidenceOpenFails ? json({ code: "NOT_FOUND" }, 404) : route.fulfill({ status: 200, contentType: "image/jpeg", body: "fixture" });
    if (path === "/rewards") return json({ items: [{ rewardId: "coffee", titleThai: "กาแฟสาธิต", pointsCost: 20, active: true }] });
    if (path === "/rewards/vouchers" && method === "GET") return json(options.vouchers ?? []);
    if (path === "/rewards/vouchers" && method === "POST") return json({ voucher: { voucherId: "voucher-1", code: "DEMO-0001", state: "issued", titleThai: "กาแฟสาธิต", expiresAt: "2026-08-19T00:00:00.000Z" } });
    if (path === "/leaderboard/weekly") {
      if (leaderboardConsentUpdated && options.leaderboardRefreshFailsAfterConsent) {
        return json({ code: "INTERNAL_ERROR" }, 503);
      }
      return json({
      data_scope: options.leaderboardMalformed ? "unknown" : "demo",
      is_mock: true,
      demo_only: true,
      viewer: { opted_in: leaderboardOptedIn, pseudonym_th: leaderboardOptedIn ? "เมฆสีเขียว" : null },
      entries: leaderboardOptedIn ? [{ rank: 1, pseudonym_th: "เมฆสีเขียว", weekly_points: 40 }] : [],
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
    return json({});
  });
}

async function login(page: Page, role: "ผู้ใช้งาน" | "ผู้ตรวจสอบ" | "ร้านค้า" | "ผู้ดูแล") {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

test("Thai login surfaces expose only each role's allowed navigation", async ({ page }) => {
  await mockApi(page);
  const cases = [
    ["ผู้ใช้งาน", "ภาพรวมที่ตรวจสอบย้อนกลับได้", ["ภาพรวม", "บันทึก", "คำขอ", "รางวัล", "ชุมชน"]],
    ["ผู้ตรวจสอบ", "คิวตรวจหลักฐาน", ["คิวตรวจ"]],
    ["ร้านค้า", "ใช้หรือยกเลิกบัตรรางวัล", ["ร้านค้า"]],
    ["ผู้ดูแล", "ปัจจัยคำนวณแบบปิดเมื่อไม่พร้อม", ["ปัจจัย", "คิวตรวจ"]],
  ] as const;

  for (const [role, heading, links] of cases) {
    await login(page, role);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("button")).toHaveText(links);
    await expect(page.getByText("ภาษาไทยเท่านั้น")).toBeVisible();
    await expect(page.locator('select[name="language"], [aria-label*="language" i]')).toHaveCount(0);
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  }
});

test("ผู้ตรวจสอบเห็นข้อผิดพลาดภาษาไทยเมื่อเปิดหลักฐานจำลองไม่สำเร็จ", async ({ page }) => {
  await mockApi(page, { reviewClaims: [claim("open-error", "pending", "tree")], evidenceOpenFails: true });
  await login(page, "ผู้ตรวจสอบ");
  await page.getByRole("button", { name: /เปิดหลักฐาน/ }).click();
  await expect(page.getByRole("alert")).toHaveText("เปิดหลักฐานไม่ได้");
});

test("user dashboard separates impact categories and retains required disclosures", async ({ page }) => {
  await mockApi(page);
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByText("CO₂e ที่หลีกเลี่ยงโดยประมาณ")).toBeVisible();
  await expect(page.getByText("การกักเก็บหนึ่งปีที่คาดการณ์ไว้")).toBeVisible();
  await expect(page.getByText("ไม่ใช่คาร์บอนเครดิต การชดเชย หรือการรับรองโดย อบก.")).toBeVisible();
});

test("0-point dashboard explains all three earn paths and locks an unaffordable reward", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 0 });
  await login(page, "ผู้ใช้งาน");

  const journey = page.getByRole("region", { name: "จาก 0 คะแนนสู่รางวัล" });
  await expect(journey).toBeVisible();
  await expect(journey.getByLabel("เป้าหมายรางวัลแรก 20 คะแนน").getByText("0 / 20")).toBeVisible();
  await expect(journey.getByText("ยังขาด 20 คะแนน")).toBeVisible();
  await expect(journey.getByRole("heading", { name: "เดินทางด้วยรถโดยสาร" })).toBeVisible();
  await expect(journey.getByRole("heading", { name: "นำขวด PET ไปส่ง" })).toBeVisible();
  await expect(journey.getByRole("heading", { name: "ปลูกต้นไม้" })).toBeVisible();
  await expect(journey.getByText("ตัวอย่างเดโม: 46 ขวดที่อนุมัติ = 20 คะแนน")).toBeVisible();
  await expect(journey.getByText("ตัวอย่างเดโม: 1 ต้นที่ผ่าน = 23 คะแนน")).toBeVisible();
  await expect(journey.getByText("เส้นทางเดโมระยะสั้นอาจผ่านการตรวจแต่ได้ 0 คะแนน")).toBeVisible();

  await journey.getByRole("button", { name: "ดูรางวัลและคะแนนที่ต้องใช้" }).click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByText("ขาดอีก 20 คะแนน")).toBeVisible();
  await expect(page.getByRole("button", { name: "แลกและออกบัตร" })).toBeDisabled();
});

test("23 points issue a 20-point voucher and update the visible balance to 3", async ({ page }) => {
  await mockApi(page, { dashboardPoints: 23 });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "รางวัล" }).click();

  const issue = page.getByRole("button", { name: "แลกและออกบัตร" });
  await expect(issue).toBeEnabled();
  await issue.click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("ออกบัตรแล้ว คะแนนคงเหลืออัปเดตแล้ว")).toBeVisible();
  await expect(page.getByText("รหัส DEMO-0001")).toBeVisible();
});

test("a persisted redeemed voucher renders its terminal used state", async ({ page }) => {
  await mockApi(page, {
    dashboardPoints: 3,
    vouchers: [{ voucherId: "voucher-1", code: "DEMO-0001", state: "redeemed", titleThai: "กาแฟสาธิต", expiresAt: "2026-08-19T00:00:00.000Z" }],
  });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "รางวัล" }).click();
  const voucherList = page.getByRole("heading", { name: "บัตรของฉัน" }).locator("..");
  await expect(voucherList.getByText("กาแฟสาธิต")).toBeVisible();
  await expect(voucherList.getByText("ใช้แล้ว", { exact: true })).toBeVisible();
  await expect(voucherList.getByText("รหัส DEMO-0001")).toBeVisible();
});

test("user claim, reward, and opt-in leaderboard surfaces use Thai product copy", async ({ page }) => {
  await mockApi(page);
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "คำขอ" }).click();
  for (const label of ["รับคำขอแล้ว", "รอข้อมูลหรือการตรวจ", "รอผู้ตรวจสอบ", "ผ่าน", "ไม่ผ่าน"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByText("รีไซเคิล", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ผลกระทบ: บันทึกผลกระทบแล้ว/).first()).toBeVisible();
  await expect(page.getByText("ข้อมูลสำหรับตรวจรถโดยสารยังไม่ครบ")).toBeVisible();
  await expect(page.getByText("bus_metric_unavailable")).toHaveCount(0);

  await page.getByRole("button", { name: "รางวัล" }).click();
  await page.getByRole("button", { name: "แลกและออกบัตร" }).click();
  await expect(page.getByText("รหัส DEMO-0001")).toBeVisible();
  await expect(page.getByText("ออกบัตรแล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ชุมชน" }).click();
  await expect(page.getByText("ขอบเขตข้อมูล: สาธิต")).toBeVisible();
  await expect(page.getByText("สมัครใจและใช้เฉพาะคะแนนจากกิจกรรมที่ผ่านการตรวจ")).toBeVisible();
  await page.getByRole("checkbox", { name: "เข้าร่วมด้วยนามแฝง" }).check();
});

test("leaderboard hydrates persisted consent and withdraws in one action", async ({ page }) => {
  await mockApi(page, { leaderboardOptedIn: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ชุมชน" }).click();
  const consent = page.getByRole("checkbox", { name: "เข้าร่วมด้วยนามแฝง" });
  await expect(consent).toBeChecked();
  await expect(page.getByText("เมฆสีเขียว")).toBeVisible();
  await consent.uncheck();
  await expect(consent).not.toBeChecked();
  await expect(page.getByText("เมฆสีเขียว")).toHaveCount(0);
});

test("leaderboard keeps committed opt-out when the refresh fails", async ({ page }) => {
  await mockApi(page, { leaderboardOptedIn: true, leaderboardRefreshFailsAfterConsent: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ชุมชน" }).click();
  const consent = page.getByRole("checkbox", { name: "เข้าร่วมด้วยนามแฝง" });
  await expect(consent).toBeChecked();
  await consent.uncheck();
  await expect(consent).not.toBeChecked();
  await expect(page.getByText("เมฆสีเขียว")).toHaveCount(0);
  await expect(page.getByText("บันทึกความยินยอมแล้ว แต่โหลดอันดับล่าสุดไม่สำเร็จ")).toBeVisible();
});

test("leaderboard rejects an unknown data scope instead of masking it as demo", async ({ page }) => {
  await mockApi(page, { leaderboardMalformed: true });
  await login(page, "ผู้ใช้งาน");
  await page.getByRole("button", { name: "ชุมชน" }).click();
  await expect(page.getByText("ข้อมูลอันดับจากระบบไม่ถูกต้อง")).toBeVisible();
  await expect(page.getByText("ขอบเขตข้อมูล: สาธิต")).toHaveCount(0);
});

test("reviewer can decide tree and recycling but cannot bypass the bus oracle", async ({ page }) => {
  const decisions: unknown[] = [];
  await mockApi(page, { reviewClaims: [claim("approve", "pending", "tree"), claim("reduce", "pending", "recycling"), claim("reject", "pending_review", "bus")] });
  await page.route("**/api/review/claims/*", async (route: Route) => {
    decisions.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: "{}" });
  });
  await login(page, "ผู้ตรวจสอบ");
  await page.getByRole("button", { name: "อนุมัติ" }).first().click();
  await expect.poll(() => decisions.length).toBe(1);
  await page.getByRole("spinbutton", { name: "จำนวนที่อนุมัติ" }).fill("2");
  await page.getByRole("button", { name: "ลดจำนวน" }).click();
  await expect.poll(() => decisions.length).toBe(2);
  await expect(page.getByText("รายการรถโดยสารต้องผ่านกฎตรวจอัตโนมัติครบทุกข้อ ผู้ตรวจสอบไม่สามารถเปลี่ยนรายการนี้เป็นสถานะผ่านได้")).toBeVisible();
  await expect(page.getByRole("button", { name: "ปฏิเสธ" })).toHaveCount(0);
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
  await expect(page.getByLabel("หลักฐานการใช้บัตร").getByText(/รหัส DEMO-0001/)).toBeVisible();
  await code.fill("DEMO-0001");
  await page.getByRole("button", { name: "ตรวจและใช้สิทธิ์" }).click();
  await expect(page.getByRole("alert")).toHaveText("บัตรรางวัลนี้ถูกใช้แล้ว");
});

test("client maps API failures to Thai without exposing server text", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    if (path === "/auth/demo-login") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ accessToken: "token" }) });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Internal database failure in English" }),
    });
  });
  await login(page, "ผู้ใช้งาน");
  await expect(page.getByRole("alert")).toHaveText("ระบบขัดข้องชั่วคราว กรุณาลองใหม่");
  await expect(page.getByText("Internal database failure in English")).toHaveCount(0);
});

test("admin requires review confirmation and shows separated mock and production readiness", async ({ page }) => {
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
  const readiness = page.getByRole("heading", { name: "สถานะความพร้อมของเดโมจำลอง" }).locator("..");
  await expect(readiness.getByText("รถโดยสาร", { exact: true })).toBeVisible();
  await expect(readiness.getByText("รีไซเคิล", { exact: true })).toBeVisible();
  await expect(readiness.getByText("ปลูกต้นไม้", { exact: true })).toBeVisible();
  await expect(readiness.locator("pre")).toHaveCount(0);
  await expect(page.getByText("ฉบับร่างสำหรับใช้งานจริง", { exact: true })).toBeVisible();
  await expect(page.getByText("อนุมัติเดโมจำลอง", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "ส่งตรวจทานเดโมจำลอง" }).click();
  await expect(page.getByRole("alert")).toHaveText("ต้องยืนยันการตรวจทานครบทุกหัวข้อก่อนส่งตรวจทานเดโมจำลอง");
  await page.getByRole("checkbox", { name: /ตรวจทานค่า หน่วย/ }).check();
  await page.getByRole("button", { name: "ส่งตรวจทานเดโมจำลอง" }).click();
  await expect.poll(() => approvals).toEqual(["PATCH"]);
});
