import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SocialSigninConfirmationCard } from "@/components/auth/social-signin-confirmation-card";
import {
  pendingSocialSigninCookieName,
  verifyPendingSocialSignin,
} from "@/lib/auth/social/pending";

export const metadata = {
  title: "Confirm Social Sign-In - RxLab Auth",
  description: "Confirm how your social account will be used",
};

export default async function SocialSigninConfirmationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(pendingSocialSigninCookieName)?.value;
  if (!token) redirect("/login?error=social_auth_failed");

  let pending;
  try {
    pending = await verifyPendingSocialSignin(token);
  } catch {
    redirect("/login?error=social_auth_failed");
  }

  return (
    <SocialSigninConfirmationCard
      kind={pending.kind}
      profile={pending.profile}
    />
  );
}
