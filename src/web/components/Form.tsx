// A form whose fields show server errors by name (`errors`, from ApiError.fieldErrors) and stop a
// submit while a required field is empty; the first invalid field gets focus.
import { type FormEvent, type ReactNode, useRef } from "react";
import { FieldErrors } from "./field.ts";

/**
 * Primer marks required fields with aria-required (not the `required` attribute), so the browser
 * doesn't check them: flag the empty ones through the browser's validity API, which fires `invalid`
 * on each (the fields show their message), then clear the flags so the next submit checks afresh.
 */
export function requiredMissing(form: HTMLFormElement): boolean {
  const controls = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[aria-required=true]")].filter((c) => !("readOnly" in c && c.readOnly) && !c.disabled);
  for (const c of controls) c.setCustomValidity(c.value.trim() ? "" : "Fill in this field.");
  const ok = form.checkValidity();
  for (const c of controls) c.setCustomValidity("");
  return !ok;
}

type Props = { id?: string; errors?: Record<string, string[]>; onSubmit: (e: FormEvent<HTMLFormElement>) => void; className?: string; children: ReactNode };

export function Form({ id, errors = {}, onSubmit, className, children }: Props) {
  const focused = useRef(false);
  return (
    <FieldErrors.Provider value={errors}>
      <form
        id={id}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (requiredMissing(e.currentTarget)) return;
          onSubmit(e);
        }}
        onInvalidCapture={(e) => {
          if (focused.current) return; // one focus per submit: the first invalid field
          focused.current = true;
          (e.target as HTMLElement).focus();
          queueMicrotask(() => (focused.current = false));
        }}>
        {children}
      </form>
    </FieldErrors.Provider>
  );
}
