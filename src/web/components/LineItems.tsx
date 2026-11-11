// The lines of any document (quotation, order, challan, invoice, PO, bill…): pick an item and its
// HSN, unit, rate and GST fill in; type qty, rate and discount; the amount and the document's
// totals update as you type, using documentTotals, the same code the server saves with.
// Keyboard: Enter moves to the next cell (Tab works as usual); Enter or Tab in the last cell adds a
// line; each line's remove button is reachable by Tab. Server errors show by field name
// (lines.2.qty) through the parent <Form validationErrors>.
import { ActionButton, Text } from "@react-spectrum/s2/ActionButton";
import Add from "@react-spectrum/s2/icons/Add";
import Delete from "@react-spectrum/s2/icons/Delete";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextField } from "@react-spectrum/s2/TextField";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { documentTotals } from "../../shared/document-totals.ts";
import { formatRupees, parseRupees } from "../../shared/money.ts";
import { parseQty } from "../../shared/quantity.ts";
import type { DocumentInput } from "../../shared/schemas/document.ts";
import { ItemPicker, type PickedItem } from "./ItemPicker.tsx";
import { TotalsSummary } from "./TotalsSummary.tsx";

export type LineDraft = {
  key: number; // React key; stable while lines are added and removed
  item: PickedItem | null;
  description: string;
  qty: string; // as typed, in the item's unit ("1.250")
  rate: string; // rupees as typed
  discount: string; // percent as typed
};
type Line = DocumentInput["lines"][number];

let nextKey = 1;
export const emptyLine = (): LineDraft => ({ key: nextKey++, item: null, description: "", qty: "", rate: "", discount: "" });
const rupees = (paise: number) => (paise ? formatRupees(paise).replaceAll(",", "") : "");

/** A draft line as the API takes it, or the fields it can't convert (named like the server's). */
export function toLine(d: LineDraft, i: number): { line: Line } | { errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  const at = (field: string, message: string) => (errors[`lines.${i}.${field}`] = [message]);
  if (!d.item) at("item_id", "Choose an item.");
  let qty = 0;
  try {
    qty = parseQty(d.qty, d.item?.unit_decimals ?? 0);
    if (qty <= 0) at("qty", "Enter a quantity.");
  } catch (e) {
    at("qty", d.qty.trim() ? (e as Error).message : "Enter a quantity.");
  }
  let rate = 0;
  try {
    rate = d.rate.trim() ? parseRupees(d.rate) : 0;
    if (rate < 0) at("rate", "Can't be negative.");
  } catch {
    at("rate", "Enter an amount like 250 or 1,250.50.");
  }
  const discount = Number(d.discount.trim() || 0);
  if (!/^\d{0,3}(\.\d{0,2})?$/.test(d.discount.trim()) || discount > 100) at("discount_bp", "Enter a discount from 0 to 100%.");
  if (Object.keys(errors).length) return { errors };
  return { line: { item_id: d.item!.id, description: d.description.trim(), qty, rate, discount_bp: Math.round(discount * 100), gst_rate: d.item!.gst_rate } };
}

/** The lines to send, or every field error at once. Blank lines (no item, nothing typed) are dropped. */
export function linesBody(drafts: LineDraft[]): { lines: Line[]; errors: Record<string, string[]> } {
  const lines: Line[] = [];
  const errors: Record<string, string[]> = {};
  drafts
    .filter((d) => d.item || d.qty.trim() || d.rate.trim())
    .forEach((d, i) => {
      const r = toLine(d, i);
      if ("line" in r) lines.push(r.line);
      else Object.assign(errors, r.errors);
    });
  return { lines, errors };
}

export type TotalsContext = { type: DocumentInput["type"]; companyState: string; partyState: string | null; placeOfSupply: string | null };

const wrap = style({ display: "flex", flexDirection: "column", gap: 16 });
const scroller = style({ overflowX: "auto" }); // on a phone the grid scrolls sideways
const table = style({ borderCollapse: "collapse", width: "full", font: "body" });
const th = style({ font: "ui-sm", color: "gray-700", textAlign: "start", paddingX: 4, paddingY: 8, whiteSpace: "nowrap" });
const thEnd = style({ font: "ui-sm", color: "gray-700", textAlign: "end", paddingX: 4, paddingY: 8, whiteSpace: "nowrap" });
const td = style({ paddingX: 4, paddingY: 4, verticalAlign: "top" });
const fixed = style({ paddingX: 4, paddingTop: 12, verticalAlign: "top", whiteSpace: "nowrap", color: "gray-800" });
const money = style({ paddingX: 4, paddingTop: 12, verticalAlign: "top", whiteSpace: "nowrap", textAlign: "end", fontVariantNumeric: "tabular-nums" });

type Props = {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  side: "sale" | "purchase"; // which item price fills the rate
  totals: TotalsContext;
  isReadOnly?: boolean;
};

