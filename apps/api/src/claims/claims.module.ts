import { Module } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { ClaimsController } from "./claims.controller.js";
import { ClaimsService } from "./claims.service.js";
import { FactorsController } from "./factors.controller.js";
import { ReviewController } from "./review.controller.js";
import { TREE_PHOTO_VERIFIER, UnavailableTreePhotoVerifier } from "./tree-photo-verifier.js";

@Module({
  controllers: [ClaimsController, ReviewController, FactorsController],
  providers: [
    ClaimsService,
    DatabaseService,
    UnavailableTreePhotoVerifier,
    { provide: TREE_PHOTO_VERIFIER, useExisting: UnavailableTreePhotoVerifier },
  ],
})
export class ClaimsModule {}
