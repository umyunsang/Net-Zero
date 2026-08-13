import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { z } from "zod";

import { UserRoleSchema, type UserRole } from "@net-zero/contracts";

export const DEMO_USER_IDS = {
  user: "11111111-1111-4111-8111-111111111111",
  reviewer: "22222222-2222-4222-8222-222222222222",
  merchant: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
} as const satisfies Record<UserRole, string>;

export const DEMO_USER_DEFAULTS = {
  user: { email: "demo.user@netzero.local", displayName: "ผู้ใช้สาธิต" },
  reviewer: { email: "demo.reviewer@netzero.local", displayName: "ผู้ตรวจสอบสาธิต" },
  merchant: { email: "demo.merchant@netzero.local", displayName: "ผู้ค้าสาธิต" },
  admin: { email: "demo.admin@netzero.local", displayName: "ผู้ดูแลระบบสาธิต" },
} as const satisfies Record<UserRole, { email: string; displayName: string }>;

export const DemoLoginInputSchema = z
  .object({
    role: UserRoleSchema,
  })
  .strict();

export type DemoLoginInput = z.infer<typeof DemoLoginInputSchema>;

export interface CurrentAuthUser {
  id: string;
  role: UserRole;
  displayName: string;
}

export interface JwtAccessTokenPayload {
  sub: string;
  role: UserRole;
  is_demo: true;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

/**
 * Boundary reserved for a future external identity provider.
 * The Functional MVP intentionally has no discovery, callback, or token exchange implementation.
 */
export interface IdentityProvider {
  verifyExternalToken(token: string): Promise<never>;
}

export const ROLES_METADATA_KEY = "net-zero:roles";
export const IS_PUBLIC_METADATA_KEY = "net-zero:public";

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_METADATA_KEY, roles);
export const Public = () => SetMetadata(IS_PUBLIC_METADATA_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAuthUser => {
    const request = context.switchToHttp().getRequest<{ user: CurrentAuthUser }>();
    return request.user;
  },
);