export function LineItems({ lines, onChange, side, totals: ctx, isReadOnly = false }: Props) {
  const body = useRef<HTMLTableSectionElement>(null);
  const focusNewLine = useRef(false);
  useEffect(() => {
    if (!focusNewLine.current) return;
    focusNewLine.current = false;
    body.current?.querySelector<HTMLInputElement>("tr:last-child input")?.focus();
  }, [lines.length]);

  const set = (key: number, patch: Partial<LineDraft>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = () => {
    focusNewLine.current = true;
    onChange([...lines, emptyLine()]);
  };
  const remove = (key: number) => onChange(lines.length > 1 ? lines.filter((l) => l.key !== key) : [emptyLine()]);

  function onKeyDown(e: KeyboardEvent) {
    if (isReadOnly || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return; // e.g. Enter that picked an item
    if (e.key !== "Enter" && !(e.key === "Tab" && !e.shiftKey)) return;
    const cells = [...(body.current?.querySelectorAll<HTMLInputElement>("input:not([type=hidden])") ?? [])];
    const at = cells.indexOf(e.target as HTMLInputElement);
    if (at < 0) return;
    const last = at === cells.length - 1;
    if (e.key === "Tab" && !last) return; // the browser's own Tab
    e.preventDefault(); // Enter would otherwise submit the form
    if (last) add();
    else cells[at + 1]!.focus();
  }

  // Live totals from the complete lines; amounts line up with the rows they came from.
  const complete = lines.map((d, i) => toLine(d, i)).map((r) => ("line" in r ? r.line : null));
  const used = lines.map((d, i) => (complete[i] ? d : null)).filter((d) => d !== null);
  let result: ReturnType<typeof documentTotals> | { error: string };
  try {
    result = documentTotals({
      type: ctx.type,
      companyState: ctx.companyState,
      // ponytail: until a party is chosen, assume a local sale (CGST + SGST); the server works it out properly on save.
      partyState: ctx.partyState ?? ctx.companyState,
      placeOfSupply: ctx.placeOfSupply ?? ctx.partyState ?? ctx.companyState,
      lines: used.map((d) => ({ ...complete[lines.indexOf(d)]!, hsn: d.item!.hsn, unit_decimals: d.item!.unit_decimals })),
    });
  } catch (e) {
    result = { error: (e as Error).message };
  }
  const amountOf = (d: LineDraft) => ("lines" in result ? result.lines[used.indexOf(d)]?.taxable : undefined);

  return (
    <div className={wrap}>
      <div className={scroller}>
        <table className={table} aria-label="Lines">
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>Item</th>
              <th className={th}>Description</th>
              <th className={th}>HSN/SAC</th>
              <th className={thEnd}>Qty</th>
              <th className={th}>Unit</th>
              <th className={thEnd}>Rate (₹)</th>
              <th className={thEnd}>Disc %</th>
              <th className={thEnd}>GST</th>
              <th className={thEnd}>Amount (₹)</th>
              {!isReadOnly && (
                <th className={th}>
                  <span hidden>Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody ref={body} onKeyDown={onKeyDown}>
            {lines.map((d, i) => {
              const n = i + 1;
              const amount = amountOf(d);
              return (
                <tr key={d.key}>
                  <td className={fixed}>{n}</td>
                  <td className={td}>
                    <ItemPicker
                      aria-label={`Item, line ${n}`}
                      name={`lines.${i}.item_id`}
                      item={d.item}
                      isReadOnly={isReadOnly}
                      onPick={(item) => set(d.key, { item, rate: rupees(side === "sale" ? item.sale_price : item.purchase_price) })}
                    />
                  </td>
                  <td className={td}>
                    <TextField aria-label={`Description, line ${n}`} name={`lines.${i}.description`} isReadOnly={isReadOnly} value={d.description} onChange={(description) => set(d.key, { description })} styles={style({ width: 200 })} />
                  </td>
                  <td className={fixed}>{d.item?.hsn ?? ""}</td>
                  <td className={td}>
                    <TextField aria-label={`Qty, line ${n}`} name={`lines.${i}.qty`} inputMode="decimal" isReadOnly={isReadOnly} value={d.qty} onChange={(qty) => set(d.key, { qty })} styles={style({ width: 100 })} />
                  </td>
                  <td className={fixed}>{d.item?.unit ?? ""}</td>
                  <td className={td}>
                    <TextField aria-label={`Rate, line ${n}`} name={`lines.${i}.rate`} inputMode="decimal" isReadOnly={isReadOnly} value={d.rate} onChange={(rate) => set(d.key, { rate })} styles={style({ width: 110 })} />
                  </td>
                  <td className={td}>
                    <TextField aria-label={`Discount %, line ${n}`} name={`lines.${i}.discount_bp`} inputMode="decimal" isReadOnly={isReadOnly} value={d.discount} onChange={(discount) => set(d.key, { discount })} styles={style({ width: 70 })} />
                  </td>
                  <td className={money}>{d.item ? `${d.item.gst_rate}%` : ""}</td>
                  <td className={money} aria-label={`Amount, line ${n}`}>
                    {amount === undefined ? "" : formatRupees(amount)}
                  </td>
                  {!isReadOnly && (
                    <td className={td}>
                      <ActionButton isQuiet aria-label={`Remove line ${n}`} onPress={() => remove(d.key)}>
                        <Delete />
                      </ActionButton>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isReadOnly && (
        <ActionButton onPress={add} styles={style({ alignSelf: "start" })}>
          <Add />
          <Text>Add line</Text>
        </ActionButton>
      )}
      <TotalsSummary totals={result} />
    </div>
  );
}
