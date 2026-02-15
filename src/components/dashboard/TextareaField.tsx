import { AskAiButton } from "@/components/dashboard/AskAiButton";
import type { SiteSpec } from "@/types/site-spec";

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  id?: string;
  className?: string;
  showAskAi?: boolean;
  siteSpec?: SiteSpec;
  onAiGenerated?: (text: string) => void;
}

export function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  required = false,
  helperText,
  error,
  id,
  className = "",
  showAskAi = false,
  siteSpec,
  onAiGenerated,
}: TextareaFieldProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {showAskAi && siteSpec && onAiGenerated && (
          <AskAiButton
            fieldName={label.toLowerCase()}
            siteSpec={siteSpec}
            onGenerated={onAiGenerated}
          />
        )}
      </div>
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError}
        aria-describedby={
          hasError
            ? `${textareaId}-error`
            : helperText
              ? `${textareaId}-helper`
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
          id={`${textareaId}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${textareaId}-helper`} className="mt-1 text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
