import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";

import type { DemoLoginResponse, UserRole } from "@net-zero/contracts";

import { getConfig } from "../config.js";
import { DatabaseService } from "../database/database.service.js";
import {
  DEMO_USER_DEFAULTS,
  DEMO_USER_IDS,
  type CurrentAuthUser,
  type DemoLoginInput,
  type JwtAccessTokenPayload,
} from "./auth.types.js";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const JWT_ISSUER = "net-zero-api";
const JWT_AUDIENCE = "net-zero-web";

interface UserRow {
  id: string;
  role: UserRole;
  display_name: string;
  is_demo: boolean;
  account_deletion_state: "active" | "deleting" | "deleted";
  deleted_at: Date | null;
}

@Injectable()
export class AuthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async demoLogin(input: DemoLoginInput): Promise<DemoLoginResponse> {
    if (getConfig().NODE_ENV === "production" || !getConfig().MOCK_DEMO_ENABLED) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "ระบบบัญชีสาธิตไม่เปิดใช้งานในสภาพแวดล้อมจริง",
      });
    }
    const demoUser = DEMO_USER_DEFAULTS[input.role];

    const user = await this.database.transaction(async (client) => {
      const result = await client.query<UserRow>(
        `INSERT INTO users (id, email, display_name, role, is_demo)
         VALUES ($1::uuid, $2, $3, $4::user_role, true)
         ON CONFLICT (id) DO UPDATE
           SET email = EXCLUDED.email,
               display_name = EXCLUDED.display_name,
               role = EXCLUDED.role,
               is_demo = true
         WHERE users.deleted_at IS NULL
           AND users.account_deletion_state = 'active'
         RETURNING id, role, display_name, is_demo, account_deletion_state, deleted_at`,
        [DEMO_USER_IDS[input.role], demoUser.email, demoUser.displayName, input.role],
      );

      if (result.rowCount === 1) {
        return result.rows[0]!;
      }

      const existing = await client.query<UserRow>(
        "SELECT id, role, display_name, is_demo, account_deletion_state, deleted_at FROM users WHERE id = $1::uuid FOR KEY SHARE",
        [DEMO_USER_IDS[input.role]],
      );
      const existingUser = existing.rows[0];
      if (existingUser?.deleted_at) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "บัญชีผู้ใช้ถูกปิดใช้งาน",
        });
      }
      throw new Error("Unable to create the demo account");
    });

    return this.createLoginResponse(user);
  }

  async authenticateToken(payload: JwtAccessTokenPayload, allowDeletionRetry = false): Promise<CurrentAuthUser> {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException({ code: "UNAUTHENTICATED", message: "โทเค็นไม่ถูกต้อง" });
    }

    const result = await this.database.query<UserRow>(
      "SELECT id, role, display_name, is_demo, account_deletion_state, deleted_at FROM users WHERE id = $1::uuid",
      [payload.sub],
    );
    const user = result.rows[0];
    if (
      !user ||
      user.deleted_at ||
      (
        user.account_deletion_state !== "active" &&
        !(allowDeletionRetry && user.account_deletion_state === "deleting")
      ) ||
      user.role !== payload.role ||
      !user.is_demo
    ) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "โทเค็นไม่ถูกต้องหรือหมดอายุ",
      });
    }

    return { id: user.id, role: user.role, displayName: user.display_name };
  }

  verifyAccessToken(token: string): JwtAccessTokenPayload {
    const config = getConfig();
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || decoded.header.kid !== config.JWT_KEY_ID) {
      throw new Error("Invalid access token key identifier");
    }

    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !isUserRole(payload.role) ||
      payload.is_demo !== true ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > ACCESS_TOKEN_TTL_SECONDS ||
      payload.iat > Math.floor(Date.now() / 1_000) + 60
    ) {
      throw new Error("Invalid access token payload");
    }

    return { sub: payload.sub, role: payload.role, is_demo: true };
  }

  private createLoginResponse(user: UserRow): DemoLoginResponse {
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1_000);
    const accessToken = jwt.sign(
      { role: user.role, is_demo: true },
      getConfig().JWT_SECRET,
      {
        algorithm: "HS256",
        keyid: getConfig().JWT_KEY_ID,
        subject: user.id,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, role: user.role, displayName: user.display_name },
    };
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "reviewer" || value === "merchant" || value === "admin";
}
