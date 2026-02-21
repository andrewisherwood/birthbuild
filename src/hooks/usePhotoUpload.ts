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
  photoUrls: Record<string, string>;
}

export function usePhotoUpload(siteSpecId: string | null): UsePhotoUploadReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // Hard backstop: never let the spinner hang indefinitely.
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(id);
  }, [loading]);

  // Build public URL map from photo list (bucket is public — no signed URLs needed)
  const buildUrlMap = useCallback((photoList: Photo[]): Record<string, string> => {
    const urlMap: Record<string, string> = {};
    for (const p of photoList) {
      const { data } = supabase.storage.from("photos").getPublicUrl(p.storage_path);
      urlMap[p.storage_path] = data.publicUrl;
    }
    return urlMap;
  }, []);

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

      try {
        const { data, error: fetchError } = await supabase
          .from("photos")
          .select("*")
          .eq("site_spec_id", siteSpecId)
          .order("sort_order", { ascending: true });

        if (!mounted) return;

        if (fetchError) {
          setError("Unable to load photos. Please try again.");
          setLoading(false);
          return;
        }

        const fetchedPhotos = (data as Photo[]) ?? [];
        setPhotos(fetchedPhotos);
        setPhotoUrls(buildUrlMap(fetchedPhotos));
      } catch {
        if (mounted) {
          setError("Unable to load photos. Please try again.");
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    void fetchPhotos();

    return () => {
      mounted = false;
    };
  }, [siteSpecId, buildUrlMap]);

  // Public URL helper (bucket is public — no auth needed)
  const getPublicUrl = useCallback(
    (storagePath: string): string => {
      if (photoUrls[storagePath]) return photoUrls[storagePath];
      const { data } = supabase.storage.from("photos").getPublicUrl(storagePath);
      return data.publicUrl;
    },
    [photoUrls],
  );

  const uploadPhoto = useCallback(
    async (file: File, purpose: string, altText: string): Promise<Photo | null> => {
      if (!userId || !siteSpecId) {
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
      const storagePath = `photos/${userId}/${purpose}-${Date.now()}.${ext}`;

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

      // Add public URL for the newly uploaded photo
      const { data: publicData } = supabase.storage.from("photos").getPublicUrl(storagePath);
      const publicUrl = publicData.publicUrl;
      setPhotoUrls((prev) => ({ ...prev, [storagePath]: publicUrl }));

      setUploading(false);
      return newPhoto;
    },
    [userId, siteSpecId, photos.length],
  );

  const deletePhoto = useCallback(
    async (photoId: string, storagePath: string) => {
      setError(null);

      // SEC-014: Verify the storage path belongs to the current user before deleting
      if (!userId || !storagePath.startsWith(`photos/${userId}/`)) {
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
    [userId],
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
    photoUrls,
  };
}
