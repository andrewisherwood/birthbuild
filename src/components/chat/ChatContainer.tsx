/**
 * ChatContainer — full-height flex layout for the chatbot.
 *
 * Step indicator at top, scrollable message area in middle, input at bottom.
 * Auto-scrolls to the latest message.
 */

import { useRef, useEffect } from "react";
import type { ChatMessage, ChatStep, SiteSpec } from "@/types/site-spec";
import { StepIndicator } from "@/components/chat/StepIndicator";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { CompletionCard } from "@/components/chat/CompletionCard";
import { PhotoUploadPanel } from "@/components/chat/PhotoUploadPanel";
import { QuickReplyButtons, extractChoices } from "@/components/chat/QuickReplyButtons";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  currentStep: ChatStep;
  completedSteps: ChatStep[];
  sendMessage: (content: string) => void;
  error: string | null;
  onClearError: () => void;
  siteSpec?: SiteSpec | null;
  onNavigate?: (path: string) => void;
  showPhotoUpload?: boolean;
  onPhotoUploadDone?: () => void;
  siteSpecId?: string;
  className?: string;
}

export function ChatContainer({
  messages,
  isLoading,
  currentStep,
  completedSteps,
  sendMessage,
  error,
  onClearError,
  siteSpec,
  onNavigate,
  showPhotoUpload,
  onPhotoUploadDone,
  siteSpecId,
  className = "",
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isLoading]);

  const isComplete = currentStep === "complete";

  // Determine if latest assistant message has quick-reply choices
  const latestMessage = messages[messages.length - 1];
  const latestAssistantChoices =
    latestMessage?.role === "assistant" && !isLoading && !isComplete
      ? extractChoices(latestMessage.content)
      : [];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Step indicator */}
      <div className="shrink-0 border-b border-gray-100 bg-gray-50">
        <StepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((msg, index) => (
            <MessageBubble
              key={`${msg.timestamp}-${index}`}
              message={msg}
              isLatest={index === messages.length - 1}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <LoadingSpinner className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}

          {/* Photo upload panel (shown when trigger_photo_upload tool fires) */}
          {showPhotoUpload && siteSpecId && onPhotoUploadDone && (
            <div className="mt-2">
              <PhotoUploadPanel
                siteSpecId={siteSpecId}
                onDone={onPhotoUploadDone}
              />
            </div>
          )}

          {/* Completion card (shown when all steps are done) */}
          {isComplete && siteSpec && onNavigate && (
            <div className="mt-4">
              <CompletionCard siteSpec={siteSpec} siteId={siteSpecId} onNavigate={onNavigate} />
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={onClearError}
            className="ml-3 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Quick reply buttons (shown when choices are available) */}
      {latestAssistantChoices.length > 0 && (
        <div className="mx-auto w-full max-w-2xl shrink-0">
          <QuickReplyButtons
            options={latestAssistantChoices}
            onSelect={sendMessage}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Input area (hidden when complete, hint when photo upload visible) */}
      {isComplete ? (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 text-center">
          <p className="text-sm text-gray-500">
            All steps complete. Head to the dashboard to build your site.
          </p>
        </div>
      ) : (
        <div className="shrink-0">
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            placeholder={showPhotoUpload ? "Upload your photos above, or type a message..." : undefined}
          />
        </div>
      )}
    </div>
  );
}
