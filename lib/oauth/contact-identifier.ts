// Normalize the contact identifier returned by the iOS/macOS
// ASAuthorizationAccountCreationProvider sheet into the canonical form we
// store on the user row.
//
// The users table has only an `email` column (no phone column today), so
// phone-typed identifiers are stored as a synthetic email of the form
// `<E164-digits>@phone.rxlab.local` with `emailVerified=false`. This keeps
// the existing unique-email constraint and lookup paths working without a
// schema migration. A follow-up should add a dedicated `phone` column.

const PHONE_SYNTHETIC_DOMAIN = "phone.rxlab.local";

// RFC-ish email check: same shape Zod's .email() validates against.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type NormalizedContact =
  | { ok: true; type: "email"; storageEmail: string; emailVerified: true }
  | {
      ok: true;
      type: "phone_number";
      storageEmail: string;
      emailVerified: false;
      e164: string;
    }
  | { ok: false; reason: string };

export function normalizeContactIdentifier(
  raw: string,
  type: "email" | "phone_number",
): NormalizedContact {
  if (type === "email") {
    const email = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { ok: false, reason: "contact_identifier must be a valid email" };
    }
    return { ok: true, type: "email", storageEmail: email, emailVerified: true };
  }

  // phone_number: keep digits only; require leading + or assume one.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) {
    return {
      ok: false,
      reason: "contact_identifier must be a valid phone number",
    };
  }
  const e164 = `+${digits}`;
  // Reject obvious malformed inputs (e.g. multiple plus signs in the middle).
  if (!hasPlus && trimmed.includes("+")) {
    return {
      ok: false,
      reason: "contact_identifier must be a valid phone number",
    };
  }
  return {
    ok: true,
    type: "phone_number",
    storageEmail: `${digits}@${PHONE_SYNTHETIC_DOMAIN}`,
    emailVerified: false,
    e164,
  };
}

export { PHONE_SYNTHETIC_DOMAIN };
