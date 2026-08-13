import syntheticFixtures from "./synthetic-fixtures.json";
import syntheticFixturePhotoUrl from "./synthetic-fixture.jpg?url";
import type { CapturedPhoto, GpsSample } from "./product-types";
import { translateCurrent } from "./localization";
import { IS_PUBLIC_PRESENTATION_DEMO, PublicDemoApiError, publicDemoApi, publicDemoEvidenceId } from "./public-demo";

export const TOKEN_KEY = "net-zero-access-token";
export const SYNTHETIC_FIXTURE_ID = syntheticFixtures.fixtureId;
export const TREE_FIXTURE_LOCATION = syntheticFixtures.treeLocation;
export const DEMO_BUS_ROUTE = syntheticFixtures.busRoute;
export const SYNTHETIC_SAMPLING_INTERVAL_MS = syntheticFixtures.samplingIntervalMilliseconds;

const apiErrorMessages: Record<string, string> = {
  VALIDATION_ERROR: "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  UNAUTHENTICATED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ",
  NOT_FOUND: "ไม่พบข้อมูลที่ต้องการ",
  CONFLICT: "ข้อมูลมีการเปลี่ยนแปลงหรือคำขอนี้ดำเนินการไปแล้ว",
  RATE_LIMITED: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่",
  UPLOAD_INVALID: "ไฟล์หลักฐานไม่ตรงตามเงื่อนไข",
  UPLOAD_EXPIRED: "ช่วงเวลาอัปโหลดหลักฐานหมดอายุแล้ว กรุณาเริ่มใหม่",
  EVIDENCE_REQUIRED: "ต้องมีหลักฐานก่อนส่งกิจกรรม",
  FACTOR_NOT_APPROVED: "กิจกรรมนี้ยังไม่พร้อมให้คะแนน กรุณารอตรวจสอบอีกครั้ง",
  VOUCHER_UNAVAILABLE: "รางวัลนี้ยังแลกไม่ได้หรือคะแนนไม่เพียงพอ",
  VOUCHER_ALREADY_REDEEMED: "บัตรรางวัลนี้ถูกใช้แล้ว",
  INTERNAL_ERROR: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่",
};

export function idempotencyKey(): string {
  return crypto.randomUUID();
}

export async function api<T>(path: string, method = "GET", body?: unknown, headers: HeadersInit = {}): Promise<T> {
  if (IS_PUBLIC_PRESENTATION_DEMO) {
    try {
      return await publicDemoApi<T>(path, method, body);
    } catch (cause) {
      if (cause instanceof PublicDemoApiError) throw new Error(translateCurrent(apiErrorMessages[cause.code] ?? "คำขอไม่สำเร็จ กรุณาลองใหม่ ({status})", { status: 400 }));
      throw cause;
    }
  }
  const token = sessionStorage.getItem(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(translateCurrent("ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบเครือข่าย"));
  }

  if (!response.ok) {
    let code = "";
    try {
      const parsed = await response.json() as { code?: string };
      code = parsed.code ?? "";
    } catch {
      // Malformed provider responses still use client-owned Thai copy.
    }
    throw new Error(translateCurrent(apiErrorMessages[code] ?? "คำขอไม่สำเร็จ กรุณาลองใหม่ ({status})", { status: response.status }));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type Capture = {
  capturedAt: string;
  camera?: { make: string; model: string };
  latitude?: number;
  longitude?: number;
};

async function uploadEvidence(blob: Blob, kind: "photo" | "gps_trace", capture: Capture): Promise<string> {
  if (IS_PUBLIC_PRESENTATION_DEMO) return publicDemoEvidenceId(kind);
  const digest = await sha256(blob);
  const init = await api<{ uploadId: string; uploadToken: string }>("/evidence/init", "POST", {
    kind,
    mimeType: blob.type,
    sizeBytes: blob.size,
    sha256: digest,
    fixtureId: SYNTHETIC_FIXTURE_ID,
    capture,
  });
  const token = sessionStorage.getItem(TOKEN_KEY);
  const upload = await fetch(`/api/evidence/${init.uploadId}/content`, {
    method: "POST",
    headers: {
      "content-type": blob.type,
      "x-upload-token": init.uploadToken,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });
  if (!upload.ok) throw new Error(translateCurrent("อัปโหลดหลักฐานไม่สำเร็จ"));
  const finalized = await api<{ evidenceId: string }>(`/evidence/${init.uploadId}/finalize`, "POST", { sha256: digest });
  return finalized.evidenceId;
}

export async function syntheticPhoto(activity: "tree" | "recycling"): Promise<CapturedPhoto> {
  const response = await fetch(syntheticFixturePhotoUrl);
  if (!response.ok) throw new Error(translateCurrent("เตรียมรูปสำหรับสาธิตไม่ได้"));
  return {
    blob: new Blob([await response.arrayBuffer()], { type: "image/jpeg" }),
    capturedAt: syntheticFixtures.capturedAt,
    trackLabel: `${SYNTHETIC_FIXTURE_ID}-${activity.toUpperCase()}`,
  };
}

export async function uploadPhoto(photo: CapturedPhoto, position?: typeof TREE_FIXTURE_LOCATION): Promise<string> {
  return uploadEvidence(photo.blob, "photo", {
    capturedAt: photo.capturedAt,
    camera: {
      make: translateCurrent("ผู้ให้บริการฟิกซ์เจอร์สังเคราะห์"),
      model: photo.trackLabel,
    },
    ...(position ? { latitude: position.latitude, longitude: position.longitude } : {}),
  });
}

export async function uploadGpsTrace(samples: GpsSample[]): Promise<string> {
  const blob = new Blob([JSON.stringify(samples)], { type: "application/json" });
  return uploadEvidence(blob, "gps_trace", {
    capturedAt: samples[0]!.recordedAt,
    latitude: Number(samples[0]!.latitude),
    longitude: Number(samples[0]!.longitude),
  });
}

export async function openEvidence(id: string): Promise<void> {
  if (IS_PUBLIC_PRESENTATION_DEMO) {
    window.open(syntheticFixturePhotoUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api/evidence/${id}/content`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(translateCurrent("เปิดหลักฐานไม่ได้"));
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
