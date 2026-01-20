import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TokenExpiredErrorProps {
  error?: string;
}

export function TokenExpiredError({ error }: TokenExpiredErrorProps) {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <XCircle className="size-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Link expired</h1>
        <p className="text-muted-foreground text-sm">
          {error || "This link has expired or already been used"}
        </p>
      </div>
      <Link href="/reset-password">
        <Button variant="outline" className="w-full">
          Request a new link
        </Button>
      </Link>
    </div>
  );
}
