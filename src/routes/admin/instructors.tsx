import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { invokeEdgeFunctionBypass } from "@/lib/auth-bypass";

interface InviteResult {
  magic_link: string;
  email: string;
}

export default function AdminInstructorsPage() {
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      const { data, error: fnError } = await invokeEdgeFunctionBypass<{
        magic_link: string;
        error?: string;
      }>("invite-instructor", {
        email: email.trim().toLowerCase(),
        org_name: orgName.trim(),
      });

      if (fnError) {
        setError(fnError);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setResult({ magic_link: data!.magic_link, email: email.trim().toLowerCase() });
      setEmail("");
      setOrgName("");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.magic_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900">
          Invite Instructor
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Create a new instructor account with their own organisation and send
          them a magic link to sign in.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="instructor-email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="instructor-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@example.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-gray-700"
            >
              Organisation name
            </label>
            <input
              id="org-name"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Bristol Birth Workers"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending invite\u2026" : "Send invite"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Invitation sent to {result.email}
            </p>
            <p className="mt-2 text-xs text-green-700">
              A magic link email has been sent. You can also copy the link below
              to share manually:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={result.magic_link}
                className="block w-full rounded-md border-gray-300 bg-white text-xs text-gray-700"
                aria-label="Magic link URL"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
