/**
 * useDesignChat — manages design chat state, undo stack, and local preview generation.
 *
 * Ephemeral session (messages not persisted to DB). The DesignConfig is saved
 * to site_specs.design only when the user explicitly clicks Save.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  sendDesignChatMessage,
  type ClaudeBlock,
  type ClaudeToolUseBlock,
} from "@/lib/claude";
import {
  deriveDesignFromSpec,
  deepMergeDesign,
  validateDesignConfig,
} from "@/lib/design-tokens";
import { generateSite } from "@/lib/site-generator";
import type { ChatMessage, SiteSpec, DesignConfig } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDesignChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentDesign: DesignConfig;
  undoStack: DesignConfig[];
  previewHtml: string | null;
  hasUnsavedChanges: boolean;
  sendMessage: (content: string) => Promise<void>;
  undo: () => void;
  revertToDeployed: () => void;
  save: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isToolUseBlock(block: ClaudeBlock): block is ClaudeToolUseBlock {
  return block.type === "tool_use";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseDesignChatParams {
  siteSpec: SiteSpec;
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
}

export function useDesignChat({
  siteSpec,
  updateSiteSpec,
}: UseDesignChatParams): UseDesignChatReturn {
  // Derive initial design from the spec (use saved design or derive from base fields)
  const initialDesign = useMemo(
    () => siteSpec.design ?? deriveDesignFromSpec(siteSpec),
    // Only compute on mount — don't re-derive on every spec change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your design assistant. Tell me how you'd like to change your site's look — colours, fonts, spacing, or border style. For example, try \"make it warmer\" or \"use a serif heading font\".",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDesign, setCurrentDesign] = useState<DesignConfig>(initialDesign);
  const [undoStack, setUndoStack] = useState<DesignConfig[]>([]);
  const deployedDesignRef = useRef<DesignConfig>(initialDesign);

  // Guard against concurrent sends
  const sendingRef = useRef(false);

  // ------------------------------------------------------------------
  // Preview generation (debounced 300ms on currentDesign change)
  // ------------------------------------------------------------------

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = setTimeout(() => {
      try {
        const specWithDesign: SiteSpec = { ...siteSpec, design: currentDesign };
        const result = generateSite(specWithDesign, []);
        const indexPage = result.pages.find((p) => p.filename === "index.html");
        setPreviewHtml(indexPage?.html ?? null);
      } catch (err) {
        console.error("[useDesignChat] Preview generation failed:", err);
      }
    }, 300);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [currentDesign, siteSpec]);

  // ------------------------------------------------------------------
  // Track unsaved changes
  // ------------------------------------------------------------------

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(currentDesign) !== JSON.stringify(deployedDesignRef.current),
    [currentDesign],
  );

  // ------------------------------------------------------------------
  // sendMessage
  // ------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content: string) => {
      if (sendingRef.current) return;
      if (!content.trim()) return;

      sendingRef.current = true;
      setIsLoading(true);
      setError(null);

      const userMsg: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendDesignChatMessage({
          messages: apiMessages,
          currentDesign,
        });

        // Extract text content
        const textBlocks = response.content.filter(
          (b): b is Extract<ClaudeBlock, { type: "text" }> => b.type === "text",
        );
        const assistantText = textBlocks.map((b) => b.text).join("\n\n");

        // Process tool_use blocks
        const toolUseBlocks = response.content.filter(isToolUseBlock);

        let designChanged = false;
        for (const toolCall of toolUseBlocks) {
          if (toolCall.name === "apply_design_changes") {
            const partial = toolCall.input as Partial<DesignConfig>;
            const merged = deepMergeDesign(currentDesign, partial);
            const errors = validateDesignConfig(merged);

            if (errors.length === 0) {
              // Push current state to undo stack before applying
              setUndoStack((prev) => [...prev, currentDesign]);
              setCurrentDesign(merged);
              designChanged = true;
            } else {
              console.warn("[useDesignChat] Validation errors:", errors);
            }
          }

          if (toolCall.name === "undo_last_change") {
            setUndoStack((prev) => {
              if (prev.length === 0) return prev;
              const newStack = [...prev];
              const previousState = newStack.pop()!;
              setCurrentDesign(previousState);
              return newStack;
            });
            designChanged = true;
          }

          if (toolCall.name === "revert_to_deployed") {
            setCurrentDesign(deployedDesignRef.current);
            setUndoStack([]);
            designChanged = true;
          }
        }

        // If design changed via undo/revert inside tool processing,
        // the state updates are already queued. The `designChanged` flag
        // is used only for logging/debugging clarity.
        void designChanged;

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: assistantText || "Done!",
          timestamp: new Date().toISOString(),
        };

        setMessages([...updatedMessages, assistantMsg]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setError(message);
      } finally {
        setIsLoading(false);
        sendingRef.current = false;
      }
    },
    [messages, currentDesign],
  );

  // ------------------------------------------------------------------
  // Undo / Revert / Save
  // ------------------------------------------------------------------

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const previousState = newStack.pop()!;
      setCurrentDesign(previousState);
      return newStack;
    });
  }, []);

  const revertToDeployed = useCallback(() => {
    setCurrentDesign(deployedDesignRef.current);
    setUndoStack([]);
  }, []);

  const save = useCallback(async () => {
    await updateSiteSpec({ design: currentDesign });
    deployedDesignRef.current = currentDesign;
    setUndoStack([]);
  }, [currentDesign, updateSiteSpec]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
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
  };
}
