/**
 * Multi-provider LLM client abstraction.
 *
 * Normalises Anthropic and OpenAI APIs into a common request/response
 * interface so edge functions can call either provider transparently.
 *
 * Used by generate-design-system and generate-page when a prompt_config
 * override is present (A/B testing harness). Production paths that omit
 * prompt_config also route through this client for consistency.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool input (provider-agnostic). */
  input_schema: Record<string, unknown>;
}

export interface ModelRequest {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  tools: ToolDefinition[];
  /** Force the model to call this tool (Anthropic tool_choice / OpenAI function_call). */
  forcedTool?: string;
  temperature?: number;
  maxTokens: number;
}

export interface ModelResponse {
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  textContent: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

// ---------------------------------------------------------------------------
// Anthropic serialisation
// ---------------------------------------------------------------------------

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function toAnthropicTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

interface AnthropicToolChoice {
  type: "tool" | "auto";
  name?: string;
}

function anthropicToolChoice(forcedTool?: string): AnthropicToolChoice {
  if (forcedTool) return { type: "tool", name: forcedTool };
  return { type: "auto" };
}

async function callAnthropic(req: ModelRequest): Promise<ModelResponse> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.systemPrompt,
    messages: [{ role: "user", content: req.userMessage }],
    tools: toAnthropicTools(req.tools),
    tool_choice: anthropicToolChoice(req.forcedTool),
  };
  if (req.temperature !== undefined) {
    body.temperature = req.temperature;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic API error (HTTP ${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const stopReason =
    typeof data.stop_reason === "string" ? data.stop_reason : null;

  // Extract usage
  const rawUsage = data.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  const usage = {
    inputTokens: rawUsage?.input_tokens ?? 0,
    outputTokens: rawUsage?.output_tokens ?? 0,
  };

  // Find tool_use block
  const content = data.content as Array<Record<string, unknown>> | undefined;
  let toolName: string | null = null;
  let toolInput: Record<string, unknown> | null = null;
  let textContent = "";

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "tool_use" && typeof block.name === "string") {
        toolName = block.name;
        toolInput = (block.input as Record<string, unknown>) ?? null;
      } else if (block.type === "text" && typeof block.text === "string") {
        textContent += block.text;
      }
    }
  }

  return { toolName, toolInput, textContent, stopReason, usage };
}

// ---------------------------------------------------------------------------
// OpenAI serialisation
// ---------------------------------------------------------------------------

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

async function callOpenAI(req: ModelRequest): Promise<ModelResponse> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_completion_tokens: req.maxTokens,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userMessage },
    ],
    tools: toOpenAITools(req.tools),
  };
  if (req.temperature !== undefined) {
    body.temperature = req.temperature;
  }
  if (req.forcedTool) {
    body.tool_choice = {
      type: "function",
      function: { name: req.forcedTool },
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error (HTTP ${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Extract usage
  const rawUsage = data.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;
  const usage = {
    inputTokens: rawUsage?.prompt_tokens ?? 0,
    outputTokens: rawUsage?.completion_tokens ?? 0,
  };

  // Extract choice
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const message = choice?.message as Record<string, unknown> | undefined;
  const finishReason =
    typeof choice?.finish_reason === "string" ? choice.finish_reason : null;

  // Map OpenAI finish_reason to Anthropic-style stop_reason for consistency
  let stopReason: string | null = null;
  if (finishReason === "stop") stopReason = "end_turn";
  else if (finishReason === "length") stopReason = "max_tokens";
  else if (finishReason === "tool_calls") stopReason = "tool_use";
  else stopReason = finishReason;

  let toolName: string | null = null;
  let toolInput: Record<string, unknown> | null = null;
  const textContent =
    typeof message?.content === "string" ? message.content : "";

  const toolCalls = message?.tool_calls as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const firstCall = toolCalls[0]!;
    const fn = firstCall.function as
      | { name?: string; arguments?: string }
      | undefined;
    if (fn?.name) {
      toolName = fn.name;
      try {
        toolInput = JSON.parse(fn.arguments ?? "{}") as Record<
          string,
          unknown
        >;
      } catch {
        toolInput = null;
      }
    }
  }

  return { toolName, toolInput, textContent, stopReason, usage };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call an LLM provider with a normalised request and get a normalised response.
 *
 * Throws on network/API errors — callers should catch and return appropriate
 * HTTP error responses.
 */
export async function callModel(req: ModelRequest): Promise<ModelResponse> {
  switch (req.provider) {
    case "anthropic":
      return callAnthropic(req);
    case "openai":
      return callOpenAI(req);
    default:
      throw new Error(`Unsupported provider: ${req.provider as string}`);
  }
}
