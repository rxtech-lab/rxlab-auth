import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import {
  AVATAR_MAX_FILE_SIZE,
  AVATAR_ALLOWED_TYPES,
} from "@/lib/constants/avatar";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // Authenticate user
        const session = await getSession();
        if (!session.isLoggedIn || !session.userId) {
          throw new Error("Not authenticated");
        }

        return {
          allowedContentTypes: AVATAR_ALLOWED_TYPES as unknown as string[],
          maximumSizeInBytes: AVATAR_MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            userId: session.userId,
            ...(clientPayload ? { clientPayload } : {}),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload as string);
          const userId = payload.userId as string;

          // Download the uploaded image
          const response = await fetch(blob.url);
          const imageBuffer = Buffer.from(await response.arrayBuffer());

          // Convert to WebP using sharp
          const webpBuffer = await sharp(imageBuffer)
            .webp({ quality: 80 })
            .toBuffer();

          // Upload the WebP version
          const webpFilename = `avatars/${crypto.randomUUID()}.webp`;
          const webpBlob = await put(webpFilename, webpBuffer, {
            access: "public",
            contentType: "image/webp",
          });

          // Delete the original uploaded file
          try {
            await del(blob.url);
          } catch {
            // Ignore deletion errors for original file
          }

          // Get user's current avatar to clean up
          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });

          // Delete old avatar if exists and is different
          if (user?.avatarUrl && user.avatarUrl !== blob.url) {
            try {
              await del(user.avatarUrl);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Update user record with the WebP URL
          await db
            .update(users)
            .set({
              avatarUrl: webpBlob.url,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        } catch (error) {
          console.error("onUploadCompleted error:", error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
