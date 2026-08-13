import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { ClaimsService } from "./claims.service.js";
const Factor = z.object({
  activity:z.enum(["bus","tree","recycling"]),
  code:z.string().trim().min(1).max(80),
  version:z.string().trim().min(1).max(80),
  value:z.string().regex(/^\d+(?:\.\d+)?$/),
  unit:z.string().trim().min(1).max(80),
  sourceUrl:z.string().url(),
  methodologyCode:z.string().trim().min(1).max(120),
  effectiveAt:z.string().datetime({offset:true}),
  assumptions:z.record(z.string(),z.unknown()).optional(),
  disclaimerThai:z.string().trim().min(1).max(1_000),
  proxyCopyThai:z.string().trim().min(1).max(1_000),
}).strict();
@Controller("api/admin/factors")
@Roles("admin")
export class FactorsController {
  constructor(@Inject(ClaimsService) private readonly claims:ClaimsService) {}
  @Get() list(){return this.claims.listFactors();}
  @Get("demo-readiness") readiness(){return this.claims.demoReadiness();}
  @Post() create(@CurrentUser() user:CurrentAuthUser,@Body() body:unknown){return this.claims.createFactor(user.id,parseWithSchema(Factor,body));}
  @Patch(":id/approve") approve(@CurrentUser() user:CurrentAuthUser,@Param("id") id:string){return this.claims.approveFactor(user.id,id);}
}
