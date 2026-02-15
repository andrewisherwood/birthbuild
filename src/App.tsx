import { Routes, Route } from "react-router-dom";
import IndexPage from "@/routes/index";
import ChatPage from "@/routes/chat";
import DashboardPage from "@/routes/dashboard";
import PreviewPage from "@/routes/preview";
import AdminSessionsPage from "@/routes/admin/sessions";
import AdminStudentsPage from "@/routes/admin/students";

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
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/admin/sessions" element={<AdminSessionsPage />} />
      <Route path="/admin/students" element={<AdminStudentsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
