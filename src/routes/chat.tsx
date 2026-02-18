/**
 * Chat page — the chatbot onboarding experience.
 *
 * Guides birth workers through a 7-step question flow to build their website spec.
 * Chat history persists in site_spec.chat_history and restores on return visits.
 */

import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSpec } from "@/hooks/useSiteSpec";
import { useChat } from "@/hooks/useChat";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ChatPage() {
  const { loading: authLoading, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("site_id") ?? undefined;
  const { siteSpec, loading: specLoading, error: specError, updateSiteSpec, createSiteSpec } =
    useSiteSpec(siteId);
  const navigate = useNavigate();

  const {
    messages,
    isLoading,
    error: chatError,
    currentStep,
    completedSteps,
    sendMessage,
    initChat,
    clearError,
    showPhotoUpload,
    dismissPhotoUpload,
  } = useChat({ siteSpec, updateSiteSpec });

  // Track whether we have already initialised the chat
  const initialisedRef = useRef(false);

  // Initialise: create spec if needed, then init chat
  useEffect(() => {
    if (authLoading || specLoading) return;
    if (initialisedRef.current) return;

    async function initialise() {
      if (!siteSpec) {
        const created = await createSiteSpec();
        if (!created) return;
      }
      // siteSpec may not be updated in state yet on the first createSiteSpec call,
      // but initChat reads it from the hook's internal state. We call initChat
      // on the next render when siteSpec is populated.
    }

    void initialise();
  }, [authLoading, specLoading, siteSpec, createSiteSpec]);

  // Once siteSpec is available, initialise chat (runs once)
  useEffect(() => {
    if (!siteSpec || initialisedRef.current) return;
    initialisedRef.current = true;
    initChat();
  }, [siteSpec, initChat]);

  const isInstructor = profile?.role === "instructor" || profile?.role === "admin";

  // Full-page loading while auth or spec is loading
  if (authLoading || specLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner className="h-8 w-8 text-green-600" />
          <p className="text-sm text-gray-500">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  // Spec-level error (could not load or create site spec)
  if (specError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-red-600">{specError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const dashboardPath = siteId ? `/dashboard?site_id=${siteId}` : "/dashboard";

  return (
    <main className="flex h-screen flex-col bg-gray-50">
      {/* Header bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold text-gray-900">
          Build Your Website
        </h1>
        <div className="flex gap-3">
          {isInstructor && (
            <Link
              to="/admin/sites"
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Back to Admin
            </Link>
          )}
          <Link
            to={dashboardPath}
            className="text-sm font-medium text-green-700 hover:text-green-800"
          >
            Edit in Dashboard &rarr;
          </Link>
        </div>
      </header>

      {/* Chat container fills remaining space */}
      <div className="min-h-0 flex-1">
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          currentStep={currentStep}
          completedSteps={completedSteps}
          sendMessage={sendMessage}
          error={chatError}
          onClearError={clearError}
          siteSpec={siteSpec}
          onNavigate={(path) => navigate(path)}
          showPhotoUpload={showPhotoUpload}
          onPhotoUploadDone={dismissPhotoUpload}
          siteSpecId={siteSpec?.id}
          className="h-full"
        />
      </div>
    </main>
  );
}
