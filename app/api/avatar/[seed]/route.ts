import { NextRequest, NextResponse } from "next/server";
import { generateIdenticon } from "@/lib/identicon/generate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seed: string }> }
) {
  const { seed } = await params;

  if (!seed) {
    return NextResponse.json({ error: "Seed is required" }, { status: 400 });
  }

  const svg = generateIdenticon(seed);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
