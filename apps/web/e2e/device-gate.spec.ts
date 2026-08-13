import { expect, test } from "@playwright/test";

test("ฟิกซ์เจอร์สังเคราะห์ไม่เรียกอุปกรณ์จริง และเกตรถโดยสารปิดเมื่ออยู่เบื้องหลัง", async ({ page }) => {
  const evidenceInits: Array<{ kind: string; mimeType: string; sizeBytes: number; capture: { capturedAt: string; camera?: { make: string; model: string } } }> = [];
  const busRequests: Array<{ routeName: string; samples: Array<{ sampleId: string; recordedAt: string; latitude: string; longitude: string }> }> = [];
  const outboundRequests: string[] = [];
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
    if (path === "/actions/bus") { busRequests.push(request.postDataJSON()); return json({}); }
    if (path === "/actions/recycling") return json({});
    return json({});
  });

  await page.goto("/");
  await page.getByRole("button", { name: "ผู้ใช้งาน" }).click();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("หลักฐานภาพฟิกซ์เจอร์สังเคราะห์จากผู้ให้บริการจำลอง").first()).toBeVisible();
  await expect(page.getByText("ไม่ได้เก็บหลักฐานทางกายภาพ")).toBeVisible();
  await expect(page.getByText("หลักฐานจากอุปกรณ์")).toHaveCount(0);
  await expect(page.getByText("ถ่ายภาพด้วยกล้อง")).toHaveCount(0);
  await expect(page.getByText("อ่าน GPS")).toHaveCount(0);
  await expect(page.getByText("ผล AI")).toHaveCount(0);
  await page.getByRole("button", { name: "สร้างฟิกซ์เจอร์ภาพจำลอง" }).first().click();
  await expect(page.getByText("สร้างฟิกซ์เจอร์ JPEG แล้ว", { exact: false }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "โทเค็น QR ใช้ครั้งเดียว" }).fill("DEMO-BIN-BKK-01:TOKEN-0001");
  await page.getByRole("spinbutton", { name: "จำนวนชิ้น" }).fill("1");
  await page.getByRole("button", { name: "ส่งให้ผู้ตรวจสอบ" }).click();
  await expect.poll(() => evidenceInits.length).toBe(1);
  expect(evidenceInits[0]).toMatchObject({ kind: "photo", mimeType: "image/jpeg", sizeBytes: 156, fixtureId: "FIXTURE-BKK-20260812-01", capture: { capturedAt: "2026-08-12T00:00:00.000Z", camera: { make: "ผู้ให้บริการฟิกซ์เจอร์สังเคราะห์", model: "FIXTURE-BKK-20260812-01-RECYCLING" } } });

  await page.getByRole("button", { name: "เริ่มเก็บ GPS" }).click();
  await expect(page.getByText("กำลังเล่นฟิกซ์เจอร์ GPS สังเคราะห์ขณะอยู่เบื้องหน้า กรุณาคงหน้าจอนี้ไว้ 180 วินาที")).toBeVisible();
  await page.clock.runFor(180_000);
  await expect(page.getByText("ผ่านเกตจำลองเท่านั้น: ฟิกซ์เจอร์ GPS สังเคราะห์เล่นครบขณะอยู่เบื้องหน้า")).toBeVisible();
  await page.getByRole("button", { name: "ส่งร่องรอย GPS เพื่อตรวจ" }).click();
  await expect.poll(() => busRequests.length).toBe(1);
  expect(busRequests[0]?.routeName).toBe("DEMO-BUS-01");
  expect(busRequests[0]!.samples).toHaveLength(7);
  expect(busRequests[0]!.samples[0]).toMatchObject({ sampleId: "FIXTURE-BKK-20260812-01-BUS-0", latitude: "13.7649", longitude: "100.53500" });
  expect(busRequests[0]!.samples[6]).toMatchObject({ sampleId: "FIXTURE-BKK-20260812-01-BUS-6", latitude: "13.7649", longitude: "100.54240" });
  expect(busRequests[0]!.samples.slice(1).every((sample, index) =>
    new Date(sample.recordedAt).getTime() - new Date(busRequests[0]!.samples[index]!.recordedAt).getTime() === 30_000,
  )).toBe(true);

  await page.getByRole("button", { name: "เริ่มเก็บ GPS" }).click();
  await page.evaluate(() => (window as Window & { deviceGateTest: { hide(): void } }).deviceGateTest.hide());
  await expect(page.getByText("ไม่ผ่านเกตจำลอง: แอปอยู่เบื้องหลังระหว่างเก็บ GPS สังเคราะห์")).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งร่องรอย GPS เพื่อตรวจ" })).toBeDisabled();
  expect(outboundRequests).toEqual([]);
});
