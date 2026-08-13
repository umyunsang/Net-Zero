import type { IdentityProvider } from "./auth.types.js";

/**
 * Deliberately inactive MVP boundary. No discovery, callback, client registration,
 * token exchange, or outbound identity request is implemented.
 */
export class OidcIdentityProviderAdapter implements IdentityProvider {
  async verifyExternalToken(_token: string): Promise<never> {
    throw new Error("external_identity_provider_not_configured");
  }
}
