import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Photo } from "@/types/database";

interface PhotoUploadCardProps {
  photo: Photo | null;
  purpose: string;
  label: string;
  uploading: boolean;
  onUpload: (file: File, purpose: string, altText: string) => Promise<Photo | null>;
  onDelete: (photoId: string, storagePath: string) => Promise<void>;
  onAltTextChange: (photoId: string, altText: string) => Promise<void>;
  getPublicUrl: (storagePath: string) => string;
}

export function PhotoUploadCard({
  photo,
  purpose,
  label,
  uploading,
  onUpload,
  onDelete,
  onAltTextChange,
  getPublicUrl,
}: PhotoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localAltText, setLocalAltText] = useState(photo?.alt_text ?? "");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state if the photo prop changes (e.g. a different photo loads)
  useEffect(() => {
    setLocalAltText(photo?.alt_text ?? "");
  }, [photo?.id, photo?.alt_text]);

  const handleAltTextChange = useCallback(
    (value: string) => {
      setLocalAltText(value);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        if (photo) {
          void onAltTextChange(photo.id, value);
        }
      }, 500);
    },
    [photo, onAltTextChange],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    await onUpload(file, purpose, "");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
        <LoadingSpinner className="h-8 w-8" />
        <p className="mt-2 text-sm text-gray-500">Uploading...</p>
      </div>
    );
  }

  if (photo) {
    const imageUrl = getPublicUrl(photo.storage_path);
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <img
            src={imageUrl}
            alt={photo.alt_text ?? label}
            className="h-24 w-24 rounded-md object-cover"
          />
          <div className="flex-1 space-y-2">
            <Input
              label="Alt text"
              value={localAltText}
              onChange={handleAltTextChange}
              placeholder="Describe this image for accessibility"
              id={`alt-text-${photo.id}`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onDelete(photo.id, photo.storage_path)}
              aria-label={`Delete ${label}`}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      aria-label={`Upload ${label}`}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragOver
          ? "border-green-500 bg-green-50"
          : "border-gray-300 bg-gray-50 hover:border-gray-400"
      }`}
    >
      <svg
        className="h-8 w-8 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
        />
      </svg>
      <p className="mt-2 text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-1 text-xs text-gray-500">
        Click or drag to upload (JPEG, PNG, WebP, max 5MB)
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="sr-only"
        aria-label={`Choose file for ${label}`}
      />
    </div>
  );
}
