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
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";

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
          allowedContentTypes: [...AVATAR_ALLOWED_TYPES],
          maximumSizeInBytes: AVATAR_MAX_FILE_SIZE,
          allowOverwrite: true,
          addRandomSuffix: false,
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

          // Download the uploaded image (retry to handle CDN propagation delays)
          const response = await fetchWithRetry(blob.url);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch uploaded image: ${response.status}`
            );
          }
          const imageBuffer = Buffer.from(await response.arrayBuffer());

          // Try to convert to WebP using sharp; fall back to original if unsupported
          let finalUrl: string;
          try {
            const webpBuffer = await sharp(imageBuffer)
              .webp({ quality: 80 })
              .toBuffer();

            // Upload the WebP version using userId as filename to allow overwrite
            const webpFilename = `avatars/${userId}.webp`;
            const webpBlob = await put(webpFilename, webpBuffer, {
              access: "public",
              contentType: "image/webp",
              allowOverwrite: true,
              addRandomSuffix: false,
            });

            // Delete the original uploaded file
            try {
              await del(blob.url);
            } catch {
              // Ignore deletion errors for original file
            }

            finalUrl = webpBlob.url;
          } catch (conversionError) {
            // sharp could not process the image (unsupported format);
            // keep the original uploaded blob as the avatar
            console.warn("Sharp image conversion failed, using original:", conversionError);
            finalUrl = blob.url;
          }

          // Get user's current avatar to clean up
          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });

          // Delete old avatar if exists
          if (user?.avatarUrl) {
            try {
              await del(user.avatarUrl);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Update user record with the avatar URL
          await db
            .update(users)
            .set({
              avatarUrl: finalUrl,
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
