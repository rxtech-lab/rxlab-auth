import { defineConfig, devices } from "@playwright/test";

// Test JWT keys for E2E testing (valid RSA key pair)
const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCtUeIUxetWRGHe
OFKYoj/fDv4z36I3a0GDip+9NE6JQYk3Qq8mjMOdAdPLOkBCoO0/NtiZD1YqW5pD
4ViqaYx4rh5pMKMZmc4PaF6OJChC8vUDtiljzA0UR8cL7D8cjN87xTe7bsap3Ohj
tB2ANb6ZZ0nibTV7TJCpKVSeC8fQpoDvM9SrBRag5CNElEOp/v0DKLlF6Z26/Lun
jcaAMyzvqLBBKociphImmJAOm95DeYpzqn/P7MH0Y3yWVClcnpne9X+8tNb8vlLV
yFdJ/9R1+eANALo5Lcb84/iWaozoYO1Xy+Wk+DJzaS1zDk2yx1/6pfP0Nd04dtGO
TUONxJN7AgMBAAECggEAH8gXlmqSlG+WqKqYTr/VyX/U0ktMUjA7Q7U8RHQegKHB
WR5DwuRmDFjk7uvAE9exmXljr3F2Ae9pMtBUM2+GYCzBi9Vs2wlulTm0uQjdTyWB
E0yoe1HUBieBUujfy8rzNmEcLqUKDeThwkKpdDSmvjeH/1q6R2FLV5GqIA8V9Wb9
GPYXODtyFPwLrV6DQ/+lbkA5wvwu/+ZuhXv07xu2LgZmAStJ54iVtMQ9YykojTkS
7zvqUYpj5lkxEaNSwtjNYnOOMMtL2U5avCv4qlK4z72LxYj3Kr6SOlkgdI65xD0X
VuNnlKoTXmWNhLwSC31jj6rzvs/UiK6rwyxIPriu/QKBgQDrt12e/+8H7dVVbt+A
KvMaBHX6+LZweVgT1nOwgZeh+jgKsnoTz8Yk90rS3zYvyPYWIbtkubdSGMfb1Tux
V4SLh7FXZS+y1va1XcarufbOpzRoMymdfrBWjs77+iSuRePS1pgFYyJ27nC9XDdu
b1QqoodOr2ilplH/DEmz2R2sVwKBgQC8O/ndo/UAEPdWDc/ujEQwqkje7qExUshG
S/wHuHzyVWey+fNZQ6IXcOT+Eu+3OcXyMEeVanyZM1FsWrViK7tqb5LKuLu27b1j
nzV9zJFrEZ70EslujoGi5ZSEWDVVC0yC6w8enjrq5XB/zd3U/peEWmYVp2XGy+EX
yUImL0/bfQKBgEXQur8ESPUNQXmbbEFW90gGeDdMgSTRHABMLVnjGFlWdlDcygGi
MarzP8szZ6ZBnHmzpgBQbXa4dkGrZ5HAPTbiiuk6xCTxPIM9ckGcw/gzV/dg5/uI
8YvBopbJYSHo+3CQNNiroyKcvvGnJZflC4XRO8hXdeRSXcjwB8hoDzzjAoGAa1A6
JH0b6XzCtcHMILDBE4mRX99l8IvEeCdLuU8ZlMLSCvxrGyHu4DRRqPQ8zBXY3zld
Jjb+cA0Mx5xzOlO6VnTjmEV3Z1PknE4hHeYppYP3PikTw77k82y1njn3tdNqPF0s
UoVdC5vg5kwEwzCeSyuKdZ/o60xCuN/ZoZFpkrUCgYEA45eGuwU54CcdUnsuGhVs
Lw+M3yxvp9pyRjaLZL/v8A+fPPpHni2kApzyhrhFkkthX2KBIHgMRknJoNBy2TWU
+rkP2qxaYBjY1TkZWiHq/R8xpwdGRc5HfJK7gijeGn57FMD3xcq69ZSmzg/Vf9tp
fMP/ad7ms7SHqZVLYJ7cA8g=
-----END PRIVATE KEY-----`;

const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArVHiFMXrVkRh3jhSmKI/
3w7+M9+iN2tBg4qfvTROiUGJN0KvJozDnQHTyzpAQqDtPzbYmQ9WKluaQ+FYqmmM
eK4eaTCjGZnOD2hejiQoQvL1A7YpY8wNFEfHC+w/HIzfO8U3u27GqdzoY7QdgDW+
mWdJ4m01e0yQqSlUngvH0KaA7zPUqwUWoOQjRJRDqf79Ayi5Remduvy7p43GgDMs
76iwQSqHIqYSJpiQDpveQ3mKc6p/z+zB9GN8llQpXJ6Z3vV/vLTW/L5S1chXSf/U
dfngDQC6OS3G/OP4lmqM6GDtV8vlpPgyc2ktcw5Nssdf+qXz9DXdOHbRjk1DjcST
ewIDAQAB
-----END PUBLIC KEY-----`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  // Use 1 worker for in-memory SQLite (each worker gets separate DB)
  workers: 1,
  reporter: "html",
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command:
        "lsof -ti:3001 | xargs kill -9 2>/dev/null || true; bun run e2e/mock-oauth-callback-server.ts",
      url: "http://localhost:3001/health",
      timeout: 10 * 1000,
      reuseExistingServer: true,
    },
    {
      command: "bun run dev",
      url: "http://localhost:3000",
      timeout: 30 * 1000,
      reuseExistingServer: true,
      env: {
        // Testing flags (both server and client side)
        E2E_SKIP_EMAIL_VERIFICATION: "true",
        NEXT_PUBLIC_E2E_SKIP_EMAIL_VERIFICATION: "true",

        // Database (in-memory SQLite for E2E tests)
        TURSO_DATABASE_URL: "file::memory:",
        TURSO_AUTH_TOKEN: "",

        // Session
        SESSION_SECRET: "e2e-test-session-secret-minimum-32-characters",

        // Redis (local docker via serverless-redis-http)
        UPSTASH_REDIS_REST_URL: "http://localhost:8079",
        UPSTASH_REDIS_REST_TOKEN: "e2e-test-token",

        // Email (mock)
        RESEND_API_KEY: "re_mock_key",

        // OAuth/OIDC
        OAUTH_ISSUER_URL: "http://localhost:3000",
        JWT_PRIVATE_KEY: testPrivateKey.replace(/\n/g, "\\n"),
        JWT_PUBLIC_KEY: testPublicKey.replace(/\n/g, "\\n"),

        // Admin
        ADMIN_PASSWORD: "e2e-test-admin-password",

        // Storage (mock)
        BLOB_READ_WRITE_TOKEN: "vercel_blob_mock",

        // App
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_APP_NAME: "RxLab Auth",

        // WebAuthn
        WEBAUTHN_RP_ID: "localhost",
        WEBAUTHN_RP_NAME: "RxLab Auth",
        WEBAUTHN_ORIGIN: "http://localhost:3000",
      },
    },
  ],
});
