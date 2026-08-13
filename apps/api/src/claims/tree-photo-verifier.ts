import { Injectable } from "@nestjs/common";

export type TreePhotoVerification = {
  outcome: "pass" | "wrong_type" | "ambiguous" | "unavailable";
  modelVersion: string;
  nearestVisualSimilarityPercent?: number;
};

export interface TreePhotoVerifier {
  verify(evidenceIds: readonly string[]): Promise<TreePhotoVerification>;
}

export const TREE_PHOTO_VERIFIER = Symbol("TREE_PHOTO_VERIFIER");

/**
 * Fail-closed MVP adapter. The Gemini/provider integration is an external edge
 * and intentionally remains unavailable until credentials, privacy terms, and
 * an explicit provider approval exist.
 */
@Injectable()
export class UnavailableTreePhotoVerifier implements TreePhotoVerifier {
  async verify(_evidenceIds: readonly string[]): Promise<TreePhotoVerification> {
    return { outcome: "unavailable", modelVersion: "provider-unavailable" };
  }
}
