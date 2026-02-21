/**
 * SiteEditChat — chat-based editing interface for LLM-generated sites.
 *
 * User types natural language instructions ("make the hero more welcoming").
 * The component:
 *   1. Identifies which section/page is targeted
 *   2. Extracts that section from the checkpoint
 *   3. Calls edit-section Edge Function
 *   4. Replaces the section in the checkpoint pages
 *   5. Calls onPagesUpdated so the parent can create a new checkpoint
 */

import { useState, useCallback, useRef } from "react";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { extractSection, replaceSection, getSectionNames } from "@/lib/section-parser";
import type { SiteSpec, CheckpointPage } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SiteEditChatProps {
  siteSpec: SiteSpec;
  pages: CheckpointPage[];
  selectedPage: string;
  onPagesUpdated: (pages: CheckpointPage[]) => void;
}

// ---------------------------------------------------------------------------
// Chat message type
// ---------------------------------------------------------------------------

interface EditMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

/**
 * Attempt to determine which section the user is referring to.
 * Matches against known section names from the current page.
 */
function detectSection(instruction: string, availableSections: string[]): string | null {
  const lower = instruction.toLowerCase();

  for (const name of availableSections) {
    // Direct mention: "the hero section", "hero", "about-preview"
    if (lower.includes(name.replace(/-/g, " ")) || lower.includes(name)) {
      return name;
    }
  }

  // Common aliases
  const aliases: Record<string, string[]> = {
    hero: ["header", "banner", "top section", "main section", "headline"],
    cta: ["call to action", "get in touch", "contact button"],
    "services-overview": ["services section", "service cards", "what i offer"],
    "featured-testimonial": ["testimonial", "review", "client quote"],
    "about-preview": ["about section", "about me", "introduction"],
    bio: ["biography", "my story", "about me"],
    philosophy: ["approach", "values", "beliefs"],
    "service-cards": ["service list", "pricing", "offerings"],
    "contact-form": ["form", "enquiry form", "get in touch form"],
    "contact-info": ["contact details", "address", "phone number"],
    faq: ["frequently asked", "questions"],
  };

  for (const [sectionName, aliasList] of Object.entries(aliases)) {
    if (!availableSections.includes(sectionName)) continue;
    for (const alias of aliasList) {
      if (lower.includes(alias)) return sectionName;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SiteEditChat({
  siteSpec,
  pages,
  selectedPage,
  onPagesUpdated,
}: SiteEditChatProps) {
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [
      ...prev,
      { role, content, timestamp: new Date().toISOString() },
    ]);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const instruction = input.trim();
      if (!instruction || loading) return;

      setInput("");
      addMessage("user", instruction);
      setLoading(true);

      try {
        // Find the current page
        const currentPage = pages.find((p) => p.filename === selectedPage);
        if (!currentPage) {
          addMessage("assistant", "Could not find the current page. Please try again.");
          setLoading(false);
          return;
        }

        // Detect which section to edit
        const sectionNames = getSectionNames(currentPage.html);
        const targetSection = detectSection(instruction, sectionNames);

        if (!targetSection) {
          addMessage(
            "assistant",
            `I couldn't determine which section to edit. Available sections on this page: ${sectionNames.join(", ")}. Try mentioning one by name.`,
          );
          setLoading(false);
          return;
        }

        // Extract the section
        const section = extractSection(currentPage.html, targetSection);
        if (!section) {
          addMessage("assistant", `Section "${targetSection}" not found on this page.`);
          setLoading(false);
          return;
        }

        addMessage("assistant", `Editing the "${targetSection}" section...`);

        const { data, error } = await invokeEdgeFunction<{
          success?: boolean;
          edited_html?: string;
          error?: string;
        }>("edit-section", {
          section_html: section.html,
          section_name: targetSection,
          instruction,
          context: {
            business_name: siteSpec.business_name,
            doula_name: siteSpec.doula_name,
            service_area: siteSpec.service_area,
          },
        });

        if (error) {
          addMessage("assistant", `Sorry, something went wrong: ${error}`);
          setLoading(false);
          return;
        }

        if (data?.error || !data?.edited_html) {
          addMessage("assistant", data?.error ?? "Edit failed. Please try again.");
          setLoading(false);
          return;
        }

        // Replace the section in the page
        const updatedHtml = replaceSection(currentPage.html, targetSection, data.edited_html);
        const updatedPages = pages.map((p) =>
          p.filename === selectedPage ? { ...p, html: updatedHtml } : p,
        );

        onPagesUpdated(updatedPages);
        addMessage("assistant", `Done! The "${targetSection}" section has been updated. Preview shows the changes.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
        addMessage("assistant", `Sorry, something went wrong: ${msg}`);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading, pages, selectedPage, siteSpec, onPagesUpdated],
  );

  return (
    <Card title="Edit with AI">
      {/* Chat history */}
      {messages.length > 0 && (
        <div className="mb-4 max-h-60 space-y-2 overflow-y-auto">
          {messages.map((msg, index) => (
            <div
              key={`${msg.timestamp}-${index}`}
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 bg-green-50 text-green-900"
                  : "mr-8 bg-gray-50 text-gray-700"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. make the hero more welcoming..."
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-50"
          aria-label="Edit instruction"
        />
        <Button
          type="submit"
          loading={loading}
          disabled={!input.trim() || loading}
          size="sm"
        >
          Edit
        </Button>
      </form>
      <p className="mt-2 text-xs text-gray-500">
        Describe what you want to change. Mention the section name for best results (e.g. hero, services, testimonial, cta).
      </p>
    </Card>
  );
}
