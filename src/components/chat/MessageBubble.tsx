/**
 * MessageBubble — renders a single chat message (user or assistant).
 *
 * User messages are right-aligned with a green tint.
 * Assistant messages are left-aligned with a white background.
 * Supports basic markdown: **bold**, *italic*, lists, numbered lists.
 */

import type { ChatMessage } from "@/types/site-spec";

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Simple markdown → HTML (no library needed)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  // Strip step-complete markers from display (they're internal tracking data)
  let html = text.replace(/\[STEP_COMPLETE:\w+->\w+\]/g, "");

  // Strip CHOICES markers (handled separately by QuickReplyButtons)
  html = html.replace(/\[CHOICES:[^\]]+\]/g, "");

  // Escape HTML entities
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Numbered lists: lines starting with "1. ", "2. ", etc.
  html = html.replace(
    /^(\d+)\.\s+(.+)$/gm,
    '<li class="ml-4 list-decimal">$2</li>',
  );

  // Unordered lists: lines starting with "- "
  html = html.replace(
    /^-\s+(.+)$/gm,
    '<li class="ml-4 list-disc">$1</li>',
  );

  // Wrap consecutive <li> elements in <ol> or <ul>
  html = html.replace(
    /((?:<li class="ml-4 list-decimal">.+<\/li>\n?)+)/g,
    '<ol class="my-1 space-y-0.5">$1</ol>',
  );
  html = html.replace(
    /((?:<li class="ml-4 list-disc">.+<\/li>\n?)+)/g,
    '<ul class="my-1 space-y-0.5">$1</ul>',
  );

  // Paragraphs: double newlines
  html = html
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      // Don't wrap already-wrapped list blocks
      if (trimmed.startsWith("<ol") || trimmed.startsWith("<ul")) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("");

  // Single newlines within paragraphs → <br>
  html = html.replace(
    /(<p>)([\s\S]*?)(<\/p>)/g,
    (_match, open: string, content: string, close: string) =>
      open + content.replace(/\n/g, "<br>") + close,
  );

  return html;
}

// ---------------------------------------------------------------------------
// Relative timestamp
// ---------------------------------------------------------------------------

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageBubble({
  message,
  isLatest: _isLatest,
  className = "",
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${className}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
          isUser
            ? "bg-green-100 text-green-900"
            : "border border-gray-200 bg-white text-gray-800"
        }`}
      >
        <div
          className="prose prose-sm max-w-none [&_p]:my-1 [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
        <time
          dateTime={message.timestamp}
          className={`mt-1 block text-right text-[10px] ${
            isUser ? "text-green-600" : "text-gray-400"
          }`}
        >
          {relativeTime(message.timestamp)}
        </time>
      </div>
    </div>
  );
}
