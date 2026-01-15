import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Create Account - RxLab Auth",
  description: "Create a new account",
};

function RegisterFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
