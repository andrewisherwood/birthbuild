import { Routes, Route, Link } from "react-router-dom";
import IndexPage from "@/routes/index";
import ChatPage from "@/routes/chat";
import DashboardPage from "@/routes/dashboard";
import PreviewPage from "@/routes/preview";
import AdminSessionsPage from "@/routes/admin/sessions";
import AdminStudentsPage from "@/routes/admin/students";
import AdminSitesPage from "@/routes/admin/sites";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGate } from "@/components/auth/RoleGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">
        The page you&rsquo;re looking for could not be found.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
      >
        Go Home
      </Link>
    </main>
  );
}

export function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/preview"
        element={
          <ProtectedRoute>
            <PreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sessions"
        element={
          <ProtectedRoute>
            <RoleGate role="instructor">
              <AdminSessionsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute>
            <RoleGate role="instructor">
              <AdminStudentsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sites"
        element={
          <ProtectedRoute>
            <RoleGate role="instructor">
              <AdminSitesPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </ErrorBoundary>
  );
}
