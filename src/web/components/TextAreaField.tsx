// A labelled multi-line text box (Primer Textarea): terms, notes, addresses.
import { FormControl, Textarea } from "@primer/react";
import { type FieldProps, labelText, useFieldError } from "./field.ts";

type Props = FieldProps & { value: string; onChange: (value: string) => void; rows?: number; maxLength?: number };

export function TextAreaField({ label, hideLabel, name, description, errorMessage, isRequired, isReadOnly, isDisabled, autoFocus, className, value, onChange, rows = 3, maxLength }: Props) {
  const { error, onInvalid, onEdit } = useFieldError(name, errorMessage);
  return (
    <FormControl disabled={isDisabled} className={className}>
      <FormControl.Label visuallyHidden={hideLabel}>{labelText(label, isRequired)}</FormControl.Label>
      <Textarea
        block
        resize="vertical"
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        name={name}
        aria-required={isRequired || undefined}
        value={value}
        readOnly={isReadOnly}
        aria-invalid={error ? true : undefined}
        validationStatus={error ? "error" : undefined}
        onInvalid={onInvalid}
        onChange={(e) => {
          onEdit();
          onChange(e.target.value);
        }}
      />
      {description && <FormControl.Caption>{description}</FormControl.Caption>}
      {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
    </FormControl>
  );
}
