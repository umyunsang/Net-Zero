import { z } from "zod";

/** Transport primitives shared by every public API payload. */
export const UUIDSchema = z.string().uuid();
export const IsoTimestampSchema = z
  .string()
  .datetime({ offset: true });
/** Non-negative base-10 decimal without exponent notation or redundant leading zeroes. */
export const DecimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/);
export const SignedDecimalStringSchema = z
  .string()
  .regex(/^(?:0|-[1-9]\d*|[1-9]\d*)(?:\.\d*[1-9])?$/);
export const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (value) => value !== "0",
  "Expected a positive decimal string",
);
export const PaginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000),
    pageSize: z.coerce.number().int().min(1).max(100),
  })
  .strict();
export const PageInfoSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "UPLOAD_INVALID",
  "UPLOAD_EXPIRED",
  "EVIDENCE_REQUIRED",
  "FACTOR_NOT_APPROVED",
  "VOUCHER_UNAVAILABLE",
  "VOUCHER_ALREADY_REDEEMED",
  "INTERNAL_ERROR",
]);
export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: UUIDSchema.optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const UserRoleSchema = z.enum(["user", "reviewer", "merchant", "admin"]);
export const DemoLoginRequestSchema = z
  .object({
    role: UserRoleSchema,
  })
  .strict();
export const DemoLoginResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal("Bearer"),
    expiresAt: IsoTimestampSchema,
    user: z
      .object({ id: UUIDSchema, role: UserRoleSchema, displayName: z.string().min(1).max(80) })
      .strict(),
  })
  .strict();

export const EvidenceMimeTypeSchema = z.enum(["image/jpeg", "image/webp"]);
export const MAX_EVIDENCE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const EvidenceUploadInitRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: EvidenceMimeTypeSchema,
    sizeBytes: z.number().int().min(1).max(MAX_EVIDENCE_UPLOAD_BYTES),
  })
  .strict();
export const EvidenceUploadInitResponseSchema = z
  .object({
    uploadId: UUIDSchema,
    uploadUrl: z.string().url(),
    expiresAt: IsoTimestampSchema,
  })
  .strict();
