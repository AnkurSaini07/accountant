// Shared by the field components (TextField, SelectField…): a form's server errors by field name
// ({ "lines.0.qty": ["…"] }), and each field's error state.
import { createContext, createElement, type InvalidEvent, type ReactNode, useContext, useState } from "react";

/** Server errors by field name; <Form errors> provides them. */
export const FieldErrors = createContext<Record<string, string[]>>({});

/**
 * What a field shows under it: its own `errorMessage`, else the server's error for its `name` until
 * the user edits it, else the browser's message when a submit found it invalid (required, empty).
 */
export function useFieldError(name?: string, errorMessage?: string) {
  const errors = useContext(FieldErrors);
  const [editedPast, setEditedPast] = useState<Record<string, string[]> | null>(null); // the errors the user has since edited
  const [native, setNative] = useState("");
  const server = name && editedPast !== errors ? errors[name]?.join(" ") : undefined;
  const error = errorMessage || server || native || undefined;
  return {
    error,
    onInvalid: (e: InvalidEvent<HTMLElement>) => {
      e.preventDefault(); // our message under the field, not the browser's bubble
      setNative((e.currentTarget as HTMLInputElement).validationMessage || "Fill in this field.");
    },
    onEdit: () => {
      setEditedPast(errors);
      setNative("");
    },
  };
}

export type FieldProps = {
  label: string;
  hideLabel?: boolean; // e.g. a line item's cells: named by aria-label, no visible label
  name?: string;
  description?: React.ReactNode;
  errorMessage?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

/**
 * A field's label text: a required field gets a "*" that screen readers skip (the input itself says
 * required), so its accessible name stays "Name". Primer's own required star is read out ("Name*").
 */
export const labelText = (label: string, required?: boolean): ReactNode =>
  required ? [label, createElement("span", { key: "*", "aria-hidden": true, style: { color: "var(--fgColor-danger)" } }, " *")] : label;
