/**
 * DesignChatPanel — conversational design editor with live preview.
 *
 * Desktop: side panel alongside existing Design tab controls.
 * Mobile: full-screen overlay with Preview / Chat tabs.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { useDesignChat } from "@/hooks/useDesignChat";
import { meetsContrastAA } from "@/lib/palettes";
import type { SiteSpec } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignChatPanelProps {
  siteSpec: SiteSpec;
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Device size selector (reused from PreviewTab)
// ---------------------------------------------------------------------------

type DeviceSize = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceSize, string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

const DEVICE_LABELS: Record<DeviceSize, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

// ---------------------------------------------------------------------------
// Colour swatch row (shown after design changes)
// ---------------------------------------------------------------------------

function ColourSwatches({ colours }: { colours: { primary: string; background: string; accent: string; text: string; cta: string } }) {
  return (
    <div className="mt-2 flex gap-1.5" aria-label="Current colour palette">
      {Object.entries(colours).map(([key, hex]) => (
        <div
          key={key}
          className="h-6 w-6 rounded-full border border-gray-300"
          style={{ backgroundColor: hex }}
          title={`${key}: ${hex}`}
          aria-label={`${key}: ${hex}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab selector
// ---------------------------------------------------------------------------

type MobileTab = "preview" | "chat";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesignChatPanel({
  siteSpec,
  updateSiteSpec,
  onClose,
}: DesignChatPanelProps) {
  const {
    messages,
    isLoading,
    error,
    currentDesign,
    undoStack,
    previewHtml,
    hasUnsavedChanges,
    sendMessage,
    undo,
    revertToDeployed,
    save,
    clearError,
  } = useDesignChat({ siteSpec, updateSiteSpec });

  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Blob URL management for preview iframe
  const blobUrl = useMemo(() => {
    if (!previewHtml) return null;
    return URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
  }, [previewHtml]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Contrast check
  const contrastFails = !meetsContrastAA(
    currentDesign.colours.text,
    currentDesign.colours.background,
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await save();
    } finally {
      setIsSaving(false);
    }
  }, [save]);

  const handleSend = useCallback(
    (content: string) => {
      void sendMessage(content);
    },
    [sendMessage],
  );

  // -----------------------------------------------------------------------
  // Shared sub-components
  // -----------------------------------------------------------------------

  const previewSection = (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Device size toggle */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
        {(Object.keys(DEVICE_WIDTHS) as DeviceSize[]).map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setDeviceSize(size)}
            aria-pressed={deviceSize === size}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              deviceSize === size
                ? "bg-green-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {DEVICE_LABELS[size]}
          </button>
        ))}
      </div>

      {/* Contrast warning */}
      {contrastFails && (
        <div
          className="border-b border-yellow-200 bg-yellow-50 px-4 py-2"
          role="alert"
        >
          <p className="text-xs font-medium text-yellow-800">
            Text-to-background contrast does not meet WCAG AA (4.5:1). Consider
            adjusting your colours for better readability.
          </p>
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex flex-1 justify-center overflow-hidden bg-gray-100 p-2">
        {blobUrl ? (
          <iframe
            src={blobUrl}
            title="Design preview"
            sandbox="allow-scripts"
            className="h-full border-0 bg-white"
            style={{ width: DEVICE_WIDTHS[deviceSize] }}
          />
        ) : (
          <div className="flex items-center justify-center text-sm text-gray-500">
            Preview loading...
          </div>
        )}
      </div>
    </div>
  );

  const chatSection = (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble
              message={msg}
              isLatest={i === messages.length - 1}
            />
            {/* Show colour swatches after assistant messages that follow the initial */}
            {msg.role === "assistant" && i > 0 && (
              <ColourSwatches colours={currentDesign.colours} />
            )}
          </div>
        ))}
        {error && (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={clearError}
              className="mt-1 text-xs font-medium text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={undoStack.length === 0 || isLoading}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={revertToDeployed}
          disabled={!hasUnsavedChanges || isLoading}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSave()}
          loading={isSaving}
          disabled={!hasUnsavedChanges || isLoading}
        >
          Save Changes
        </Button>
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder="Describe your design change..."
      />
    </div>
  );

  // -----------------------------------------------------------------------
  // Desktop layout (>= 1024px): side-by-side preview + chat
  // -----------------------------------------------------------------------

  const desktopLayout = (
    <div className="hidden h-full flex-col lg:flex">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          AI Design Editor
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close design editor"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Preview (left side) */}
        <div className="flex w-1/2 flex-col border-r border-gray-200">
          {previewSection}
        </div>

        {/* Chat (right side) */}
        <div className="flex w-1/2 flex-col">
          {chatSection}
        </div>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Mobile layout (< 1024px): full-screen overlay with tabbed navigation
  // -----------------------------------------------------------------------

  const mobileLayout = (
    <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          AI Design Editor
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close design editor"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-gray-200">
        {(["preview", "chat"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mobileTab === tab
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "preview" ? "Preview" : "Chat"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {mobileTab === "preview" ? previewSection : chatSection}
      </div>
    </div>
  );

  return (
    <>
      {desktopLayout}
      {mobileLayout}
    </>
  );
}
