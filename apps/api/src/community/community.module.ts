import { Module } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { CommunityController } from "./community.controller.js";
import { CommunityService } from "./community.service.js";

@Module({
  controllers: [CommunityController],
  providers: [CommunityService, DatabaseService],
})
export class CommunityModule {}
