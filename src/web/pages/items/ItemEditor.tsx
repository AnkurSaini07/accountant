import { Button, Label } from "@primer/react";
import { TextField } from "../../components/TextField.tsx";
import { TextAreaField } from "../../components/TextAreaField.tsx";
import { Form } from "../../components/Form.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { ToastQueue } from "../../toast.ts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { formatRupees, parseRupees } from "../../../shared/money.ts";
import { formatQty, parseQty } from "../../../shared/quantity.ts";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../../shared/schemas/item.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { formPage, stack, twoUp } from "../../components/formLayout.ts";
import { EnterSubmits } from "../../components/EnterSubmits.tsx";
import { Panel } from "../../components/Panel.tsx";
import { Cell } from "../../components/Cell.tsx";
import { FieldGrid } from "../../components/FieldGrid.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { type GstRate, type Item, type Unit, note } from "./item.ts";

type ItemType = (typeof ITEM_TYPES)[number];

type Draft = {
  code: string;
  name: string;
  description: string;
  type: ItemType;
  hsn: string;
  unit_id: number | null;
  gst_rate_id: number | null;
  sale_price: string; // rupees
  purchase_price: string;
  opening_qty: string; // in the unit, e.g. "1.250"
  opening_value: string;
  reorder_level: string; // in the unit; "" = no alert
};

const LIST = "/masters/items";

const rupees = (paise: number) => (paise ? formatRupees(paise).replaceAll(",", "") : "");

/**
 * The rates to offer: active ones in force today, the newest row per rate (18% from 2027 replaces
 * 18% from 2017 once it starts), plus the item's current rate even if it's no longer offered.
 */
export function rateChoices(rates: GstRate[], currentId: number | null, today = new Date().toISOString().slice(0, 10)): GstRate[] {
  const byRate = new Map<number, GstRate>();
  for (const r of rates) {
    if (!r.active || r.effective_from > today) continue;
    const seen = byRate.get(r.rate);
    if (!seen || r.effective_from > seen.effective_from) byRate.set(r.rate, r);
  }
  const current = rates.find((r) => r.id === currentId);
  if (current && byRate.get(current.rate)?.id !== current.id) byRate.set(current.rate, current);
  return [...byRate.values()].sort((a, b) => a.rate - b.rate);
}

function toDraft(item: Item | null, units: Unit[]): Draft {
  if (!item) {
    return {
      code: "", name: "", description: "", type: "finished", hsn: "", unit_id: units.find((u) => u.code === "NOS")?.id ?? null, gst_rate_id: null,
      sale_price: "", purchase_price: "", opening_qty: "", opening_value: "", reorder_level: "",
    };
  }
  const d = item.unit_decimals;
  return {
    code: item.code, name: item.name, description: item.description, type: item.type as ItemType, hsn: item.hsn ?? "",
    unit_id: item.unit_id, gst_rate_id: item.gst_rate_id,
    sale_price: rupees(item.sale_price), purchase_price: rupees(item.purchase_price),
    opening_qty: item.opening_qty ? formatQty(item.opening_qty, d) : "", opening_value: rupees(item.opening_value),
    reorder_level: item.reorder_level === null ? "" : formatQty(item.reorder_level, d),
  };
}

/** The body the API takes, or errors for fields we can't convert. */
function toBody(d: Draft, decimals: number) {
  const errors: Record<string, string[]> = {};
  const money = (key: keyof Draft) => {
    const text = String(d[key]).trim();
    if (!text) return 0;
    try {
      return parseRupees(text);
    } catch {
      errors[key] = ["Enter an amount like 250 or 1,250.50."];
      return 0;
    }
  };
  const qty = (key: keyof Draft) => {
    const text = String(d[key]).trim();
    if (!text) return null;
    try {
      return parseQty(text, decimals);
    } catch (e) {
      errors[key] = [(e as Error).message];
      return null;
    }
  };
  const service = d.type === "service";
  const body = {
    code: d.code,
    name: d.name,
    description: d.description,
    type: d.type,
    hsn: d.hsn,
    unit_id: d.unit_id ?? 0, // 0 → "Choose a unit." from the server
    gst_rate_id: d.gst_rate_id ?? 0,
    sale_price: money("sale_price"),
    purchase_price: money("purchase_price"),
    opening_qty: service ? 0 : (qty("opening_qty") ?? 0),
    opening_value: service ? 0 : money("opening_value"),
    reorder_level: service ? null : qty("reorder_level"),
  };
  return { body, errors };
}

