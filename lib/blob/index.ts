import { put, del, list } from "@vercel/blob";

export interface UploadResult {
  url: string;
  pathname: string;
}

/**
 * Upload an image to Vercel Blob storage
 */
export async function uploadImage(
  file: File,
  folder: string = "icons"
): Promise<UploadResult> {
  // Generate unique filename
  const ext = file.name.split(".").pop() || "png";
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete an image from Vercel Blob storage
 */
export async function deleteImage(url: string): Promise<void> {
  await del(url);
}

/**
 * List images in a folder
 */
export async function listImages(folder: string = "icons") {
  const { blobs } = await list({ prefix: folder });
  return blobs;
}
