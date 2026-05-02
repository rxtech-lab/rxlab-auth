import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";

export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
export const rpName = process.env.WEBAUTHN_RP_NAME || "RxLab Auth";
export const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export function getRegistrationOptions(
  userId: string,
  userEmail: string,
  userDisplayName: string,
  excludeCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = []
): GenerateRegistrationOptionsOpts {
  return {
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    userDisplayName: userDisplayName || userEmail,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    // PRF extension isn't in @simplewebauthn's DOM types yet, but is passed
    // through to the client and enables HKDF-based symmetric key derivation
    // at authentication time (e.g. for E2EE key wrapping).
    extensions: { prf: {} } as GenerateRegistrationOptionsOpts["extensions"],
  };
}

export function getAuthenticationOptions(
  allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = []
): GenerateAuthenticationOptionsOpts {
  return {
    rpID,
    allowCredentials,
    userVerification: "preferred",
  };
}

// Transports type conversion helper
export function parseTransports(
  transportsJson: string | null
): AuthenticatorTransport[] {
  if (!transportsJson) return [];
  try {
    return JSON.parse(transportsJson) as AuthenticatorTransport[];
  } catch {
    return [];
  }
}

// Base64URL encoding/decoding helpers
export function base64UrlEncode(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const buffer = Buffer.from(padded, "base64");
  // Create a proper Uint8Array with ArrayBuffer backing
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; i++) {
    uint8Array[i] = buffer[i];
  }
  return uint8Array;
}
