import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextareaField } from "@/components/dashboard/TextareaField";
import type { Testimonial } from "@/types/site-spec";

interface TestimonialEditorProps {
  testimonials: Testimonial[];
  onChange: (testimonials: Testimonial[]) => void;
}

function createEmptyTestimonial(): Testimonial {
  return { quote: "", name: "", context: "" };
}

export function TestimonialEditor({
  testimonials,
  onChange,
}: TestimonialEditorProps) {
  const handleFieldChange = (
    index: number,
    field: keyof Testimonial,
    value: string,
  ) => {
    const updated = testimonials.map((testimonial, i) =>
      i === index ? { ...testimonial, [field]: value } : testimonial,
    );
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...testimonials, createEmptyTestimonial()]);
  };

  const handleRemove = (index: number) => {
    onChange(testimonials.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-gray-700">
        Testimonials
      </legend>
      <p className="mt-1 text-sm text-gray-500">
        Add quotes from clients to build trust with visitors.
      </p>

      <div className="mt-4 space-y-4">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-700">
                Testimonial {index + 1}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(index)}
                aria-label={`Remove testimonial ${index + 1}`}
              >
                Remove
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              <TextareaField
                label="Quote"
                value={testimonial.quote}
                onChange={(value) => handleFieldChange(index, "quote", value)}
                rows={3}
                placeholder="What the client said about your service..."
                id={`testimonial-quote-${index}`}
              />

              <Input
                label="Client Name"
                value={testimonial.name}
                onChange={(value) => handleFieldChange(index, "name", value)}
                placeholder="e.g. Emma R."
                id={`testimonial-name-${index}`}
              />

              <Input
                label="Context"
                value={testimonial.context}
                onChange={(value) => handleFieldChange(index, "context", value)}
                placeholder="e.g. First-time mum, home birth"
                id={`testimonial-context-${index}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="mt-4"
      >
        + Add testimonial
      </Button>
    </fieldset>
  );
}
