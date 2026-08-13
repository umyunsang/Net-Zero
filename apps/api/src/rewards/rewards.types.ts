import { z } from "zod";

import { PaginationSchema, UUIDSchema, VoucherIssueRequestSchema, VoucherRedeemRequestSchema } from "@net-zero/contracts";

export const RewardCatalogQuerySchema = PaginationSchema.partial().strict();
export const VoucherListQuerySchema = PaginationSchema.partial().strict();
export const VoucherIdParamsSchema = z.object({ id: UUIDSchema }).strict();
export const VoucherCodeParamsSchema = z.object({ code: VoucherRedeemRequestSchema.shape.code }).strict();
export const VoucherIssueBodySchema = VoucherIssueRequestSchema;
export const MerchantScanBodySchema = VoucherRedeemRequestSchema;

export type RewardCatalogQuery = z.infer<typeof RewardCatalogQuerySchema>;
export type VoucherListQuery = z.infer<typeof VoucherListQuerySchema>;
export type VoucherIssueBody = z.infer<typeof VoucherIssueBodySchema>;
export type MerchantScanBody = z.infer<typeof MerchantScanBodySchema>;
