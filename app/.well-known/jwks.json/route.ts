import { NextResponse } from "next/server";
import { getJWKS } from "@/lib/oauth/jwt";

export async function GET() {
  try {
    const jwks = await getJWKS();

    return NextResponse.json(jwks, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("JWKS error:", error);
    return NextResponse.json(
      { error: "Failed to generate JWKS" },
      { status: 500 }
    );
  }
}
