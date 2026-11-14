// A labelled one-line text box (Primer FormControl + TextInput) with its caption and error.
import { FormControl, TextInput } from "@primer/react";
import type { HTMLAttributes, ReactNode } from "react";
import { type FieldProps, labelText, useFieldError } from "./field.ts";

type Props = FieldProps & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: "text" | "email" | "tel" | "url" | "password";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  maxLength?: number;
  leadingVisual?: ReactNode;
  trailingVisual?: ReactNode;
  monospace?: boolean;
};

export function TextField({ label, hideLabel, name, description, errorMessage, isRequired, isReadOnly, isDisabled, className, value, onChange, ...input }: Props) {
  const { error, onInvalid, onEdit } = useFieldError(name, errorMessage);
  return (
    <FormControl disabled={isDisabled} className={className}>
      <FormControl.Label visuallyHidden={hideLabel}>{labelText(label, isRequired)}</FormControl.Label>
      <TextInput
        {...input}
        block
        size="small"
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
