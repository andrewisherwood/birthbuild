import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-green-700 text-white hover:bg-green-800 focus-visible:outline-green-700",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline-gray-500",
  outline:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-gray-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  children,
  onClick,
  type = "button",
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-md font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <>
          <LoadingSpinner
            className={`mr-2 ${size === "sm" ? "h-4 w-4" : "h-5 w-5"} ${variant === "primary" ? "text-white" : "text-gray-600"}`}
          />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
