import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { ClaimsService } from "./claims.service.js";
const Review = z.object({ decision:z.enum(["approve","reduce","reject"]), approvedItemCount:z.number().int().min(0).optional(), reason:z.string().trim().min(1).max(500).optional() }).strict();
const Correction = z.object({ correctedTotalKgCo2e:z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/), reason:z.string().trim().min(1).max(500) }).strict();
@Controller("api/review")
@Roles("reviewer","admin")
export class ReviewController {
  constructor(@Inject(ClaimsService) private readonly claims:ClaimsService) {}
  @Get("claims") queue(@CurrentUser() user:CurrentAuthUser,@Query("status") status?:string){return this.claims.reviewQueue(user.id,status ?? "pending");}
  @Patch("claims/:id") decide(@CurrentUser() user:CurrentAuthUser,@Param("id") id:string,@Body() body:unknown){return this.claims.review(user.id,id,parseWithSchema(Review,body));}
  @Post("claims/:id/corrections")
  @Roles("admin")
  correct(@CurrentUser() user:CurrentAuthUser,@Param("id") id:string,@Body() body:unknown){return this.claims.correctImpact(user.id,id,parseWithSchema(Correction,body));}
}
