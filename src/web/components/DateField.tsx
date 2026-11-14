// A labelled date (the browser's own date input; Primer has no public date picker). Values are
// ISO dates ("2026-11-12"), null when empty.
import { FormControl, TextInput } from "@primer/react";
import { type FieldProps, labelText, useFieldError } from "./field.ts";

type Props = FieldProps & { value: string | null; onChange: (value: string | null) => void; min?: string; max?: string; inlineLabel?: boolean /* the label inside the box, for a compact filter row */ };

export function DateField({ label, hideLabel, name, description, errorMessage, isRequired, isReadOnly, isDisabled, autoFocus, className, value, onChange, min, max, inlineLabel }: Props) {
  const { error, onInvalid, onEdit } = useFieldError(name, errorMessage);
  return (
    <FormControl disabled={isDisabled} className={className}>
      <FormControl.Label visuallyHidden={hideLabel || inlineLabel}>{labelText(label, isRequired)}</FormControl.Label>
      <TextInput
        type="date"
        leadingVisual={inlineLabel ? label : undefined}
        block
        size="small"
        name={name}
        aria-required={isRequired || undefined}
        min={min}
        max={max}
        autoFocus={autoFocus}
        value={value ?? ""}
        readOnly={isReadOnly}
        aria-invalid={error ? true : undefined}
        validationStatus={error ? "error" : undefined}
        onInvalid={onInvalid}
        onChange={(e) => {
          onEdit();
          onChange(e.target.value || null);
        }}
      />
      {description && <FormControl.Caption>{description}</FormControl.Caption>}
      {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
    </FormControl>
  );
}
