import { BadRequestException, Body, Controller, Delete, Get, Headers, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";

import { CurrentUser, Roles, type CurrentAuthUser } from "../auth/auth.types.js";
import { parseWithSchema } from "../http/zod.js";
import { EvidenceService } from "./evidence.service.js";
import { EvidenceFinalizeSchema, EvidenceInitSchema } from "./evidence.types.js";

@Controller("api/evidence")
@Roles("user", "reviewer", "admin")
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly evidenceService: EvidenceService) {}

  @Post("init")
  init(@CurrentUser() user: CurrentAuthUser, @Body() body: unknown) {
    return this.evidenceService.init(user.id, parseWithSchema(EvidenceInitSchema, body));
  }

  @Post(":uploadId/content")
  upload(
    @CurrentUser() user: CurrentAuthUser,
    @Param("uploadId") uploadId: string,
    @Headers("x-upload-token") token: string | undefined,
    @Headers("content-type") contentType: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    if (!token) throw new BadRequestException({ code: "UPLOAD_INVALID", message: "ต้องระบุโทเค็นอัปโหลด" });
    if (!Buffer.isBuffer(request.body) && !(request.body instanceof Readable)) {
      throw new BadRequestException({ code: "UPLOAD_INVALID", message: "ต้องส่งเนื้อหาไฟล์แบบไบนารี" });
    }
    return this.evidenceService.upload(user.id, uploadId, token, contentType?.split(";", 1)[0], request.body);
  }

  @Post(":uploadId/finalize")
  finalize(@CurrentUser() user: CurrentAuthUser, @Param("uploadId") uploadId: string, @Body() body: unknown) {
    const { sha256 } = parseWithSchema(EvidenceFinalizeSchema, body ?? {});
    return this.evidenceService.finalize(user.id, uploadId, sha256);
  }

  @Get(":evidenceId/content")
  async content(@CurrentUser() user: CurrentAuthUser, @Param("evidenceId") evidenceId: string, @Res() reply: FastifyReply) {
    const file = await this.evidenceService.content(user.id, evidenceId);
    reply.header("content-type", file.contentType ?? "application/octet-stream");
    if (file.contentLength !== undefined) reply.header("content-length", file.contentLength);
    return reply.send(file.body);
  }
}

@Controller("api/account")
@Roles("user", "reviewer", "merchant", "admin")
export class AccountController {
  constructor(@Inject(EvidenceService) private readonly evidenceService: EvidenceService) {}

  @Delete()
  async delete(@CurrentUser() user: CurrentAuthUser) {
    await this.evidenceService.deleteAccountEvidence(user.id);
    return { status: "deleted" };
  }
}
