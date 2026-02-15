/**
 * MessageBubble — renders a single chat message (user or assistant).
 *
 * User messages are right-aligned with a green tint.
 * Assistant messages are left-aligned with a white background.
 * Supports basic markdown: **bold**, *italic*, lists, numbered lists.
 *
 * SEC-007: Uses React-based rendering instead of dangerouslySetInnerHTML.
 */

import { type ReactNode } from "react";
import type { ChatMessage } from "@/types/site-spec";

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Inline segment types for markdown parsing
// ---------------------------------------------------------------------------

interface TextSegment {
  kind: "text";
  value: string;
}

interface BoldSegment {
  kind: "bold";
  children: InlineSegment[];
}

interface ItalicSegment {
  kind: "italic";
  children: InlineSegment[];
}

type InlineSegment = TextSegment | BoldSegment | ItalicSegment;

// ---------------------------------------------------------------------------
// Block types for markdown parsing
// ---------------------------------------------------------------------------

interface ParagraphBlock {
  kind: "paragraph";
  segments: InlineSegment[];
}

interface OrderedListBlock {
  kind: "ordered-list";
  items: InlineSegment[][];
}

interface UnorderedListBlock {
  kind: "unordered-list";
  items: InlineSegment[][];
}

interface LineBreakBlock {
  kind: "line-break";
}

type MarkdownBlock =
  | ParagraphBlock
  | OrderedListBlock
  | UnorderedListBlock
  | LineBreakBlock;

// ---------------------------------------------------------------------------
// Inline markdown parser — handles **bold** and *italic*
// ---------------------------------------------------------------------------

function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Match **bold** or *italic* patterns
  const inlineRegex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // **bold** — recursively parse inner content for nested italic
      segments.push({ kind: "bold", children: parseInlineSegments(match[1]) });
    } else if (match[2] !== undefined) {
      // *italic*
      segments.push({ kind: "italic", children: [{ kind: "text", value: match[2] }] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Block-level markdown parser
// ---------------------------------------------------------------------------

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  // Strip step-complete markers (internal tracking data)
  let cleaned = text.replace(/\[STEP_COMPLETE:\w+->\w+\]/g, "");
  // Strip CHOICES markers (handled separately by QuickReplyButtons)
  cleaned = cleaned.replace(/\[CHOICES:[^\]]+\]/g, "");

  const blocks: MarkdownBlock[] = [];
  // Split on double newlines to get paragraphs
  const paragraphs = cleaned.split(/\n\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");

    // Check if this paragraph is entirely ordered list items
    const isOrderedList = lines.every((line) => /^\d+\.\s+/.test(line.trim()));
    if (isOrderedList && lines.length > 0) {
      const items = lines.map((line) => {
        const content = line.trim().replace(/^\d+\.\s+/, "");
        return parseInlineSegments(content);
      });
      blocks.push({ kind: "ordered-list", items });
      continue;
    }

    // Check if this paragraph is entirely unordered list items
    const isUnorderedList = lines.every((line) => /^-\s+/.test(line.trim()));
    if (isUnorderedList && lines.length > 0) {
      const items = lines.map((line) => {
        const content = line.trim().replace(/^-\s+/, "");
        return parseInlineSegments(content);
      });
      blocks.push({ kind: "unordered-list", items });
      continue;
    }

    // Mixed content: process line by line, grouping consecutive list items
    let currentListItems: InlineSegment[][] = [];
    let currentListType: "ordered" | "unordered" | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmedLine);
      const unorderedMatch = /^-\s+(.+)$/.exec(trimmedLine);

      if (orderedMatch) {
        const content = orderedMatch[1] ?? trimmedLine;
        if (currentListType === "ordered") {
          currentListItems.push(parseInlineSegments(content));
        } else {
          // Flush previous list if different type
          if (currentListType === "unordered" && currentListItems.length > 0) {
            blocks.push({ kind: "unordered-list", items: currentListItems });
          }
          currentListType = "ordered";
          currentListItems = [parseInlineSegments(content)];
        }
      } else if (unorderedMatch) {
        const content = unorderedMatch[1] ?? trimmedLine;
        if (currentListType === "unordered") {
          currentListItems.push(parseInlineSegments(content));
        } else {
          // Flush previous list if different type
          if (currentListType === "ordered" && currentListItems.length > 0) {
            blocks.push({ kind: "ordered-list", items: currentListItems });
          }
          currentListType = "unordered";
          currentListItems = [parseInlineSegments(content)];
        }
      } else {
        // Regular text line — flush any pending list
        if (currentListType && currentListItems.length > 0) {
          blocks.push(
            currentListType === "ordered"
              ? { kind: "ordered-list", items: currentListItems }
              : { kind: "unordered-list", items: currentListItems },
          );
          currentListItems = [];
          currentListType = null;
        }
        // Add as paragraph (or append line break for multi-line paragraphs)
        if (trimmedLine) {
          blocks.push({ kind: "paragraph", segments: parseInlineSegments(trimmedLine) });
        }
      }
    }

    // Flush any remaining list items
    if (currentListType && currentListItems.length > 0) {
      blocks.push(
        currentListType === "ordered"
          ? { kind: "ordered-list", items: currentListItems }
          : { kind: "unordered-list", items: currentListItems },
      );
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// React renderers
// ---------------------------------------------------------------------------

function renderInlineSegment(segment: InlineSegment, key: number): ReactNode {
  switch (segment.kind) {
    case "text":
      return <span key={key}>{segment.value}</span>;
    case "bold":
      return (
        <strong key={key} className="font-semibold">
          {segment.children.map((child, i) => renderInlineSegment(child, i))}
        </strong>
      );
    case "italic":
      return (
        <em key={key}>
          {segment.children.map((child, i) => renderInlineSegment(child, i))}
        </em>
      );
  }
}

function renderInlineSegments(segments: InlineSegment[]): ReactNode[] {
  return segments.map((seg, i) => renderInlineSegment(seg, i));
}

function renderBlock(block: MarkdownBlock, key: number): ReactNode {
  switch (block.kind) {
    case "paragraph":
      return (
        <p key={key} className="my-1">
          {renderInlineSegments(block.segments)}
        </p>
      );
    case "ordered-list":
      return (
        <ol key={key} className="my-1 space-y-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="ml-4 list-decimal">
              {renderInlineSegments(item)}
            </li>
          ))}
        </ol>
      );
    case "unordered-list":
      return (
        <ul key={key} className="my-1 space-y-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="ml-4 list-disc">
              {renderInlineSegments(item)}
            </li>
          ))}
        </ul>
      );
    case "line-break":
      return <br key={key} />;
  }
}

function renderMarkdownAsReact(text: string): ReactNode {
  const blocks = parseMarkdownBlocks(text);
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
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
        <div className="prose prose-sm max-w-none [&_p]:my-1 [&_strong]:font-semibold">
          {renderMarkdownAsReact(message.content)}
        </div>
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
