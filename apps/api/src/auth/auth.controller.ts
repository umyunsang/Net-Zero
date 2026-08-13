import { Body, Controller, Inject, Post } from "@nestjs/common";

import type { DemoLoginResponse } from "@net-zero/contracts";

import { parseWithSchema } from "../http/zod.js";
import { AuthService } from "./auth.service.js";
import { DemoLoginInputSchema, Public } from "./auth.types.js";

@Controller("/api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("demo-login")
  async demoLogin(@Body() body: unknown): Promise<DemoLoginResponse> {
    return this.authService.demoLogin(parseWithSchema(DemoLoginInputSchema, body));
  }
}
