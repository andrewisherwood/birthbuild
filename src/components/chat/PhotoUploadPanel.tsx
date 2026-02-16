import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PhotoUploadCard } from "@/components/dashboard/PhotoUploadCard";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";

interface PhotoUploadPanelProps {
  siteSpecId: string;
  onDone: () => void;
}

export function PhotoUploadPanel({ siteSpecId, onDone }: PhotoUploadPanelProps) {
  const {
    photos,
    uploading,
    error,
    uploadPhoto,
    deletePhoto,
    updatePhotoAltText,
    getPublicUrl,
  } = usePhotoUpload(siteSpecId);

  const headshot = photos.find((p) => p.purpose === "headshot") ?? null;
  const hero = photos.find((p) => p.purpose === "hero") ?? null;
  const galleryPhotos = photos.filter((p) => p.purpose === "gallery");

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900">
        Upload Your Photos
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Add photos to make your site personal and professional. You can always
        update these later from the dashboard.
      </p>

      {error && (
        <div
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-gray-500">
            Headshot
          </p>
          <PhotoUploadCard
            photo={headshot}
            purpose="headshot"
            label="Your headshot"
            uploading={uploading}
            onUpload={uploadPhoto}
            onDelete={deletePhoto}
            onAltTextChange={updatePhotoAltText}
            getPublicUrl={getPublicUrl}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-gray-500">
            Hero Image
          </p>
          <PhotoUploadCard
            photo={hero}
            purpose="hero"
            label="Hero banner image"
            uploading={uploading}
            onUpload={uploadPhoto}
            onDelete={deletePhoto}
            onAltTextChange={updatePhotoAltText}
            getPublicUrl={getPublicUrl}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-gray-500">
            Gallery ({galleryPhotos.length} uploaded)
          </p>
          {galleryPhotos.map((photo) => (
            <div key={photo.id} className="mb-2">
              <PhotoUploadCard
                photo={photo}
                purpose="gallery"
                label="Gallery photo"
                uploading={uploading}
                onUpload={uploadPhoto}
                onDelete={deletePhoto}
                onAltTextChange={updatePhotoAltText}
                getPublicUrl={getPublicUrl}
              />
            </div>
          ))}
          {galleryPhotos.length < 6 && (
            <PhotoUploadCard
              photo={null}
              purpose="gallery"
              label="Add gallery photo"
              uploading={uploading}
              onUpload={uploadPhoto}
              onDelete={deletePhoto}
              onAltTextChange={updatePhotoAltText}
              getPublicUrl={getPublicUrl}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onDone} disabled={uploading}>
          Done with photos
        </Button>
      </div>
    </Card>
  );
}
