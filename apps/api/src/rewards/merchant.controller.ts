import { BadRequestException, Body, Controller, Headers, Inject, Param, Post } from "@nestjs/common";

import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { RewardsService } from "./rewards.service.js";
import { MerchantScanBodySchema, VoucherIdParamsSchema } from "./rewards.types.js";

@Controller("api/merchant")
@Roles("merchant", "admin")
export class MerchantController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  @Post("vouchers/scan")
  @Roles("merchant")
  scan(@CurrentUser() user: CurrentAuthUser, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const { code } = parseWithSchema(MerchantScanBodySchema, body);
    if (!key) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "ต้องระบุ Idempotency-Key" });
    if (typeof code !== "string") throw new BadRequestException({ code: "VALIDATION_ERROR", message: "รหัสบัตรรางวัลไม่ถูกต้อง" });
    return this.rewards.scan(user, code, key);
  }

  @Post("vouchers/:id/cancel")
  cancel(@CurrentUser() user: CurrentAuthUser, @Param() params: unknown, @Headers("idempotency-key") key?: string) {
    const { id } = parseWithSchema(VoucherIdParamsSchema, params);
    if (!key) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "ต้องระบุ Idempotency-Key" });
    if (typeof id !== "string") throw new BadRequestException({ code: "VALIDATION_ERROR", message: "รหัสบัตรรางวัลไม่ถูกต้อง" });
    return this.rewards.cancelByOperator(user, id, key);
  }
}
