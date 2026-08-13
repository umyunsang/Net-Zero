import { Controller, Get, Inject } from "@nestjs/common";

import { DatabaseService } from "./database/database.service.js";
import { Public } from "./auth/auth.types.js";
import { ObjectStorageService } from "./evidence/object-storage.service.js";
import { getConfig } from "./config.js";

@Controller("health")
export class HealthController {
  private readonly config = getConfig();
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  @Public()
  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Public()
  @Get("ready")
  async ready() {
    await Promise.all([this.database.query("SELECT 1"), this.storage.ready()]);
    return {
      status: "operational",
      dataScope: this.config.DATABASE_DATA_SCOPE,
      mockDemoEnabled: this.config.MOCK_DEMO_ENABLED,
      productionReady: false,
    };
  }
}
