/**
 * Invite API client — calls the invite Edge Function proxy.
 */

import { invokeEdgeFunction } from "@/lib/edge-functions";

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
  const { data, error } = await invokeEdgeFunction<InviteResponse>("invite", {
    emails,
    session_id: sessionId,
  });

  if (error) throw new Error(error);

  const response = data ?? undefined;

  if (!response || !response.results) {
    throw new Error(
      "Received an empty response from the invite service. Please try again.",
    );
  }

  return response.results;
}
