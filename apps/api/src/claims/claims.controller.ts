import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { ClaimsService } from "./claims.service.js";

const Base = z.object({ evidenceIds: z.array(z.string().uuid()).min(1) });
const Bus = Base.extend({ routeName:z.string().min(1), boardedAt:z.string().datetime({offset:true}), alightedAt:z.string().datetime({offset:true}), samples:z.array(z.object({sampleId:z.string().trim().min(1).max(120).optional(),recordedAt:z.string().datetime({offset:true}),latitude:z.string(),longitude:z.string(),accuracyMeters:z.string()}).strict()).min(1) }).strict();
const Tree = Base.extend({ speciesThaiName:z.string().min(1), plantedAt:z.string().datetime({offset:true}), quantity:z.literal(1), latitude:z.string(), longitude:z.string(), demoAiResult:z.enum(["pass","wrong_type","ambiguous","unavailable"]).optional() }).strict();
const Recycling = Base.extend({ binCode:z.string().min(1).max(120), material:z.enum(["plastic","paper","glass","metal","electronics"]), itemCount:z.number().int().min(1), droppedOffAt:z.string().datetime({offset:true}) }).strict();

@Controller("api")
export class ClaimsController {
  constructor(@Inject(ClaimsService) private readonly claims: ClaimsService) {}
  @Post("actions/bus") bus(@CurrentUser() user:CurrentAuthUser,@Body() body:unknown,@Headers("idempotency-key") key:string){return this.claims.submitBus(user.id,parseWithSchema(Bus,body),key);}
  @Post("actions/bus/:claimId/retry") retryBus(@CurrentUser() user:CurrentAuthUser,@Param("claimId") claimId:string,@Body() body:unknown,@Headers("idempotency-key") key:string){return this.claims.retryBus(user.id,parseWithSchema(z.string().uuid(),claimId),parseWithSchema(Bus,body),key);}
  @Post("actions/tree") tree(@CurrentUser() user:CurrentAuthUser,@Body() body:unknown,@Headers("idempotency-key") key:string){return this.claims.submitTree(user.id,parseWithSchema(Tree,body),key,user.id === "11111111-1111-4111-8111-111111111111");}
  @Post("actions/recycling") recycling(@CurrentUser() user:CurrentAuthUser,@Body() body:unknown,@Headers("idempotency-key") key:string){return this.claims.submitRecycling(user.id,parseWithSchema(Recycling,body),key);}
  @Get("claims") list(@CurrentUser() user:CurrentAuthUser){return this.claims.listClaims(user.id);}
}
