import * as jose from "jose";
import type { CryptoKey as JoseCryptoKey } from "jose";

let privateKey: JoseCryptoKey | null = null;
let publicKey: JoseCryptoKey | null = null;
let keyId: string | null = null;

async function getPrivateKey(): Promise<JoseCryptoKey> {
  if (!privateKey) {
    const pemKey = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, "\n");
    privateKey = await jose.importPKCS8(pemKey, "RS256");
  }
  return privateKey;
}

async function getPublicKey(): Promise<JoseCryptoKey> {
  if (!publicKey) {
    const pemKey = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, "\n");
    publicKey = await jose.importSPKI(pemKey, "RS256");
  }
  return publicKey;
}

function getKeyId(): string {
  if (!keyId) {
    // Generate a deterministic key ID based on the public key
    keyId = "rxlab-auth-key-1";
  }
  return keyId;
}

export interface AccessTokenPayload {
  sub: string; // user ID
  client_id: string;
  scope: string;
  roles?: string[];
}

export interface IdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  roles?: string[];
  nonce?: string;
  auth_time: number;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn: string = "1h"
): Promise<string> {
  const issuer = process.env.OAUTH_ISSUER_URL!;
  const key = await getPrivateKey();

  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function signIdToken(
  payload: IdTokenPayload,
  audience: string,
  expiresIn: string = "1h"
): Promise<string> {
  const issuer = process.env.OAUTH_ISSUER_URL!;
  const key = await getPrivateKey();

  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyAccessToken(
  token: string
): Promise<jose.JWTPayload & AccessTokenPayload> {
  const issuer = process.env.OAUTH_ISSUER_URL!;
  const key = await getPublicKey();

  const { payload } = await jose.jwtVerify(token, key, {
    issuer,
  });

  return payload as jose.JWTPayload & AccessTokenPayload;
}

export async function getJWKS(): Promise<jose.JSONWebKeySet> {
  const key = await getPublicKey();
  const jwk = await jose.exportJWK(key);

  return {
    keys: [
      {
        ...jwk,
        kid: getKeyId(),
        use: "sig",
        alg: "RS256",
      },
    ],
  };
}

// Generate refresh token (opaque, random)
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Generate authorization code
export function generateAuthorizationCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
