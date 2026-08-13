import { Module } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { MerchantController } from "./merchant.controller.js";
import { RewardsController } from "./rewards.controller.js";
import { RewardsService } from "./rewards.service.js";

@Module({
  controllers: [RewardsController, MerchantController],
  providers: [DatabaseService, RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
