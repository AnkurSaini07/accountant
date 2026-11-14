// A whole-number box (Primer has none): type freely, and on leaving the box it snaps into
// [minValue, maxValue]. A text input with inputMode="numeric", so phones show the digit pad.
import { useEffect, useState } from "react";
import type { FieldProps } from "./field.ts";
import { TextField } from "./TextField.tsx";

type Props = FieldProps & { value: number; onChange: (value: number) => void; minValue?: number; maxValue?: number };

export const clampInt = (text: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(text.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

export function NumberField({ value, onChange, minValue = 0, maxValue = Number.MAX_SAFE_INTEGER, ...field }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <TextField
      {...field}
      inputMode="numeric"
      value={text}
      onChange={(t) => {
        setText(t);
        if (/^\d+$/.test(t)) onChange(Number(t));
      }}
      onBlur={() => {
        const n = clampInt(text, minValue, maxValue, value < minValue ? minValue : value);
        setText(String(n));
        if (n !== value) onChange(n);
      }}
    />
  );
}
