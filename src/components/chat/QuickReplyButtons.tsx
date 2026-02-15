/**
 * QuickReplyButtons — renders a row of outline buttons for multiple-choice responses.
 *
 * Parses [CHOICES: A | B | C] markers from assistant messages.
 * Shown only on the latest assistant message when choices are present.
 */

import { Button } from "@/components/ui/Button";

interface QuickReplyButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled: boolean;
  className?: string;
}

export function QuickReplyButtons({
  options,
  onSelect,
  disabled,
  className = "",
}: QuickReplyButtonsProps) {
  if (options.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 px-4 py-2 ${className}`}
      role="group"
      aria-label="Quick reply options"
    >
      {options.map((option) => (
        <Button
          key={option}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option)}
          disabled={disabled}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: extract choices from message content
// ---------------------------------------------------------------------------

export function extractChoices(content: string): string[] {
  const match = /\[CHOICES:\s*([^\]]+)\]/.exec(content);
  if (!match?.[1]) return [];
  return match[1].split("|").map((s) => s.trim()).filter(Boolean);
}
