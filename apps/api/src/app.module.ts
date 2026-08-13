import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuthGuard } from "./auth/auth.guard.js";
import { AuthModule } from "./auth/auth.module.js";
import { ClaimsModule } from "./claims/claims.module.js";
import { CommunityModule } from "./community/community.module.js";
import { DatabaseService } from "./database/database.service.js";
import { EvidenceModule } from "./evidence/evidence.module.js";
import { HealthController } from "./health.controller.js";
import { RewardsModule } from "./rewards/rewards.module.js";

@Module({
  imports: [AuthModule, EvidenceModule, ClaimsModule, RewardsModule, CommunityModule],
  controllers: [HealthController],
  providers: [
    DatabaseService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
