import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { supabaseMissing } from "@/lib/supabase";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

function MissingEnvScreen() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Configuration required</h1>
      <p style={{ marginTop: 12, color: "#555", lineHeight: 1.6 }}>
        BirthBuild needs Supabase credentials to run. Create a{" "}
        <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>.env</code> file in the project
        root with:
      </p>
      <pre style={{ marginTop: 16, background: "#1e1e1e", color: "#d4d4d4", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 14 }}>
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
      </pre>
      <p style={{ marginTop: 12, color: "#555", lineHeight: 1.6 }}>
        Then restart the dev server.
      </p>
    </main>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    {supabaseMissing ? (
      <MissingEnvScreen />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
);
