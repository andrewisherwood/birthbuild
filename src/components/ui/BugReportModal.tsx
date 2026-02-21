import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { invokeEdgeFunction } from "@/lib/edge-functions";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;

      setSubmitting(true);
      setError(null);

      const { data, error: invokeError } = await invokeEdgeFunction<{
        success?: boolean;
        error?: string;
      }>("report-bug", {
        title: title.trim(),
        description: description.trim(),
        url: window.location.href,
        browser: navigator.userAgent,
      });

      setSubmitting(false);

      if (invokeError) {
        setError(invokeError);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSubmitted(true);
      setTitle("");
      setDescription("");
    },
    [title, description],
  );

  const handleClose = useCallback(() => {
    setSubmitted(false);
    setError(null);
    setTitle("");
    setDescription("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ghost icon */}
        <div className="mb-4 flex justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="text-gray-400"
          >
            <path
              d="M24 4C16.268 4 10 10.268 10 18v14c0 2 1 4 3 4s3-2 3-4 1-4 3-4 3 2 3 4 1 4 3 4 3-2 3-4 1-4 3-4 3 2 3 4 1 4 3 4 3-2 3-4V18c0-7.732-6.268-14-14-14z"
              fill="currentColor"
              opacity="0.15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="18" cy="20" r="2.5" fill="currentColor" />
            <circle cx="30" cy="20" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <h2
          id="bug-report-title"
          className="text-center text-lg font-semibold text-gray-900"
        >
          Report a Bug
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Found something that doesn&rsquo;t look right? Let us know.
        </p>

        {submitted ? (
          <div className="mt-6 text-center">
            <p className="text-sm font-medium text-green-700">
              Thank you! Your report has been submitted.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="bug-title"
                className="block text-sm font-medium text-gray-700"
              >
                Title
              </label>
              <input
                ref={titleInputRef}
                id="bug-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue"
                maxLength={200}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="bug-description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="bug-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What did you expect to happen?"
                rows={4}
                maxLength={2000}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={submitting}
                disabled={!title.trim() || submitting}
              >
                Submit
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