export function ItemEditor({ item, units, rates, onSaved }: { item: Item | null; units: Unit[]; rates: GstRate[]; onSaved: (i: Item) => void }) {
  const role = useUser().role;
  const readOnly = role !== "admin" && role !== "accountant";
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => toDraft(item, units));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const unit = units.find((u) => u.id === draft.unit_id);
  const decimals = unit?.decimals ?? 0;
  const service = draft.type === "service";
  const unitChoices = units.filter((u) => u.active || u.id === draft.unit_id);

  async function run(action: () => Promise<Item>, message: string) {
    setBusy(true);
    try {
      const saved = await action();
      setErrors({});
      ToastQueue.positive(message, { timeout: 5000 });
      return saved;
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const { body, errors: local } = toBody(draft, decimals);
    if (Object.keys(local).length) return setErrors(local);
    const saved = await run(
      () => call(item ? client.api.items[":id"].$put({ param: { id: String(item.id) }, json: body }) : client.api.items.$post({ json: body })),
      `${draft.name.trim()} saved.`,
    );
    if (saved) navigate(LIST);
  }

  async function setActive(active: boolean) {
    if (!item) return;
    const param = { param: { id: String(item.id) } };
    const saved = await run(
      () => call(active ? client.api.items[":id"].reactivate.$post(param) : client.api.items[":id"].deactivate.$post(param)),
      active ? `${item.name} is active again.` : `${item.name} deactivated. Old documents keep it; new ones can't pick it.`,
    );
    if (saved) onSaved(saved);
  }

  const unitLabel = unit ? ` (${unit.code})` : "";
  return (
    <div className={formPage}>
      <PageHeader
        back={{ href: LIST, label: "Back to items" }}
        eyebrow={item ? "Item" : "New"}
        title={item ? item.name : "item"}
        badge={item && !item.active && <Label variant="default">Inactive</Label>}
        actions={
          !readOnly && (
            <>
              {item && (
                <Button variant="default" size="small" disabled={busy} onClick={() => void setActive(!item.active)}>
                  {item.active ? "Deactivate" : "Reactivate"}
                </Button>
              )}
              <Button type="submit" form="item-form" variant="primary" size="small" loading={busy}>
                Save
              </Button>
            </>
          )
        }
      />
      {readOnly && <p className={note}>You can view items; ask an accountant or admin to change them.</p>}
      <Form id="item-form" errors={errors} className={stack} onSubmit={() => void save()}>
        <EnterSubmits />
        <Panel title="Item">
          <FieldGrid>
            <Cell>
              <TextField isReadOnly={readOnly} isRequired label="Code" name="code" description="Your own code, e.g. FG-101." value={draft.code} onChange={set("code")} autoFocus={!item && !readOnly} />
            </Cell>
            <Cell wide>
              <TextField isReadOnly={readOnly} isRequired label="Name" name="name" value={draft.name} onChange={set("name")} />
            </Cell>
            <Cell>
              <SelectField isReadOnly={readOnly} label="Type" name="type" value={draft.type} onChange={(k) => k && set("type")(k as ItemType)} options={ITEM_TYPES.map((t) => [t, ITEM_TYPE_LABELS[t]] as const)} />
            </Cell>
            <Cell>
              <TextField isReadOnly={readOnly} label={service ? "SAC" : "HSN"} name="hsn" inputMode="numeric" description="4, 6 or 8 digits." value={draft.hsn} onChange={set("hsn")} />
            </Cell>
            <Cell>
              <SelectField isReadOnly={readOnly} isRequired label="Unit" name="unit_id" placeholder="Choose a unit" value={draft.unit_id === null ? null : String(draft.unit_id)} onChange={(k) => k && set("unit_id")(Number(k))} options={unitChoices.map((u) => [String(u.id), `${u.code} – ${u.name}`] as const)} />
            </Cell>
            <Cell>
              <SelectField isReadOnly={readOnly} isRequired label="GST rate" name="gst_rate_id" placeholder="Choose a rate" value={draft.gst_rate_id === null ? null : String(draft.gst_rate_id)} onChange={(k) => k && set("gst_rate_id")(Number(k))} options={rateChoices(rates, draft.gst_rate_id).map((r) => [String(r.id), `${r.rate}%`] as const)} />
            </Cell>
            <Cell full>
              <TextAreaField isReadOnly={readOnly} label="Description" name="description" description="Printed under the name on documents." value={draft.description} onChange={set("description")} />
            </Cell>
          </FieldGrid>
        </Panel>

        <div className={twoUp}>
          <Panel title="Prices">
            <FieldGrid half>
              <Cell>
                <TextField isReadOnly={readOnly} label={`Sale price (₹)${unit ? ` per ${unit.code}` : ""}`} name="sale_price" inputMode="decimal" value={draft.sale_price} onChange={set("sale_price")} />
              </Cell>
              <Cell>
                <TextField isReadOnly={readOnly} label={`Purchase price (₹)${unit ? ` per ${unit.code}` : ""}`} name="purchase_price" inputMode="decimal" value={draft.purchase_price} onChange={set("purchase_price")} />
              </Cell>
            </FieldGrid>
          </Panel>
          {!service && (
            <Panel title="Stock">
              <FieldGrid half>
                <Cell>
                  <TextField isReadOnly={readOnly} label={`Opening quantity${unitLabel}`} name="opening_qty" inputMode="decimal" value={draft.opening_qty} onChange={set("opening_qty")} />
                </Cell>
                <Cell>
                  <TextField isReadOnly={readOnly} label="Opening value (₹)" name="opening_value" inputMode="decimal" value={draft.opening_value} onChange={set("opening_value")} />
                </Cell>
                <Cell>
                  <TextField isReadOnly={readOnly} label={`Reorder level${unitLabel}`} name="reorder_level" inputMode="decimal" description="Dashboard warns at this level. Blank: no warning." value={draft.reorder_level} onChange={set("reorder_level")} />
                </Cell>
              </FieldGrid>
            </Panel>
          )}
        </div>
      </Form>
    </div>
  );
}
