// Masters → Items → New / edit (FR-3.2). Prices are typed in rupees and sent in paise; quantities
// are typed in the item's unit (1.250 KGS) and sent in its smallest step (1250). Services have no
// stock fields. Admins and accountants edit; everyone else sees it read-only.
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { Form } from "@react-spectrum/s2/Form";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextArea } from "@react-spectrum/s2/TextArea";
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { formatRupees, parseRupees } from "../../../shared/money.ts";
import { formatQty, parseQty } from "../../../shared/quantity.ts";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../../shared/schemas/item.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";

type Item = InferResponseType<(typeof client.api.items)[":id"]["$get"], 200>;
type Unit = InferResponseType<typeof client.api.units.$get, 200>[number];
type GstRate = InferResponseType<(typeof client.api)["gst-rates"]["$get"], 200>[number];
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
const page = style({ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 });
const head = style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const sectionTitle = style({ font: "heading", margin: 0 });
const stack = style({ display: "flex", flexDirection: "column", gap: 16 });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const actions = style({ display: "flex", gap: 12, flexWrap: "wrap" });

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

/** /masters/items/new and /masters/items/:id */
export function ItemForm() {
  const { id } = useParams();
  const [lists, setLists] = useState<{ units: Unit[]; rates: GstRate[] } | null>(null);
  const [item, setItem] = useState<Item | null | "missing">(null);
  useEffect(() => {
    Promise.all([call(client.api.units.$get()), call(client.api["gst-rates"].$get())]).then(([units, rates]) => setLists({ units, rates }), () => {});
  }, []);
  useEffect(() => {
    if (!id) return;
    setItem(null);
    call(client.api.items[":id"].$get({ param: { id } })).then(setItem, () => setItem("missing")); // failures toast
  }, [id]);

  if (item === "missing") return <p className={note}>This item couldn't be loaded. Go back to the item list and try again.</p>;
  if (!lists || (id && !item)) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  const loaded = id ? (item as Item) : null;
  // key: after a save or (de)activation the form starts again from what the server returned.
  return <ItemEditor key={JSON.stringify(loaded)} item={loaded} units={lists.units} rates={lists.rates} onSaved={setItem} />;
}

function ItemEditor({ item, units, rates, onSaved }: { item: Item | null; units: Unit[]; rates: GstRate[]; onSaved: (i: Item) => void }) {
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
    <div className={page}>
      <div className={head}>
        <h1 className={title}>{item ? item.name : "New item"}</h1>
        {item && !item.active && <Badge variant="neutral">Inactive</Badge>}
      </div>
      {readOnly && <p className={note}>You can view items; ask an accountant or admin to change them.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={stack}>
          <TextField isReadOnly={readOnly} isRequired label="Code" name="code" description="Your own code, e.g. FG-101." value={draft.code} onChange={set("code")} autoFocus={!item && !readOnly} />
          <TextField isReadOnly={readOnly} isRequired label="Name" name="name" value={draft.name} onChange={set("name")} />
          <TextArea isReadOnly={readOnly} label="Description" name="description" description="Printed under the name on documents." value={draft.description} onChange={set("description")} />
          <Picker isDisabled={readOnly} label="Type" name="type" selectedKey={draft.type} onSelectionChange={(k) => k != null && set("type")(k as ItemType)}>
            {ITEM_TYPES.map((t) => (
              <PickerItem key={t} id={t}>
                {ITEM_TYPE_LABELS[t]}
              </PickerItem>
            ))}
          </Picker>
          <TextField isReadOnly={readOnly} label={service ? "SAC" : "HSN"} name="hsn" inputMode="numeric" description="4, 6 or 8 digits." value={draft.hsn} onChange={set("hsn")} />
          <Picker isDisabled={readOnly} isRequired label="Unit" name="unit_id" selectedKey={draft.unit_id} onSelectionChange={(k) => k != null && set("unit_id")(Number(k))}>
            {unitChoices.map((u) => (
              <PickerItem key={u.id} id={u.id}>
                {`${u.code} – ${u.name}`}
              </PickerItem>
            ))}
          </Picker>
          <Picker isDisabled={readOnly} isRequired label="GST rate" name="gst_rate_id" selectedKey={draft.gst_rate_id} onSelectionChange={(k) => k != null && set("gst_rate_id")(Number(k))}>
            {rateChoices(rates, draft.gst_rate_id).map((r) => (
              <PickerItem key={r.id} id={r.id}>
                {`${r.rate}%`}
              </PickerItem>
            ))}
          </Picker>
        </div>

        <div className={stack}>
          <h2 className={sectionTitle}>Prices</h2>
          <TextField isReadOnly={readOnly} label={`Sale price (₹)${unit ? ` per ${unit.code}` : ""}`} name="sale_price" inputMode="decimal" value={draft.sale_price} onChange={set("sale_price")} />
          <TextField isReadOnly={readOnly} label={`Purchase price (₹)${unit ? ` per ${unit.code}` : ""}`} name="purchase_price" inputMode="decimal" value={draft.purchase_price} onChange={set("purchase_price")} />
        </div>

        {!service && (
          <div className={stack}>
            <h2 className={sectionTitle}>Stock</h2>
            <TextField isReadOnly={readOnly} label={`Opening quantity${unitLabel}`} name="opening_qty" inputMode="decimal" value={draft.opening_qty} onChange={set("opening_qty")} />
            <TextField isReadOnly={readOnly} label="Opening value (₹)" name="opening_value" inputMode="decimal" value={draft.opening_value} onChange={set("opening_value")} />
            <TextField isReadOnly={readOnly} label={`Reorder level${unitLabel}`} name="reorder_level" inputMode="decimal" description="Warns on the dashboard when stock falls to this. Leave blank for no warning." value={draft.reorder_level} onChange={set("reorder_level")} />
          </div>
        )}

        <div className={actions}>
          {!readOnly && (
            <Button type="submit" variant="accent" isPending={busy}>
              Save
            </Button>
          )}
          <LinkButton href={LIST} variant="secondary">
            {readOnly ? "Back to items" : "Cancel"}
          </LinkButton>
          {item && !readOnly && (
            <Button variant="secondary" isDisabled={busy} onPress={() => void setActive(!item.active)}>
              {item.active ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>
      </Form>
    </div>
  );
}
