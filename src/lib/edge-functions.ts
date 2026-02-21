import { supabase } from "@/lib/supabase";

const DEFAULT_TIMEOUT_MS = 60_000;

async function extractInvokeErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object") {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const text = await context.text().catch(() => "");
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          if (parsed.error) return parsed.error;
          if (parsed.message) return parsed.message;
        } catch {
          return text;
        }
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Request failed. Please try again.";
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<{ data: T | null; error: string | null }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }, timeoutMs);
    });

    const invokeResult = await Promise.race([
      supabase.functions.invoke<T>(functionName, { body }),
      timeoutPromise,
    ]);

    const { data, error } = invokeResult;
    if (error) {
      return { data: null, error: await extractInvokeErrorMessage(error) };
    }

    return { data: (data ?? null) as T | null, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Network error. Please check your connection and try again.";
    return { data: null, error: message };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
