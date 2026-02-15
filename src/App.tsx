import { Routes, Route } from "react-router-dom";
import IndexPage from "@/routes/index";
import ChatPage from "@/routes/chat";
import DashboardPage from "@/routes/dashboard";
import PreviewPage from "@/routes/preview";
import AdminSessionsPage from "@/routes/admin/sessions";
import AdminStudentsPage from "@/routes/admin/students";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGate } from "@/components/auth/RoleGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">Page not found</p>
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </ErrorBoundary>
  );
}
