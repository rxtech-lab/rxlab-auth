import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResetSentConfirmation() {
  return (
    <div className="w-full max-w-sm space-y-8 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
      </div>
      <div className="space-y-2">
        <h1
          className="text-3xl font-semibold tracking-tight"
          data-testid="check-email-heading"
        >
          Check your email
        </h1>
        <p className="text-muted-foreground text-[15px]">
          If an account exists with that email, we&apos;ve sent you a password
          reset link.
        </p>
      </div>
      <Link href="/login">
        <Button variant="outline" className="w-full">
          Back to login
        </Button>
      </Link>
    </div>
  );
}
