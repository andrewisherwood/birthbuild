import { Card } from "@/components/ui/Card";
import { PhotoUploadCard } from "@/components/dashboard/PhotoUploadCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import type { SiteSpec } from "@/types/site-spec";

interface PhotosTabProps {
  siteSpec: SiteSpec;
}

export function PhotosTab({ siteSpec }: PhotosTabProps) {
  const {
    photos,
    loading,
    uploading,
    error,
    uploadPhoto,
    deletePhoto,
    updatePhotoAltText,
    getPublicUrl,
  } = usePhotoUpload(siteSpec.id);

  const headshot = photos.find((p) => p.purpose === "headshot") ?? null;
  const hero = photos.find((p) => p.purpose === "hero") ?? null;
  const gallery = photos.filter(
    (p) => p.purpose !== "headshot" && p.purpose !== "hero",
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Card title="Profile Photo">
        <p className="mb-4 text-sm text-gray-500">
          A professional headshot that helps clients connect with you.
        </p>
        <PhotoUploadCard
          photo={headshot}
          purpose="headshot"
          label="Upload profile photo"
          uploading={uploading && !headshot}
          onUpload={uploadPhoto}
          onDelete={deletePhoto}
          onAltTextChange={updatePhotoAltText}
          getPublicUrl={getPublicUrl}
        />
      </Card>

      <Card title="Hero Image">
        <p className="mb-4 text-sm text-gray-500">
          A wide image for the top of your homepage. Natural, warm imagery works best.
        </p>
        <PhotoUploadCard
          photo={hero}
          purpose="hero"
          label="Upload hero image"
          uploading={uploading && !hero}
          onUpload={uploadPhoto}
          onDelete={deletePhoto}
          onAltTextChange={updatePhotoAltText}
          getPublicUrl={getPublicUrl}
        />
      </Card>

      <Card title="Additional Photos">
        <p className="mb-4 text-sm text-gray-500">
          Extra photos for your gallery section. These help tell your story.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {gallery.map((photo) => (
            <PhotoUploadCard
              key={photo.id}
              photo={photo}
              purpose="gallery"
              label="Gallery photo"
              uploading={false}
              onUpload={uploadPhoto}
              onDelete={deletePhoto}
              onAltTextChange={updatePhotoAltText}
              getPublicUrl={getPublicUrl}
            />
          ))}
          <PhotoUploadCard
            photo={null}
            purpose="gallery"
            label="Add gallery photo"
            uploading={uploading && Boolean(headshot) && Boolean(hero)}
            onUpload={uploadPhoto}
            onDelete={deletePhoto}
            onAltTextChange={updatePhotoAltText}
            getPublicUrl={getPublicUrl}
          />
        </div>
      </Card>
    </div>
  );
}
