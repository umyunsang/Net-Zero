import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { UserRole } from "@net-zero/contracts";

import { AuthService } from "./auth.service.js";
import {
  IS_PUBLIC_METADATA_KEY,
  ROLES_METADATA_KEY,
  type CurrentAuthUser,
} from "./auth.types.js";

interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  method?: string;
  url?: string;
  user?: CurrentAuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "กรุณาเข้าสู่ระบบ",
      });
    }

    let user: CurrentAuthUser;
    try {
      const payload = this.authService.verifyAccessToken(token);
      const allowDeletionRetry = request.method === "DELETE" && request.url === "/api/account";
      user = await this.authService.authenticateToken(payload, allowDeletionRetry);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "โทเค็นไม่ถูกต้องหรือหมดอายุ",
      });
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์เข้าถึงรายการนี้",
      });
    }

    request.user = user;
    return true;
  }
}

function extractBearerToken(authorization: string | string[] | undefined): string | undefined {
  if (typeof authorization !== "string") {
    return undefined;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1];
}
