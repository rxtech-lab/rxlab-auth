import { NextResponse } from "next/server";
import { getOpenIDConfiguration } from "@/lib/oauth/discovery";

export async function GET() {
  const config = getOpenIDConfiguration();

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
