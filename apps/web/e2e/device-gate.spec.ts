import { expect, test } from "@playwright/test";

test("ฟิกซ์เจอร์สังเคราะห์ไม่เรียกอุปกรณ์จริง และเกตรถโดยสารปิดเมื่ออยู่เบื้องหลัง", async ({ page }) => {
  const evidenceInits: Array<{ kind: string; mimeType: string; sizeBytes: number; capture: { capturedAt: string; camera?: { make: string; model: string } } }> = [];
  const busRequests: Array<{ routeName: string; samples: Array<{ sampleId: string; recordedAt: string; latitude: string; longitude: string }> }> = [];
  const outboundRequests: string[] = [];
  const verifiedClaim = (activity: "bus" | "recycling", awardedPoints: number) => ({
    claim: {
      id: `claim-${activity}`,
      activity,
      status: "verified",
      impact_status: "credited",
      data_scope: "mock_demo",
      is_mock: true,
      is_synthetic: true,
      demo_only: true,
      fixture_id: "FIXTURE-BKK-20260812-01",
      reason_code: "reviewer_confirmed",
      submitted_at: "2026-08-12T00:00:00.000Z",
      decided_at: "2026-08-12T00:00:00.000Z",
      awarded_points: awardedPoints,
      impacts: [],
      evidence_ids: ["evidence"],
    },
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) outboundRequests.push(url.origin);
  });
  await page.clock.install({ time: new Date("2026-08-12T00:00:00.000Z") });
  await page.addInitScript(() => {
    let visible = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visible ? "visible" : "hidden" });
    Object.defineProperty(window, "deviceGateTest", { configurable: true, value: { hide: () => { visible = false; document.dispatchEvent(new Event("visibilitychange")); } } });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => { throw new Error("ห้ามเรียกกล้อง"); } } });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: () => { throw new Error("ห้ามเรียกพิกัด"); }, watchPosition: () => { throw new Error("ห้ามเรียกพิกัด"); } } });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api", "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/demo-login") return json({ accessToken: "token" });
    if (path === "/dashboard") return json({ data_scope: "mock_demo", is_mock: true, demo_only: true, points: 0, pending_count: 0, personal: { estimated_avoided_co2e: "0", projected_sequestration_co2e: "0" }, community: { estimated_avoided_co2e: "0", projected_sequestration_co2e: "0" } });
    if (path === "/evidence/init") { evidenceInits.push(request.postDataJSON()); return json({ uploadId: "upload", uploadToken: "upload-token" }); }
    if (path === "/evidence/upload/content") return route.fulfill({ status: 204 });
    if (path === "/evidence/upload/finalize") return json({ evidenceId: "evidence" });
    if (path === "/actions/bus") { busRequests.push(request.postDataJSON()); return json(verifiedClaim("bus", 3)); }
    if (path === "/actions/recycling") return json(verifiedClaim("recycling", 20));
    return json({});
  });

  await page.goto("/");
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await page.getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ส่งรีไซเคิล/ }).click();
  await expect(page.getByText("เพิ่มรูปวัสดุรีไซเคิล")).toBeVisible();
  await expect(page.getByText("หลักฐานจากอุปกรณ์")).toHaveCount(0);
  await expect(page.getByText("ถ่ายภาพด้วยกล้อง")).toHaveCount(0);
  await expect(page.getByText("อ่าน GPS")).toHaveCount(0);
  await expect(page.getByText("ผล AI")).toHaveCount(0);
  await page.getByRole("button", { name: "ถ่ายรูป" }).click();
  await expect(page.getByText("พร้อมส่ง")).toBeVisible();
  await page.getByRole("spinbutton", { name: "จำนวนชิ้น" }).fill("46");
  await page.getByRole("button", { name: "ส่งรีไซเคิล" }).click();
  await expect(page.getByText("สำเร็จแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "เพราะคุณ ธรรมชาติจึงเติบโต" })).toBeVisible();
  await expect(page.locator(".success-city-stage canvas")).toBeVisible();
  await expect(page.getByText("+20 คะแนน")).toBeVisible();
  await expect.poll(() => evidenceInits.length).toBe(1);
  expect(evidenceInits[0]).toMatchObject({ kind: "photo", mimeType: "image/jpeg", sizeBytes: 156, fixtureId: "FIXTURE-BKK-20260812-01", capture: { capturedAt: "2026-08-12T00:00:00.000Z", camera: { make: "ผู้ให้บริการฟิกซ์เจอร์สังเคราะห์", model: "FIXTURE-BKK-20260812-01-RECYCLING" } } });

  await page.getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ขึ้นรถโดยสาร/ }).click();
  await page.getByRole("button", { name: "เริ่มบันทึกการเดินทาง" }).click();
  await expect(page.getByText("กำลังบันทึก · ประมาณ 3 วินาที")).toBeVisible();
  await page.clock.runFor(2_400);
  await expect.poll(() => busRequests.length).toBe(1);
  await expect(page.getByText("สำเร็จแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "เพราะคุณ ธรรมชาติจึงเติบโต" })).toBeVisible();
  await expect(page.locator(".success-city-stage canvas")).toBeVisible();
  await expect(page.getByText("+3 คะแนน")).toBeVisible();
  expect(busRequests[0]?.routeName).toBe("DEMO-BUS-01");
  expect(busRequests[0]!.samples).toHaveLength(7);
  expect(busRequests[0]!.samples[0]).toMatchObject({ sampleId: "FIXTURE-BKK-20260812-01-BUS-0", latitude: "13.7649", longitude: "100.53500" });
  expect(busRequests[0]!.samples[6]).toMatchObject({ sampleId: "FIXTURE-BKK-20260812-01-BUS-6", latitude: "13.7649", longitude: "100.54240" });
  expect(busRequests[0]!.samples.slice(1).every((sample, index) =>
    new Date(sample.recordedAt).getTime() - new Date(busRequests[0]!.samples[index]!.recordedAt).getTime() === 30_000,
  )).toBe(true);

  await page.getByRole("button", { name: "ทำกิจกรรม", exact: true }).click();
  await page.getByRole("button", { name: /ขึ้นรถโดยสาร/ }).click();
  await page.getByRole("button", { name: "เริ่มบันทึกการเดินทาง" }).click();
  await page.evaluate(() => (window as Window & { deviceGateTest: { hide(): void } }).deviceGateTest.hide());
  await expect(page.getByText("หยุดบันทึกแล้ว เพราะแอปไม่ได้อยู่ด้านหน้า")).toBeVisible();
  await page.clock.runFor(3_000);
  expect(busRequests).toHaveLength(1);
  expect(outboundRequests).toEqual([]);
});
