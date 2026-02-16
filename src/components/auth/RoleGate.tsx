import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Profile } from "@/types/database";

interface RoleGateProps {
  children: React.ReactNode;
  role: Profile["role"] | Profile["role"][];
}

export function RoleGate({ children, role }: RoleGateProps) {
  const { role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const allowed = Array.isArray(role)
    ? userRole !== null && role.includes(userRole)
    : userRole === role;

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
