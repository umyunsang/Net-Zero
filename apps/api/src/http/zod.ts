import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

export function parseWithSchema<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "ข้อมูลคำขอไม่ถูกต้อง",
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: "ค่าไม่ถูกต้อง",
        })),
      },
    });
  }
  return parsed.data;
}
