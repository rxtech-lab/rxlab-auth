export const AVATAR_MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const AVATAR_ACCEPT = AVATAR_ALLOWED_TYPES.join(",");
