// OpenID Connect with Pocket ID: authorization code flow + PKCE, state and nonce.
// Config: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, APP_URL (read on first use, so code that
// never logs anyone in, like most tests, doesn't need them).
import * as oauth from "oauth4webapi";

export const ROLES = ["admin", "accountant", "operator", "viewer"] as const; // most privileged first
export type Role = (typeof ROLES)[number];
const GROUP_PREFIX = "accountant-"; // Pocket ID groups: accountant-admin, accountant-operator, …

/** The most privileged role among the user's Pocket ID groups, or null when none matches. */
export function roleFromGroups(groups: unknown): Role | null {
  if (!Array.isArray(groups)) return null;
  return ROLES.find((role) => groups.includes(GROUP_PREFIX + role)) ?? null;
}

export type OidcConfig = { issuer: URL; clientId: string; clientSecret: string; appUrl: URL };

export function oidcConfig(env: Record<string, string | undefined> = process.env): OidcConfig {
  const missing = ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "APP_URL"].filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`Sign-in is not configured: set ${missing.join(", ")} (see .env.example).`);
  return {
    issuer: new URL(env.OIDC_ISSUER!),
    clientId: env.OIDC_CLIENT_ID!,
    clientSecret: env.OIDC_CLIENT_SECRET!,
    appUrl: new URL(env.APP_URL!),
  };
}

/** What we keep (in a signed, short-lived cookie) between redirecting to Pocket ID and its callback. */
export type PendingLogin = { verifier: string; state: string; nonce: string; returnTo: string };

export type OidcUser = { sub: string; email: string | null; name: string; groups: unknown; idToken: string };

export function createOidc(getConfig: () => OidcConfig = oidcConfig) {
  let cached: Promise<{ cfg: OidcConfig; as: oauth.AuthorizationServer }> | undefined;

  function setup() {
    cached ??= (async () => {
      const cfg = getConfig();
      const response = await oauth.discoveryRequest(cfg.issuer, insecure(cfg));
      return { cfg, as: await oauth.processDiscoveryResponse(cfg.issuer, response) };
    })().catch((err) => {
      cached = undefined; // retry discovery next time, e.g. when Pocket ID was briefly down
      throw err;
    });
    return cached;
  }

  // Plain http only for a local/test issuer; real issuers must be https.
  const insecure = (cfg: OidcConfig) =>
    cfg.issuer.protocol === "http:" && process.env.NODE_ENV !== "production" ? { [oauth.allowInsecureRequests]: true } : {};
  const redirectUri = (cfg: OidcConfig) => new URL("/api/auth/callback", cfg.appUrl).href;

  return {
    /** The Pocket ID URL to send the browser to, and what to remember until it comes back. */
    async start(returnTo: string): Promise<{ url: URL; pending: PendingLogin }> {
      const { cfg, as } = await setup();
      const pending = {
        verifier: oauth.generateRandomCodeVerifier(),
        state: oauth.generateRandomState(),
        nonce: oauth.generateRandomNonce(),
        returnTo,
      };
      const url = new URL(as.authorization_endpoint!);
      url.search = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri(cfg),
        response_type: "code",
        scope: "openid profile email groups",
        code_challenge: await oauth.calculatePKCECodeChallenge(pending.verifier),
        code_challenge_method: "S256",
        state: pending.state,
        nonce: pending.nonce,
      }).toString();
      return { url, pending };
    },

    /** Checks the callback (state), redeems the code (PKCE) and validates the ID token (iss, aud, exp, nonce). */
    async finish(callbackUrl: URL, pending: PendingLogin): Promise<OidcUser> {
      const { cfg, as } = await setup();
      const client = { client_id: cfg.clientId };
      const params = oauth.validateAuthResponse(as, client, callbackUrl, pending.state);
      const response = await oauth.authorizationCodeGrantRequest(
        as, client, oauth.ClientSecretPost(cfg.clientSecret), params, redirectUri(cfg), pending.verifier, insecure(cfg),
      );
      const result = await oauth.processAuthorizationCodeResponse(as, client, response, { expectedNonce: pending.nonce, requireIdToken: true });
      const claims = oauth.getValidatedIdTokenClaims(result)!;
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      return {
        sub: claims.sub,
        email: str(claims.email),
        name: str(claims.name) ?? str(claims.preferred_username) ?? str(claims.email) ?? claims.sub,
        groups: claims.groups,
        idToken: result.id_token!,
      };
    },

    /**
     * Pocket ID's logout URL, which ends the Pocket ID session too. It only redirects back to the app
     * when given the session's ID token as a hint; without one the user stays on Pocket ID.
     */
    async endSessionUrl(idTokenHint: string | null): Promise<string | null> {
      const { cfg, as } = await setup();
      if (!as.end_session_endpoint) return null;
      const url = new URL(as.end_session_endpoint);
      url.searchParams.set("client_id", cfg.clientId);
      if (idTokenHint) url.searchParams.set("id_token_hint", idTokenHint);
      url.searchParams.set("post_logout_redirect_uri", new URL("/", cfg.appUrl).href);
      return url.href;
    },
  };
}

export type Oidc = ReturnType<typeof createOidc>;
