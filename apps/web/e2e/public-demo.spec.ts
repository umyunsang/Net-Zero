import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();
}

async function openActivities(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
}

async function completeBus(page: Page) {
  await openActivities(page);
  await page.getByRole("button", { name: /ขึ้นรถโดยสาร/ }).first().click();
  await page.getByRole("button", { name: "เริ่มบันทึกการเดินทาง" }).click();
  await expect(page.getByText("+3 คะแนน", { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function completeRecycling(page: Page, count: number) {
  await openActivities(page);
  await page.getByRole("button", { name: /ส่งรีไซเคิล/ }).first().click();
  await page.getByRole("button", { name: "ถ่ายรูป" }).click();
  await page.getByRole("spinbutton", { name: "จำนวนชิ้น" }).fill(String(count));
  await page.getByRole("button", { name: "ส่งรีไซเคิล", exact: true }).click();
}

async function completeTree(page: Page, species = "ตะแบก") {
  await openActivities(page);
  await page.getByRole("button", { name: /ปลูกต้นไม้/ }).first().click();
  await page.getByRole("button", { name: "ถ่ายรูป" }).click();
  await page.getByRole("textbox", { name: "ชนิดต้นไม้" }).fill(species);
  await page.getByRole("button", { name: "ส่งให้ตรวจสอบ" }).click();
  await expect(page.getByText("+15 คะแนน", { exact: true })).toBeVisible();
}

async function expectHomeTotals(page: Page, points: number, avoided: string, projected: string) {
  await page.getByRole("navigation").getByRole("button", { name: "หน้าแรก", exact: true }).click();
  await expect(page.locator(".balance-copy > strong > span")).toHaveText(String(points));
  const impactSummary = page.getByLabel("ผลกระทบคาร์บอนของฉัน").first();
  await expect(impactSummary).toContainText(`${avoided} kg CO₂e`);
  await expect(impactSummary).toContainText(`${projected} kg CO₂e`);
}

test("public presentation demo completes points, voucher, and leaderboard flow without an API server", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });

  await enterDemo(page);
  await expect(page.locator(".balance-copy > strong > span")).toHaveText("0");
  await expect(page.locator(".home-hero .city-motif")).toHaveCount(0);

  await completeBus(page);
  await expect(page.getByRole("heading", { name: "เพราะคุณ ธรรมชาติจึงเติบโต" })).toBeVisible();
  const successCity = page.locator(".success-city-stage .city-motif");
  await expect(successCity.locator("canvas")).toBeVisible();
  const successCityMetrics = await successCity.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const screen = element.closest<HTMLElement>(".success-screen")?.getBoundingClientRect();
    const main = element.closest<HTMLElement>(".consumer-main")?.getBoundingClientRect();
    return {
      centerDelta: screen ? Math.abs(bounds.left + bounds.width / 2 - (screen.left + screen.width / 2)) : Number.POSITIVE_INFINITY,
      screenCenterDelta: screen && main ? Math.abs(screen.left + screen.width / 2 - (main.left + main.width / 2)) : Number.POSITIVE_INFINITY,
      width: bounds.width,
      height: bounds.height,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(successCityMetrics.centerDelta).toBeLessThanOrEqual(1);
  expect(successCityMetrics.screenCenterDelta).toBeLessThanOrEqual(1);
  expect(successCityMetrics.width).toBeGreaterThanOrEqual(280);
  expect(successCityMetrics.height).toBeGreaterThanOrEqual(149);
  expect(successCityMetrics.overflow).toBe(0);
  await successCity.locator("canvas").click();
  await expect(successCity).toHaveAttribute("data-replaying", "true");
  await expect(successCity).toHaveAttribute("data-replaying", "false", { timeout: 2_000 });
  await expect(page.getByText("น้อยกว่ารถยนต์ประมาณ 0.09 กก. CO₂", { exact: true })).toBeVisible();

  await completeRecycling(page, 46);
  await expect(page.getByText("+20 คะแนน", { exact: true })).toBeVisible();
  await expect(page.getByText("หลีกเลี่ยงประมาณ 1.8 กก. CO₂e", { exact: true })).toBeVisible();

  await completeTree(page);
  await expect(page.getByText("คาดว่าจะดูดซับประมาณ 30 กก. CO₂e ใน 5 ปี", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ดูประวัติกิจกรรม" }).click();
  await expect(page.locator(".history-impact")).toHaveCount(3);
  await expect(page.getByText("น้อยกว่ารถยนต์ประมาณ 0.09 กก. CO₂", { exact: true })).toBeVisible();
  await expect(page.getByText("หลีกเลี่ยงประมาณ 1.8 กก. CO₂e", { exact: true })).toBeVisible();
  await expect(page.getByText("คาดว่าจะดูดซับประมาณ 30 กก. CO₂e ใน 5 ปี", { exact: true })).toBeVisible();

  await expectHomeTotals(page, 38, "1.85", "30");

  await page.getByRole("navigation").getByRole("button", { name: "กระเป๋า", exact: true }).click();
  await page.getByRole("button", { name: "แลกรางวัล", exact: true }).first().click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("18", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /ส่วนลดสินค้า 20 บาท\s+พร้อมใช้/ }).click();
  await expect(page.getByText("NZD0 0001", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await expect(page.locator(".balance-copy > strong > span")).toHaveText("18");
  await expect(page.getByLabel("ผลกระทบคาร์บอนของฉัน").first()).toContainText("1.85 kg CO₂e");
  await expect(page.getByLabel("ผลกระทบคาร์บอนของฉัน").first()).toContainText("30 kg CO₂e");

  await page.getByRole("navigation").getByRole("button", { name: "ฉัน", exact: true }).click();
  await expect(page.getByText("สลับบทบาทสาธิต", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /อันดับประจำสัปดาห์/ }).click();
  await expect(page.locator(".full-list li").filter({ hasText: "ผู้ใช้-ใบไม้-1001" })).toContainText("38");
  const leaderboardCity = page.locator(".leaderboard-city .city-motif");
  await expect(leaderboardCity).toHaveAttribute("data-growth-mode", "earned");
  await expect(leaderboardCity).toHaveAttribute("data-points", "38");
  await expect(leaderboardCity).toHaveAttribute("data-buildings", "9");
  await expect(leaderboardCity).toHaveAttribute("data-trees", "12");

  expect(apiRequests).toEqual([]);
});

test("every repeated activity appends points and carbon impact instead of stopping at 38", async ({ page }) => {
  await enterDemo(page);

  await completeBus(page);
  await expectHomeTotals(page, 3, "0.09", "0");

  await completeBus(page);
  await expectHomeTotals(page, 6, "0.19", "0");

  await completeRecycling(page, 46);
  await expect(page.getByText("+20 คะแนน", { exact: true })).toBeVisible();
  await expectHomeTotals(page, 26, "1.95", "0");

  await completeRecycling(page, 23);
  await expect(page.getByText("+10 คะแนน", { exact: true })).toBeVisible();
  await expectHomeTotals(page, 36, "2.83", "0");

  await completeTree(page);
  await expectHomeTotals(page, 51, "2.83", "30");

  await completeTree(page, "ประดู่");
  await expectHomeTotals(page, 66, "2.83", "60");

  await openActivities(page);
  await page.getByRole("button", { name: "ดูประวัติกิจกรรม" }).click();
  await expect(page.locator(".history-impact")).toHaveCount(6);
});

test("carbon-impact Home stays readable at every approved responsive gate", async ({ page }) => {
  await enterDemo(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 922 },
    { width: 1024, height: 900 },
    { width: 1440, height: 1000 },
    { width: 1586, height: 992 },
  ]) {
    await page.setViewportSize(viewport);
    const summary = page.getByLabel("ผลกระทบคาร์บอนของฉัน").first();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("0 kg CO₂e");
    await expect(page.locator(".home-hero .city-motif")).toHaveCount(0);
    const layout = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>(".balance-impact");
      const values = [...document.querySelectorAll<HTMLElement>(".balance-impact dd")];
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardWidth: element?.getBoundingClientRect().width ?? 0,
        minimumValueWidth: Math.min(...values.map((value) => value.getBoundingClientRect().width)),
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.cardWidth).toBeGreaterThan(250);
    expect(layout.minimumValueWidth).toBeGreaterThan(50);
  }
});
