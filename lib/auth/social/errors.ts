export type SocialSigninErrorCode =
  | "social_access_denied"
  | "social_account_conflict"
  | "social_auth_failed"
  | "social_signup_disabled"
  | "social_signup_restricted"
  | "social_verified_email_required";

export function socialSigninErrorMessage(code: string | null): string | null {
  switch (code) {
    case "social_access_denied":
      return "Social sign-in was cancelled.";
    case "social_account_conflict":
      return "This provider is already linked to another account.";
    case "social_signup_disabled":
      return "Sign-up is currently disabled.";
    case "social_signup_restricted":
      return "Sign-up is restricted to approved email addresses.";
    case "social_verified_email_required":
      return "A verified email address is required to sign in.";
    case "social_auth_failed":
      return "Social sign-in could not be completed. Please try again.";
    default:
      return null;
  }
}
