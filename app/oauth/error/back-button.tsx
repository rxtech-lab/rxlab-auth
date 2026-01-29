"use client";

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="text-sm text-primary hover:underline"
    >
      ← Go Back
    </button>
  );
}