export const EvidenceMetadataSchema = z
  .object({
    uploadId: UUIDSchema,
    capturedAt: IsoTimestampSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const EvidenceUploadFinalizeRequestSchema = EvidenceMetadataSchema;
export const EvidenceUploadFinalizeResponseSchema = z
  .object({
    evidenceId: UUIDSchema,
    status: z.literal("ready"),
  })
  .strict();

export const GpsSampleSchema = z
  .object({
    sampleId: z.string().trim().min(1).max(120).optional(),
    recordedAt: IsoTimestampSchema,
    latitude: SignedDecimalStringSchema,
    longitude: SignedDecimalStringSchema,
    accuracyMeters: PositiveDecimalStringSchema,
  })
  .strict();
export const BusSubmissionRequestSchema = z
  .object({
    routeName: z.string().trim().min(1).max(120),
    boardedAt: IsoTimestampSchema,
    alightedAt: IsoTimestampSchema,
    samples: z.array(GpsSampleSchema).min(1).max(1_000),
    evidenceIds: z.array(UUIDSchema).min(1).max(10),
  })
  .strict()
  .refine((value) => Date.parse(value.boardedAt) <= Date.parse(value.alightedAt), {
    message: "boardedAt must not be after alightedAt",
    path: ["alightedAt"],
  });

export const TreeSubmissionRequestSchema = z
  .object({
    speciesThaiName: z.string().trim().min(1).max(120),
    plantedAt: IsoTimestampSchema,
    quantity: z.number().int().min(1).max(1_000),
    latitude: SignedDecimalStringSchema,
    longitude: SignedDecimalStringSchema,
    evidenceIds: z.array(UUIDSchema).min(1).max(10),
  })
  .strict();
export const RecyclingMaterialSchema = z.enum([
  "plastic",
  "paper",
  "glass",
  "metal",
  "electronics",
]);
export const RecyclingSubmissionRequestSchema = z
  .object({
    material: RecyclingMaterialSchema,
    itemCount: z.number().int().min(1).max(100_000),
    droppedOffAt: IsoTimestampSchema,
    merchantId: UUIDSchema.optional(),
    evidenceIds: z.array(UUIDSchema).min(1).max(10),
  })
  .strict();
/** A reviewer may approve the claimed count or reduce it; rejection is not a decision action. */
export const RecyclingReviewerDecisionSchema = z
  .object({
    submissionId: UUIDSchema,
    action: z.enum(["approve", "reduce"]),
    approvedItemCount: z.number().int().min(0).max(100_000),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const ClaimStatusSchema = z.enum([
  "submitted",
  "pending",
  "pending_review",
  "verified",
  "rejected",
]);
export const CarbonEstimateSchema = z
  .object({
    estimatedAvoidedKgCo2e: DecimalStringSchema,
    projectedSequestrationKgCo2e: DecimalStringSchema,
    factorVersion: z.string().trim().min(1).max(80),
    disclaimerThai: z.literal("เป็นค่าประมาณการ ไม่ใช่การรับรองโดย อบก."),
  })
  .strict();
export const ClaimResultSchema = z
  .object({
    claimId: UUIDSchema,
    status: ClaimStatusSchema,
    submittedAt: IsoTimestampSchema,
    reviewedAt: IsoTimestampSchema.nullable(),
    awardedPoints: z.number().int().min(0),
    carbonEstimate: CarbonEstimateSchema,
  })
  .strict();
export const SubmissionResponseSchema = z
  .object({
    claim: ClaimResultSchema,
  })
  .strict();

export const PointsBalanceSchema = z
  .object({
    availablePoints: z.number().int().min(0),
    lifetimeEarnedPoints: z.number().int().min(0),
    lifetimeRedeemedPoints: z.number().int().min(0),
    updatedAt: IsoTimestampSchema,
  })
  .strict();
export const RewardCatalogItemSchema = z
  .object({
    rewardId: UUIDSchema,
    merchantId: UUIDSchema,
    titleThai: z.string().trim().min(1).max(160),
    descriptionThai: z.string().trim().min(1).max(1_000),
    pointsCost: z.number().int().min(1),
    inventory: z.number().int().min(0),
    active: z.boolean(),
  })
  .strict();
export const RewardCatalogResponseSchema = z
  .object({ items: z.array(RewardCatalogItemSchema), pageInfo: PageInfoSchema })
  .strict();

export const VoucherStateSchema = z.enum(["issued", "redeemed", "expired", "cancelled"]);
export const VoucherSchema = z
  .object({
    voucherId: UUIDSchema,
    rewardId: UUIDSchema,
    state: VoucherStateSchema,
    code: z.string().regex(/^[A-Z0-9]{8,32}$/),
    issuedAt: IsoTimestampSchema,
    expiresAt: IsoTimestampSchema,
    redeemedAt: IsoTimestampSchema.nullable(),
    cancelledAt: IsoTimestampSchema.nullable(),
  })
  .strict();
export const VoucherIssueRequestSchema = z.object({ rewardId: UUIDSchema }).strict();
export const VoucherIssueResponseSchema = z.object({ voucher: VoucherSchema }).strict();
export const VoucherRedeemRequestSchema = z.object({ code: z.string().regex(/^[A-Z0-9]{8,32}$/) }).strict();
export const VoucherRedeemResponseSchema = z.object({ voucher: VoucherSchema }).strict();
export const VoucherCancelRequestSchema = z.object({ voucherId: UUIDSchema }).strict();
export const VoucherCancelResponseSchema = z.object({ voucher: VoucherSchema }).strict();

export const DashboardResponseSchema = z
  .object({
    points: PointsBalanceSchema,
    carbonEstimate: CarbonEstimateSchema,
    recentClaims: z.array(ClaimResultSchema).max(20),
    activeVouchers: z.array(VoucherSchema).max(20),
  })
  .strict();
export const ThaiPseudonymSchema = z.string().regex(/^ผู้ใช้-[ก-๙]{2,12}-\d{3,4}$/);
export const WeeklyLeaderboardEntrySchema = z
  .object({
    rank: z.number().int().min(1),
    pseudonymThai: ThaiPseudonymSchema,
    weeklyPoints: z.number().int().min(0),
  })
  .strict();
export const WeeklyLeaderboardResponseSchema = z
  .object({
    weekStartsAt: IsoTimestampSchema,
    entries: z.array(WeeklyLeaderboardEntrySchema).max(100),
  })
  .strict();

export const EmissionFactorCategorySchema = z.enum(["transport", "tree", "recycling"]);
export const FactorCatalogItemSchema = z
  .object({
    factorId: UUIDSchema,
    category: EmissionFactorCategorySchema,
    nameThai: z.string().trim().min(1).max(160),
    value: PositiveDecimalStringSchema,
    unit: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(80),
    status: z.enum(["pending", "approved", "rejected"]),
  })
  .strict();
/** Approval is explicit: clients cannot activate a factor through an omitted or default decision. */
export const FactorCatalogApprovalPayloadSchema = z
  .object({
    factorId: UUIDSchema,
    decision: z.enum(["approve", "reject"]),
    reviewedAt: IsoTimestampSchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type UUID = z.infer<typeof UUIDSchema>;
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
export type DecimalString = z.infer<typeof DecimalStringSchema>;
export type SignedDecimalString = z.infer<typeof SignedDecimalStringSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type DemoLoginRequest = z.infer<typeof DemoLoginRequestSchema>;
export type DemoLoginResponse = z.infer<typeof DemoLoginResponseSchema>;
export type EvidenceMimeType = z.infer<typeof EvidenceMimeTypeSchema>;
export type EvidenceUploadInitRequest = z.infer<typeof EvidenceUploadInitRequestSchema>;
export type EvidenceUploadInitResponse = z.infer<typeof EvidenceUploadInitResponseSchema>;
export type EvidenceMetadata = z.infer<typeof EvidenceMetadataSchema>;
export type EvidenceUploadFinalizeRequest = z.infer<typeof EvidenceUploadFinalizeRequestSchema>;
export type EvidenceUploadFinalizeResponse = z.infer<typeof EvidenceUploadFinalizeResponseSchema>;
export type GpsSample = z.infer<typeof GpsSampleSchema>;
export type BusSubmissionRequest = z.infer<typeof BusSubmissionRequestSchema>;
export type TreeSubmissionRequest = z.infer<typeof TreeSubmissionRequestSchema>;
export type RecyclingMaterial = z.infer<typeof RecyclingMaterialSchema>;
export type RecyclingSubmissionRequest = z.infer<typeof RecyclingSubmissionRequestSchema>;
export type RecyclingReviewerDecision = z.infer<typeof RecyclingReviewerDecisionSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type CarbonEstimate = z.infer<typeof CarbonEstimateSchema>;
export type ClaimResult = z.infer<typeof ClaimResultSchema>;
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>;
export type PointsBalance = z.infer<typeof PointsBalanceSchema>;
export type RewardCatalogItem = z.infer<typeof RewardCatalogItemSchema>;
export type RewardCatalogResponse = z.infer<typeof RewardCatalogResponseSchema>;
export type VoucherState = z.infer<typeof VoucherStateSchema>;
export type Voucher = z.infer<typeof VoucherSchema>;
export type VoucherIssueRequest = z.infer<typeof VoucherIssueRequestSchema>;
export type VoucherIssueResponse = z.infer<typeof VoucherIssueResponseSchema>;
export type VoucherRedeemRequest = z.infer<typeof VoucherRedeemRequestSchema>;
export type VoucherRedeemResponse = z.infer<typeof VoucherRedeemResponseSchema>;
export type VoucherCancelRequest = z.infer<typeof VoucherCancelRequestSchema>;
export type VoucherCancelResponse = z.infer<typeof VoucherCancelResponseSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type WeeklyLeaderboardEntry = z.infer<typeof WeeklyLeaderboardEntrySchema>;
export type WeeklyLeaderboardResponse = z.infer<typeof WeeklyLeaderboardResponseSchema>;
export type EmissionFactorCategory = z.infer<typeof EmissionFactorCategorySchema>;
export type FactorCatalogItem = z.infer<typeof FactorCatalogItemSchema>;
export type FactorCatalogApprovalPayload = z.infer<typeof FactorCatalogApprovalPayloadSchema>;
