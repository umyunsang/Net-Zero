import { z } from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "ต้องเป็น SHA-256 แบบ hex 64 ตัวอักษร");
const CaptureSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  camera: z.object({ make: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(120) }).strict().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).strict().refine((value) => (value.latitude === undefined) === (value.longitude === undefined), "ต้องระบุพิกัดละติจูดและลองจิจูดพร้อมกัน");

export const EvidenceInitSchema = z.object({
  claimDraftId: z.string().uuid().optional(),
  kind: z.enum(["photo", "gps_trace"]),
  mimeType: z.enum(["image/jpeg", "image/webp", "application/json"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: Sha256Schema,
  fixtureId: z.string().trim().min(1).max(120).optional(),
  capture: CaptureSchema,
}).strict().superRefine((value, context) => {
  if (value.kind === "photo" && value.mimeType === "application/json") context.addIssue({ code: "custom", message: "หลักฐานภาพต้องเป็น JPEG หรือ WebP", path: ["mimeType"] });
  if (value.kind === "gps_trace" && value.mimeType !== "application/json") context.addIssue({ code: "custom", message: "ร่องรอย GPS ต้องเป็น JSON", path: ["mimeType"] });
  if (value.kind === "photo" && !value.capture.camera) context.addIssue({ code: "custom", message: "หลักฐานภาพต้องระบุข้อมูลกล้อง", path: ["capture", "camera"] });
  if (value.kind === "gps_trace" && value.capture.camera) context.addIssue({ code: "custom", message: "ร่องรอย GPS ต้องไม่มีข้อมูลกล้อง", path: ["capture", "camera"] });
  if (value.fixtureId === undefined && value.capture.camera?.make === "ผู้ให้บริการฟิกซ์เจอร์สังเคราะห์") context.addIssue({ code: "custom", message: "ฟิกซ์เจอร์สังเคราะห์ต้องระบุ fixtureId", path: ["fixtureId"] });
});

export const EvidenceFinalizeSchema = z.object({ sha256: Sha256Schema }).strict();
export type EvidenceInit = z.infer<typeof EvidenceInitSchema>;
export type EvidenceUploadState = "draft" | "uploading" | "uploaded" | "finalized" | "failed" | "revoked" | "tombstoned";
export type EvidenceSession = {
  id: string; userId: string; claimDraftId: string; objectKey: string; expectedSha256: string;
  byteSize: number; contentType: "image/jpeg" | "image/webp" | "application/json";
  uploadTokenHash: string | null; state: EvidenceUploadState; expiresAt: Date; evidenceId: string | null; fixtureId: string | null;
};
