import { z } from "zod";

const DataScopeSchema = z.enum(["mock_demo", "production"]);

function isLocalHostUrl(value: string): boolean {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MOCK_DEMO_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  OUTBOUND_INTEGRATIONS: z.enum(["disabled", "enabled"]).default("disabled"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().url(),
  DATABASE_DATA_SCOPE: DataScopeSchema,
  JWT_SECRET: z.string().min(32),
  JWT_KEY_ID: z.string().min(1).default("local-demo-v1"),
  FINGERPRINT_HMAC_KEY: z.string().min(32),
  FINGERPRINT_KEY_ID: z.string().min(1).default("local-fingerprint-v1"),
  FINGERPRINT_PREVIOUS_HMAC_KEY: z.string().min(32).optional(),
  FINGERPRINT_PREVIOUS_KEY_ID: z.string().min(1).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().url(),
  OBJECT_STORAGE_DATA_SCOPE: DataScopeSchema,
  OBJECT_STORAGE_REGION: z.string().min(1).default("ap-southeast-1"),
  OBJECT_STORAGE_BUCKET: z.string().min(3),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(8),
  EVIDENCE_UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  EVIDENCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.MOCK_DEMO_ENABLED) {
    context.addIssue({
      code: "custom",
      message: "mock demo mode cannot run in production",
      path: ["MOCK_DEMO_ENABLED"],
    });
  }
  if (
    value.NODE_ENV === "production" &&
    (
      value.MOCK_DEMO_ENABLED
      || value.DATABASE_DATA_SCOPE !== "production"
      || value.OBJECT_STORAGE_DATA_SCOPE !== "production"
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "production requires production database and object storage scopes",
      path: ["DATABASE_DATA_SCOPE"],
    });
  }
  if (!value.MOCK_DEMO_ENABLED && value.NODE_ENV !== "production" && (
    value.DATABASE_DATA_SCOPE === "mock_demo" || value.OBJECT_STORAGE_DATA_SCOPE === "mock_demo"
  )) {
    context.addIssue({
      code: "custom",
      message: "mock_demo resources require mock demo mode",
      path: ["MOCK_DEMO_ENABLED"],
    });
  }
  if (value.MOCK_DEMO_ENABLED) {
    if (value.OUTBOUND_INTEGRATIONS !== "disabled") {
      context.addIssue({
        code: "custom",
        message: "mock demo mode requires outbound integrations disabled",
        path: ["OUTBOUND_INTEGRATIONS"],
      });
    } else if (value.NODE_ENV === "production") {
      // The production-specific issue above identifies this invalid combination.
    } else if (value.DATABASE_DATA_SCOPE !== "mock_demo" || value.OBJECT_STORAGE_DATA_SCOPE !== "mock_demo") {
      context.addIssue({
        code: "custom",
        message: "mock demo mode requires mock_demo database and object storage scopes",
        path: ["DATABASE_DATA_SCOPE"],
      });
    } else {
      const remoteResource = [
        ["DATABASE_URL", value.DATABASE_URL] as const,
        ["OBJECT_STORAGE_ENDPOINT", value.OBJECT_STORAGE_ENDPOINT] as const,
        ["WEB_ORIGIN", value.WEB_ORIGIN] as const,
      ].find(([, url]) => !isLocalHostUrl(url));
      if (remoteResource) {
        context.addIssue({
          code: "custom",
          message: "mock demo mode requires localhost-only database, object storage, and web origin",
          path: [remoteResource[0]],
        });
      }
    }
  }
  if ((value.FINGERPRINT_PREVIOUS_HMAC_KEY === undefined) !== (value.FINGERPRINT_PREVIOUS_KEY_ID === undefined)) {
    context.addIssue({
      code: "custom",
      message: "previous fingerprint key and key id must be configured together",
      path: ["FINGERPRINT_PREVIOUS_HMAC_KEY"],
    });
  }
});

export type AppConfig = z.infer<typeof EnvironmentSchema>;

let cached: AppConfig | undefined;

export function getConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  if (environment === process.env && cached) {
    return cached;
  }

  const parsed = EnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  if (environment === process.env) {
    cached = parsed.data;
  }
  return parsed.data;
}
