/**
 * useChat — manages chat state, message sending, and step tracking.
 *
 * Delegates all Claude API interaction to sendChatMessage (via the Edge Function).
 * Persists chat history to site_spec.chat_history on every exchange.
 */

import { useState, useCallback, useRef } from "react";
import {
  sendChatMessage,
  type ClaudeBlock,
  type ClaudeToolUseBlock,
} from "@/lib/claude";
import { WELCOME_MESSAGE } from "@/lib/chat-prompts";
import { mapToolCallToSpecUpdate } from "@/lib/chat-tools";
import type { ChatMessage, ChatStep, SiteSpec } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingContent {
  field: string;
  context: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentStep: ChatStep;
  completedSteps: ChatStep[];
  pendingContent: PendingContent | null;
  showPhotoUpload: boolean;
  sendMessage: (content: string) => Promise<void>;
  initChat: () => void;
  clearError: () => void;
  dismissPhotoUpload: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isToolUseBlock(block: ClaudeBlock): block is ClaudeToolUseBlock {
  return block.type === "tool_use";
}

/**
 * Walk through chat history and determine the current step and all completed steps
 * by inspecting assistant messages for serialised tool-call markers.
 */
function deriveStepState(msgs: ChatMessage[]): {
  currentStep: ChatStep;
  completedSteps: ChatStep[];
} {
  const completed: ChatStep[] = [];
  let current: ChatStep = "welcome";

  for (const msg of msgs) {
    if (msg.role !== "assistant") continue;

    // We embed step transitions as markers in the stored message content
    const stepMarkerRegex = /\[STEP_COMPLETE:(\w+)->(\w+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = stepMarkerRegex.exec(msg.content)) !== null) {
      const completedStep = match[1] as ChatStep;
      const nextStep = match[2] as ChatStep;
      if (!completed.includes(completedStep)) {
        completed.push(completedStep);
      }
      current = nextStep;
    }
  }

  return { currentStep: current, completedSteps: completed };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseChatParams {
  siteSpec: SiteSpec | null;
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
}

export function useChat({ siteSpec, updateSiteSpec }: UseChatParams): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ChatStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<ChatStep[]>([]);
  const [pendingContent, setPendingContent] = useState<PendingContent | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  // Guard against concurrent sends
  const sendingRef = useRef(false);

  // ------------------------------------------------------------------
  // initChat — restore from history or show the static welcome message
  // ------------------------------------------------------------------

  const initChat = useCallback(() => {
    if (siteSpec?.chat_history && siteSpec.chat_history.length > 0) {
      setMessages(siteSpec.chat_history);
      const { currentStep: step, completedSteps: completed } = deriveStepState(
        siteSpec.chat_history,
      );
      setCurrentStep(step);
      setCompletedSteps(completed);
    } else {
      const welcomeMsg: ChatMessage = {
        role: "assistant",
        content: WELCOME_MESSAGE,
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);

      // Persist the welcome message to the spec
      if (siteSpec) {
        void updateSiteSpec({ chat_history: [welcomeMsg] });
      }
    }
  }, [siteSpec, updateSiteSpec]);

  // ------------------------------------------------------------------
  // sendMessage — append user message, call Claude, process response
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
        // Build the messages array for Claude (role + content only)
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendChatMessage({
          messages: apiMessages,
        });

        // Extract text content
        const textBlocks = response.content.filter(
          (b): b is Extract<ClaudeBlock, { type: "text" }> => b.type === "text",
        );
        let assistantText = textBlocks.map((b) => b.text).join("\n\n");

        // Process tool_use blocks
        const toolUseBlocks = response.content.filter(isToolUseBlock);

        for (const toolCall of toolUseBlocks) {
          // Map tool call to spec update
          const specPartial = mapToolCallToSpecUpdate(
            toolCall.name,
            toolCall.input,
          );
          if (specPartial) {
            await updateSiteSpec(specPartial);
            // If we saved content, clear pending content state
            setPendingContent(null);
          }

          // Show inline photo upload panel
          if (toolCall.name === "trigger_photo_upload") {
            setShowPhotoUpload(true);
          }

          // Track generated-but-not-confirmed content
          if (toolCall.name === "generate_content") {
            setPendingContent({
              field: toolCall.input.field as string,
              context: toolCall.input.context as string,
            });
          }

          // Handle step completion markers — embed in message for history reconstruction
          if (toolCall.name === "mark_step_complete") {
            const completedStep = toolCall.input.completed_step as ChatStep;
            const nextStep = toolCall.input.next_step as ChatStep;

            assistantText += `\n[STEP_COMPLETE:${completedStep}->${nextStep}]`;

            setCurrentStep(nextStep);
            setCompletedSteps((prev) =>
              prev.includes(completedStep) ? prev : [...prev, completedStep],
            );
          }
        }

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: assistantText,
          timestamp: new Date().toISOString(),
        };

        const allMessages = [...updatedMessages, assistantMsg];
        setMessages(allMessages);

        // Persist full chat history
        await updateSiteSpec({ chat_history: allMessages });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setError(message);
      } finally {
        setIsLoading(false);
        sendingRef.current = false;
      }
    },
    [messages, updateSiteSpec],
  );

  // ------------------------------------------------------------------
  // clearError
  // ------------------------------------------------------------------

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const dismissPhotoUpload = useCallback(() => {
    setShowPhotoUpload(false);
    void sendMessage("I've finished uploading my photos");
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    error,
    currentStep,
    completedSteps,
    pendingContent,
    showPhotoUpload,
    sendMessage,
    initChat,
    clearError,
    dismissPhotoUpload,
  };
}
