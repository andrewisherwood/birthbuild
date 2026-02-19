/**
 * Invite API client — calls the invite Edge Function proxy.
 */

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteResult {
  email: string;
  success: boolean;
  magic_link?: string;
  error?: string;
}

interface InviteResponse {
  results: InviteResult[];
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

export async function inviteStudents(
  emails: string[],
  sessionId: string,
): Promise<InviteResult[]> {
  const { data, error } = await supabase.functions.invoke("invite", {
    body: {
      emails,
      session_id: sessionId,
    },
  });

  if (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message: string }).message
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }

  const response = data as InviteResponse | undefined;

  if (!response || !response.results) {
    throw new Error(
      "Received an empty response from the invite service. Please try again.",
    );
  }

  return response.results;
}
