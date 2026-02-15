/**
 * Claude API client — calls the chat Edge Function proxy.
 * The API key never reaches the browser.
 */

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeContentBlock {
  type: "text";
  text: string;
}

export interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ClaudeBlock = ClaudeContentBlock | ClaudeToolUseBlock;

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

interface SendChatMessageParams {
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  tools?: ClaudeToolDefinition[];
}

export async function sendChatMessage({
  messages,
  systemPrompt,
  tools,
}: SendChatMessageParams): Promise<ClaudeResponse> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages,
      system: systemPrompt,
      tools: tools ?? [],
    },
  });

  if (error) {
    // Supabase functions.invoke wraps network / non-2xx errors
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message: string }).message
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }

  // The Edge Function returns the Claude response JSON directly
  const response = data as ClaudeResponse | undefined;

  if (!response || !response.content) {
    throw new Error("Received an empty response from the assistant. Please try again.");
  }

  return response;
}
