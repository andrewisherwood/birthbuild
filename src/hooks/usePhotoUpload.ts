import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Photo } from "@/types/database";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// SEC-012: Derive file extension from validated MIME type, not user-controlled filename
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface UsePhotoUploadReturn {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  uploadPhoto: (file: File, purpose: string, altText: string) => Promise<Photo | null>;
  deletePhoto: (photoId: string, storagePath: string) => Promise<void>;
  updatePhotoAltText: (photoId: string, altText: string) => Promise<void>;
  getPublicUrl: (storagePath: string) => string;
}

export function usePhotoUpload(siteSpecId: string | null): UsePhotoUploadReturn {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch photos for this site spec
  useEffect(() => {
    let mounted = true;

    async function fetchPhotos() {
      if (!siteSpecId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("photos")
        .select("*")
        .eq("site_spec_id", siteSpecId)
        .order("sort_order", { ascending: true });

      if (!mounted) return;

      if (fetchError) {
        console.error("Failed to fetch photos:", fetchError);
        setError("Unable to load photos. Please try again.");
        setLoading(false);
        return;
      }

      setPhotos((data as Photo[]) ?? []);
      setLoading(false);
    }

    void fetchPhotos();

    return () => {
      mounted = false;
    };
  }, [siteSpecId]);

  const getPublicUrl = useCallback((storagePath: string): string => {
    const { data } = supabase.storage
      .from("photos")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }, []);

  const uploadPhoto = useCallback(
    async (file: File, purpose: string, altText: string): Promise<Photo | null> => {
      if (!user || !siteSpecId) {
        setError("You must be signed in with an active site specification.");
        return null;
      }

      // Client-side validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Please upload a JPEG, PNG, or WebP image.");
        return null;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError("Image must be under 5MB.");
        return null;
      }

      setUploading(true);
      setError(null);

      // SEC-012: Derive extension from MIME type, reject unknown types
      const ext = MIME_TO_EXT[file.type];
      if (!ext) {
        setError("Unsupported file type.");
        setUploading(false);
        return null;
      }
      const storagePath = `photos/${user.id}/${purpose}-${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Photo upload failed:", uploadError);
        setError("Unable to upload photo. Please try again.");
        setUploading(false);
        return null;
      }

      // Insert photos row
      const { data: photoRow, error: insertError } = await supabase
        .from("photos")
        .insert({
          site_spec_id: siteSpecId,
          storage_path: storagePath,
          purpose,
          alt_text: altText,
          sort_order: photos.length,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Photo record insert failed:", insertError);
        // Clean up the uploaded file
        await supabase.storage.from("photos").remove([storagePath]);
        setError("Unable to save photo record. Please try again.");
        setUploading(false);
        return null;
      }

      const newPhoto = photoRow as Photo;
      setPhotos((prev) => [...prev, newPhoto]);
      setUploading(false);
      return newPhoto;
    },
    [user, siteSpecId, photos.length],
  );

  const deletePhoto = useCallback(
    async (photoId: string, storagePath: string) => {
      setError(null);

      // SEC-014: Verify the storage path belongs to the current user before deleting
      if (!user || !storagePath.startsWith(`photos/${user.id}/`)) {
        setError("Invalid storage path.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (deleteError) {
        console.error("Photo delete failed:", deleteError);
        setError("Unable to delete photo. Please try again.");
        return;
      }

      // Remove from storage (best-effort)
      await supabase.storage.from("photos").remove([storagePath]);

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    },
    [user],
  );

  const updatePhotoAltText = useCallback(
    async (photoId: string, altText: string) => {
      setError(null);

      const { error: updateError } = await supabase
        .from("photos")
        .update({ alt_text: altText })
        .eq("id", photoId);

      if (updateError) {
        console.error("Photo alt text update failed:", updateError);
        setError("Unable to update alt text. Please try again.");
        return;
      }

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, alt_text: altText } : p)),
      );
    },
    [],
  );

  return {
    photos,
    loading,
    uploading,
    error,
    uploadPhoto,
    deletePhoto,
    updatePhotoAltText,
    getPublicUrl,
  };
}
