import { expect, test } from "@playwright/test";

test("public presentation demo completes points, voucher, and leaderboard flow without an API server", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await expect(page.getByLabel("คะแนนของคุณ").getByText("0", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ขึ้นรถโดยสาร/ }).first().click();
  await page.getByRole("button", { name: "เริ่มบันทึกการเดินทาง" }).click();
  await expect(page.getByText("+3 คะแนน", { exact: true })).toBeVisible({ timeout: 10_000 });
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

  await page.getByRole("navigation").getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ส่งรีไซเคิล/ }).first().click();
  await page.getByRole("button", { name: "ถ่ายรูป" }).click();
  await page.getByRole("spinbutton", { name: "จำนวนชิ้น" }).fill("46");
  await page.getByRole("button", { name: "ส่งรีไซเคิล", exact: true }).click();
  await expect(page.getByText("+20 คะแนน", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ปลูกต้นไม้/ }).first().click();
  await page.getByRole("button", { name: "ถ่ายรูป" }).click();
  await page.getByRole("textbox", { name: "ชนิดต้นไม้" }).fill("ตะแบก");
  await page.getByRole("button", { name: "ส่งให้ตรวจสอบ" }).click();
  await expect(page.getByText("+15 คะแนน", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "หน้าแรก", exact: true }).click();
  await expect(page.getByLabel("คะแนนของคุณ").getByText("38", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "กระเป๋า", exact: true }).click();
  await page.getByRole("button", { name: "แลกรางวัล", exact: true }).first().click();
  await expect(page.getByLabel("คะแนนพร้อมใช้").getByText("18", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /ส่วนลดสินค้า 20 บาท\s+พร้อมใช้/ }).click();
  await expect(page.getByText("NZD0 0001", { exact: true })).toBeVisible();

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
