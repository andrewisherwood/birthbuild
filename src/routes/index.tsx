import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function IndexPage() {
  const { user, role, loading, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Redirect authenticated users based on role
  if (user) {
    if (role === "instructor") {
      return <Navigate to="/admin/sessions" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);

    const result = await signInWithMagicLink(email);

    setSending(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Check your email
          </h1>
          <p className="mt-2 text-gray-600">
            We have sent a magic link to{" "}
            <span className="font-medium">{email}</span>. Click the link to sign
            in.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
            className="mt-4 text-sm text-green-700 underline hover:text-green-800"
          >
            Use a different email address
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-gray-900">
          BirthBuild
        </h1>
        <p className="mt-2 text-center text-gray-600">
          Build your professional birth worker website
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="flex w-full justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:opacity-50"
          >
            {sending ? (
              <LoadingSpinner className="h-5 w-5 text-white" />
            ) : (
              "Send magic link"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
