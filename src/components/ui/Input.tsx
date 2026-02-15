interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  type?: "text" | "email" | "tel" | "url" | "password" | "number";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Input({
  label,
  value,
  onChange,
  error,
  helperText,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  id,
  className = "",
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={
          hasError
            ? `${inputId}-error`
            : helperText
              ? `${inputId}-helper`
              : undefined
        }
        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
          hasError
            ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-green-500 focus:ring-green-500"
        } disabled:bg-gray-50 disabled:text-gray-500`}
      />
      {hasError && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
