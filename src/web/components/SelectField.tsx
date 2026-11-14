// A labelled drop-down (Primer Select, the browser's own list). `options`: [value, label] pairs or
// a { value: label } record, in order; or `groups` of them under headings. With no `placeholder`,
// the first option is the default.
import { FormControl, Select } from "@primer/react";
import { type FieldProps, labelText, useFieldError } from "./field.ts";

type Options = Record<string, string> | readonly (readonly [string, string])[];
const pairsOf = (o: Options) => (Array.isArray(o) ? o : Object.entries(o)) as readonly (readonly [string, string])[];

type Props = FieldProps & {
  value: string | null;
  onChange: (value: string | null) => void;
  options?: Options;
  groups?: { label: string; options: Options }[];
  placeholder?: string; // shown while nothing is chosen ("Choose a reason")
};

export function SelectField({ label, hideLabel, name, description, errorMessage, isRequired, isReadOnly, isDisabled, autoFocus, className, value, onChange, options = [], groups, placeholder }: Props) {
  const { error, onInvalid, onEdit } = useFieldError(name, errorMessage);
  const list = (o: Options) =>
    pairsOf(o).map(([v, text]) => (
      <Select.Option key={v} value={v}>
        {text}
      </Select.Option>
    ));
  return (
    <FormControl disabled={isDisabled || isReadOnly} className={className}>
      <FormControl.Label visuallyHidden={hideLabel}>{labelText(label, isRequired)}</FormControl.Label>
      <Select
        block
        size="small"
        name={name}
        aria-required={isRequired || undefined}
        autoFocus={autoFocus}
        value={value ?? ""}
        aria-invalid={error ? true : undefined}
        validationStatus={error ? "error" : undefined}
        onInvalid={onInvalid}
        onChange={(e) => {
          onEdit();
          onChange(e.target.value || null);
        }}>
        {placeholder !== undefined && <Select.Option value="">{placeholder}</Select.Option>}
        {list(options)}
        {groups?.map((g) => (
          <Select.OptGroup key={g.label} label={g.label}>
            {list(g.options)}
          </Select.OptGroup>
        ))}
      </Select>
      {description && <FormControl.Caption>{description}</FormControl.Caption>}
      {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
    </FormControl>
  );
}
