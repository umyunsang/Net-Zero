import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  BusSubmissionRequestSchema,
  CarbonEstimateSchema,
  DecimalStringSchema,
  DemoLoginRequestSchema,
  EvidenceUploadInitRequestSchema,
  FactorCatalogApprovalPayloadSchema,
  IsoTimestampSchema,
  RecyclingReviewerDecisionSchema,
  ThaiPseudonymSchema,
  VoucherSchema,
} from "./schemas.js";

const id = "4e3d4cc0-89d4-4cc2-898f-8243b9303a52";
const timestamp = "2026-08-12T09:30:00.000Z";

describe("transport primitives", () => {
  it("accepts ISO timestamps with a timezone and canonical decimal strings", () => {
    expect(IsoTimestampSchema.safeParse(timestamp).success).toBe(true);
    expect(DecimalStringSchema.safeParse("123.45").success).toBe(true);
  });

  it.each(["2026-08-12 09:30:00", "2026-08-12T09:30:00", "not-a-date"])(
    "rejects non-ISO timestamp %s",
    (value) => expect(IsoTimestampSchema.safeParse(value).success).toBe(false),
  );

  it.each(["01", "1.0", "0.0", "1e3", "-1", ".5"])(
    "rejects non-canonical decimal %s",
    (value) => expect(DecimalStringSchema.safeParse(value).success).toBe(false),
  );
});

describe("authentication and upload boundaries", () => {
  it("accepts a demo login role and rejects unknown keys", () => {
    expect(DemoLoginRequestSchema.safeParse({ role: "reviewer" }).success).toBe(true);
    expect(
      DemoLoginRequestSchema.safeParse({ role: "reviewer", displayName: "ผู้ตรวจสอบ" }).success,
    ).toBe(false);
  });

  it("enforces evidence MIME type and maximum upload size", () => {
    expect(
      EvidenceUploadInitRequestSchema.safeParse({
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      EvidenceUploadInitRequestSchema.safeParse({
        fileName: "receipt.gif",
        mimeType: "image/gif",
        sizeBytes: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });
});

describe("claim payloads", () => {
  it("requires evidence and at least one strict GPS sample for bus claims", () => {
    const payload = {
      routeName: "สาย 8",
      boardedAt: timestamp,
      alightedAt: "2026-08-12T10:00:00.000Z",
      samples: [
        { recordedAt: timestamp, latitude: "13.7563", longitude: "100.5018", accuracyMeters: "5" },
        { recordedAt: "2026-08-12T09:31:00.000Z", latitude: "13.7564", longitude: "100.5019", accuracyMeters: "4.5" },
      ],
      evidenceIds: [id],
    };
    expect(BusSubmissionRequestSchema.safeParse(payload).success).toBe(true);
    expect(BusSubmissionRequestSchema.safeParse({ ...payload, samples: payload.samples.slice(0, 1) }).success).toBe(true);
    expect(BusSubmissionRequestSchema.safeParse({ ...payload, samples: [] }).success).toBe(false);
    expect(BusSubmissionRequestSchema.safeParse({ ...payload, evidenceIds: [] }).success).toBe(false);
  });

  it("limits reviewer recycling actions to approval or reduction", () => {
    expect(
      RecyclingReviewerDecisionSchema.safeParse({ submissionId: id, action: "reduce", approvedItemCount: 2 }).success,
    ).toBe(true);
    expect(
      RecyclingReviewerDecisionSchema.safeParse({ submissionId: id, action: "reject", approvedItemCount: 0 }).success,
    ).toBe(false);
  });

  it("keeps carbon categories separate and refuses a generic total", () => {
    const estimate = {
      estimatedAvoidedKgCo2e: "4.6",
      projectedSequestrationKgCo2e: "9.5",
      factorVersion: "tgo-2026-01",
      disclaimerThai: "เป็นค่าประมาณการ ไม่ใช่การรับรองโดย อบก.",
    };
    expect(CarbonEstimateSchema.safeParse(estimate).success).toBe(true);
    expect(CarbonEstimateSchema.safeParse({ ...estimate, totalKgCo2e: "4.6" }).success).toBe(false);
  });
});

describe("rewards, privacy, and factor governance", () => {
  it("models one-time voucher state without accepting extra data", () => {
    const voucher = {
      voucherId: id,
      rewardId: id,
      state: "redeemed",
      code: "ABCD1234",
      issuedAt: timestamp,
      expiresAt: "2026-08-19T09:30:00.000Z",
      redeemedAt: "2026-08-12T09:31:00.000Z",
      cancelledAt: null,
    };
    expect(VoucherSchema.safeParse(voucher).success).toBe(true);
    expect(VoucherSchema.safeParse({ ...voucher, usedTwice: false }).success).toBe(false);
  });

  it("accepts only Thai pseudonyms and explicit factor decisions", () => {
    expect(ThaiPseudonymSchema.safeParse("ผู้ใช้-เขียว-123").success).toBe(true);
    expect(ThaiPseudonymSchema.safeParse("Alice").success).toBe(false);
    expect(
      FactorCatalogApprovalPayloadSchema.safeParse({ factorId: id, decision: "approve", reviewedAt: timestamp }).success,
    ).toBe(true);
    expect(FactorCatalogApprovalPayloadSchema.safeParse({ factorId: id, reviewedAt: timestamp }).success).toBe(false);
  });

  it("uses stable error codes", () => {
    expect(ApiErrorSchema.safeParse({ code: "FACTOR_NOT_APPROVED", message: "ยังไม่อนุมัติ" }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: "UNKNOWN", message: "bad" }).success).toBe(false);
  });
});
