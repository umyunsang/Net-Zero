import { BadRequestException, Body, Controller, Get, Headers, Inject, Post, Query } from "@nestjs/common";

import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { RewardsService } from "./rewards.service.js";
import { RewardCatalogQuerySchema, VoucherIssueBodySchema, VoucherListQuerySchema } from "./rewards.types.js";

@Controller("api/rewards")
@Roles("user")
export class RewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  @Get()
  catalog(@CurrentUser() user: CurrentAuthUser, @Query() query: unknown) {
    const input = parseWithSchema(RewardCatalogQuerySchema, query);
    const page = typeof input.page === "number" ? input.page : 1;
    const pageSize = typeof input.pageSize === "number" ? input.pageSize : 20;
    return this.rewards.catalog(user, page, pageSize);
  }

  @Post("vouchers")
  issue(@CurrentUser() user: CurrentAuthUser, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const { rewardId } = parseWithSchema(VoucherIssueBodySchema, body);
    if (!key) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "ต้องระบุ Idempotency-Key" });
    if (typeof rewardId !== "string") throw new BadRequestException({ code: "VALIDATION_ERROR", message: "รหัสรางวัลไม่ถูกต้อง" });
    return this.rewards.issue(user, rewardId, key);
  }

  @Get("vouchers")
  list(@CurrentUser() user: CurrentAuthUser, @Query() query: unknown) {
    const { page = 1, pageSize = 20 } = parseWithSchema(VoucherListQuerySchema, query);
    return this.rewards.list(user, page, pageSize);
  }

}
