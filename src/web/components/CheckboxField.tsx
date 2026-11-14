// A checkbox with its label (and optional caption) beside it.
import { Checkbox, FormControl } from "@primer/react";
import type { ReactNode } from "react";

type Props = { label: ReactNode; name?: string; value?: string; isSelected: boolean; onChange: (on: boolean) => void; description?: ReactNode; isReadOnly?: boolean; isDisabled?: boolean; className?: string };

export function CheckboxField({ label, name, value, isSelected, onChange, description, isReadOnly, isDisabled, className }: Props) {
  return (
    <FormControl disabled={isDisabled || isReadOnly} className={className}>
      <Checkbox name={name} value={value} checked={isSelected} onChange={(e) => onChange(e.target.checked)} />
      <FormControl.Label>{label}</FormControl.Label>
      {description && <FormControl.Caption>{description}</FormControl.Caption>}
    </FormControl>
  );
}
