/**
 * Claude API client — calls the chat Edge Function proxy.
 * The API key never reaches the browser.
 *
 * SEC-009/SEC-010: The system prompt and tool definitions are now hardcoded
 * in the Edge Function. The client only sends messages.
 */

import { invokeEdgeFunction } from "@/lib/edge-functions";

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

import type { DesignConfig } from "@/types/site-spec";

interface SendChatMessageParams {
  messages: Array<{ role: string; content: string }>;
}

interface SendDesignChatMessageParams {
  messages: Array<{ role: string; content: string }>;
  currentDesign: DesignConfig;
}

export async function sendChatMessage({
  messages,
}: SendChatMessageParams): Promise<ClaudeResponse> {
  const { data, error } = await invokeEdgeFunction<ClaudeResponse>(
    "chat",
    { messages },
  );

  if (error) {
    throw new Error(error);
  }

  if (!data || !data.content) {
    throw new Error("Received an empty response from the assistant. Please try again.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Design chat API call
// ---------------------------------------------------------------------------

export async function sendDesignChatMessage({
  messages,
  currentDesign,
}: SendDesignChatMessageParams): Promise<ClaudeResponse> {
  const { data, error } = await invokeEdgeFunction<ClaudeResponse>(
    "design-chat",
    { messages, current_design: currentDesign },
  );

  if (error) {
    throw new Error(error);
  }

  if (!data || !data.content) {
    throw new Error("Received an empty response from the assistant. Please try again.");
  }

  return data;
}
