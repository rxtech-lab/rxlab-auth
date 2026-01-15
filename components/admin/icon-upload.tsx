"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Upload, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClientIcon } from "@/actions/admin/clients/update";

interface IconUploadProps {
  clientId: string;
  currentIconUrl: string | null;
}

export function IconUpload({ clientId, currentIconUrl }: IconUploadProps) {
  const [iconUrl, setIconUrl] = useState(currentIconUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { url } = await response.json();

      // Update client with new icon URL
      const result = await updateClientIcon(clientId, url);
      if (result.success) {
        setIconUrl(url);
      } else {
        setError(result.error || "Failed to update icon");
      }
    } catch (err) {
      setError("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await updateClientIcon(clientId, null);
      if (result.success) {
        setIconUrl(null);
      } else {
        setError(result.error || "Failed to remove icon");
      }
    } catch {
      setError("Failed to remove icon");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <div className="relative">
            <img
              src={iconUrl}
              alt="App icon"
              className="w-20 h-20 rounded-lg object-cover"
            />
            <button
              onClick={handleRemove}
              disabled={isUploading}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {iconUrl ? "Change Icon" : "Upload Icon"}
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPG up to 2MB. Square images work best.
          </p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
