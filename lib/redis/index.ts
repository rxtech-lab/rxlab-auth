import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Key prefixes for different data types
export const REDIS_KEYS = {
  // WebAuthn challenges
  WEBAUTHN_CHALLENGE: (sessionId: string) => `webauthn:challenge:${sessionId}`,
  // OAuth authorization codes
  OAUTH_CODE: (code: string) => `oauth:code:${code}`,
  // Rate limiting
  RATE_LIMIT: (key: string) => `rate:${key}`,
  // Email verification (for quick lookup)
  EMAIL_VERIFICATION: (token: string) => `email:verify:${token}`,
  // Password reset (for quick lookup)
  PASSWORD_RESET: (token: string) => `password:reset:${token}`,
} as const;

// Default TTLs in seconds
export const TTL = {
  WEBAUTHN_CHALLENGE: 5 * 60, // 5 minutes
  OAUTH_CODE: 10 * 60, // 10 minutes
  EMAIL_VERIFICATION: 24 * 60 * 60, // 24 hours
  PASSWORD_RESET: 60 * 60, // 1 hour
  RATE_LIMIT_WINDOW: 15 * 60, // 15 minutes
} as const;

// OAuth authorization code data
export interface OAuthCodeData {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
  createdAt: number;
}

// WebAuthn challenge data
export interface WebAuthnChallengeData {
  challenge: string;
  userId?: string;
  type: "registration" | "authentication";
  createdAt: number;
}

// Helper functions
export async function storeOAuthCode(
  code: string,
  data: OAuthCodeData
): Promise<void> {
  await redis.set(REDIS_KEYS.OAUTH_CODE(code), JSON.stringify(data), {
    ex: TTL.OAUTH_CODE,
  });
}

export async function getOAuthCode(code: string): Promise<OAuthCodeData | null> {
  const data = await redis.get<string>(REDIS_KEYS.OAUTH_CODE(code));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function deleteOAuthCode(code: string): Promise<void> {
  await redis.del(REDIS_KEYS.OAUTH_CODE(code));
}

export async function storeWebAuthnChallenge(
  sessionId: string,
  data: WebAuthnChallengeData
): Promise<void> {
  await redis.set(
    REDIS_KEYS.WEBAUTHN_CHALLENGE(sessionId),
    JSON.stringify(data),
    { ex: TTL.WEBAUTHN_CHALLENGE }
  );
}

export async function getWebAuthnChallenge(
  sessionId: string
): Promise<WebAuthnChallengeData | null> {
  const data = await redis.get<string>(REDIS_KEYS.WEBAUTHN_CHALLENGE(sessionId));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function deleteWebAuthnChallenge(sessionId: string): Promise<void> {
  await redis.del(REDIS_KEYS.WEBAUTHN_CHALLENGE(sessionId));
}

// Rate limiting helper
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number = TTL.RATE_LIMIT_WINDOW
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redisKey = REDIS_KEYS.RATE_LIMIT(key);
  const now = Date.now();

  // Get current count
  const current = await redis.get<number>(redisKey);
  const count = current ?? 0;

  if (count >= maxAttempts) {
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + ttl * 1000,
    };
  }

  // Increment and set expiry if new
  if (count === 0) {
    await redis.set(redisKey, 1, { ex: windowSeconds });
  } else {
    await redis.incr(redisKey);
  }

  return {
    allowed: true,
    remaining: maxAttempts - count - 1,
    resetAt: now + windowSeconds * 1000,
  };
}
