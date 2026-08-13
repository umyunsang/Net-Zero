import { Module } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { AccountController, EvidenceController } from "./evidence.controller.js";
import { EvidenceService } from "./evidence.service.js";
import { ObjectStorageService } from "./object-storage.service.js";

@Module({
  controllers: [EvidenceController, AccountController],
  providers: [DatabaseService, ObjectStorageService, EvidenceService],
  exports: [EvidenceService, ObjectStorageService],
})
export class EvidenceModule {}
