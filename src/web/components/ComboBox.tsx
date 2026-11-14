// A text box that searches as you type and offers matches below it (the ARIA combobox pattern):
// ↑/↓ move through them, Enter or a click picks one, Escape closes the list. The caller does the
// searching (`inputValue` → `options`). Styled with Primer's form and overlay tokens; the list is
// portalled with a fixed position so a scrolling table (document lines) can't clip it.
import { FormControl, Spinner, TextInput } from "@primer/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type FieldProps, labelText, useFieldError } from "./field.ts";
import classes from "./ComboBox.module.css";

export type ComboOption = { id: number | string; label: string; description?: string };

type Props = FieldProps & {
  inputValue: string;
  onInputChange: (text: string) => void;
  options: ComboOption[];
  selectedId: number | string | null;
  onSelect: (option: ComboOption) => void;
  loading?: boolean;
  menuWidth?: number; // wider than the box, for long item names
};

export function ComboBox({ label, hideLabel, name, description, errorMessage, isRequired, isReadOnly, isDisabled, autoFocus, className, inputValue, onInputChange, options, selectedId, onSelect, loading, menuWidth = 0 }: Props) {
  const { error, onInvalid, onEdit } = useFieldError(name, errorMessage);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const showing = open && !isReadOnly && (options.length > 0 || !!loading);

  useEffect(() => setActive(0), [options]);
  // Follow the box while the page or a table scrolls under the open list.
  useLayoutEffect(() => {
    if (!showing) return;
    const measure = () => {
      const r = input.current?.getBoundingClientRect();
      if (r) setPlace({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, menuWidth) });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [showing, menuWidth]);

  const pick = (o: ComboOption) => {
    setOpen(false);
    onEdit();
    onSelect(o);
  };

  // The list sits outside FormControl, which renders only its own slots (label, input, caption…).
  return (
    <>
    <FormControl disabled={isDisabled} className={className}>
      <FormControl.Label visuallyHidden={hideLabel}>{labelText(label, isRequired)}</FormControl.Label>
      <TextInput
        ref={input}
        block
        size="small"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={showing ? listId : undefined}
        aria-activedescendant={showing && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        validationStatus={error ? "error" : undefined}
        name={name}
        aria-required={isRequired || undefined}
        autoFocus={autoFocus}
        readOnly={isReadOnly}
        value={inputValue}
        trailingVisual={loading && open ? <Spinner size="small" srText={null} /> : undefined}
        onInvalid={onInvalid}
        onChange={(e) => {
          onEdit();
          setOpen(true);
          onInputChange(e.target.value);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (isReadOnly) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!showing) return setOpen(true);
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((a) => (a + step + options.length) % Math.max(options.length, 1));
          } else if (e.key === "Enter" && showing && options[active]) {
            e.preventDefault(); // picks; doesn't submit the form or move to the next cell
            pick(options[active]!);
          } else if (e.key === "Escape" && showing) {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {description && <FormControl.Caption>{description}</FormControl.Caption>}
      {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
    </FormControl>
      {showing &&
        createPortal(
          <ul id={listId} role="listbox" aria-label={label} className={classes.list} style={place ?? { visibility: "hidden" }}>
            {options.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.id === selectedId}
                data-active={i === active || undefined}
                className={classes.option}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the box, so blur doesn't close first
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}>
                <span className={classes.label}>{o.label}</span>
                {o.description && <span className={classes.description}>{o.description}</span>}
              </li>
            ))}
            {loading && !options.length && <li className={classes.empty}>Searching…</li>}
          </ul>,
          document.body,
        )}
    </>
  );
}
