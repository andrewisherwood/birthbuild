/**
 * Claude function-calling tool definitions and mapping.
 * Fully implemented in Loop 3.
 */

import type { ClaudeToolDefinition } from "@/lib/claude";
import type { SiteSpec } from "@/types/site-spec";

export const CHAT_TOOLS: ClaudeToolDefinition[] = [];

export function mapToolCallToSpecUpdate(
  _toolName: string,
  _toolArgs: Record<string, unknown>,
): Partial<SiteSpec> | null {
  return null;
}
