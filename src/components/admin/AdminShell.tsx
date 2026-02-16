import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

interface AdminShellProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  requiredRole?: "admin";
}

const NAV_ITEMS: NavItem[] = [
  { label: "Sessions", path: "/admin/sessions" },
  { label: "Students", path: "/admin/students" },
  { label: "My Sites", path: "/admin/sites" },
  { label: "Instructors", path: "/admin/instructors", requiredRole: "admin" },
];

export function AdminShell({ children }: AdminShellProps) {
  const { role, signOut } = useAuth();
  const location = useLocation();

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.requiredRole || item.requiredRole === role,
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-gray-900">
            BirthBuild Admin
          </h1>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>

        {/* Navigation */}
        <nav
          className="mx-auto max-w-6xl"
          aria-label="Admin navigation"
        >
          <ul className="-mb-px flex gap-6">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`inline-block border-b-2 pb-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-green-700 text-green-700"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
