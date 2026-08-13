import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { z } from "zod";

import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { CommunityService } from "./community.service.js";
import type {
  DashboardResponse,
  LeaderboardConsentResponse,
  WeeklyLeaderboardResponse,
} from "./community.types.js";

const LeaderboardConsentSchema = z.object({ optedIn: z.boolean() }).strict();

@Controller("api")
@Roles("user")
export class CommunityController {
  constructor(@Inject(CommunityService) private readonly communityService: CommunityService) {}

  @Get("dashboard")
  getDashboard(@CurrentUser() user: CurrentAuthUser): Promise<DashboardResponse> {
    return this.communityService.getDashboard(user.id);
  }

  @Get("leaderboard/weekly")
  getWeeklyLeaderboard(@CurrentUser() user: CurrentAuthUser): Promise<WeeklyLeaderboardResponse> {
    return this.communityService.getWeeklyLeaderboard(user.id);
  }

  @Put("leaderboard/consent")
  setLeaderboardConsent(
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: unknown,
  ): Promise<LeaderboardConsentResponse> {
    const { optedIn } = parseWithSchema(LeaderboardConsentSchema, body);
    return this.communityService.setLeaderboardConsent(user.id, optedIn);
  }
}
