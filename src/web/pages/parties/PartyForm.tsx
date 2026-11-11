// Masters → Parties → New / edit (FR-3.1). A valid GSTIN fills in state and PAN (the server derives
// them too). One billing address, any number of shipping addresses. Viewers see it read-only.
// Money is typed in rupees and sent in paise; the opening balance is an amount plus Dr/Cr.
import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { Form } from "@react-spectrum/s2/Form";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { NumberField } from "@react-spectrum/s2/NumberField";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import type { InferResponseType } from "hono/client";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { parseGstin } from "../../../shared/gstin.ts";
import { formatRupees, parseRupees } from "../../../shared/money.ts";
import { PARTY_KINDS, REGISTRATION_LABELS, REGISTRATION_TYPES } from "../../../shared/schemas/party.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { companyAtom } from "../../state.ts";
import { AddressFields, type AddressDraft, blankAddress, isBlank, PICKABLE_STATES } from "./AddressFields.tsx";

type Party = InferResponseType<(typeof client.api.parties)[":id"]["$get"], 200>;
type Kind = (typeof PARTY_KINDS)[number];
type Registration = (typeof REGISTRATION_TYPES)[number];
type Draft = {
  name: string;
  kind: Kind;
  registration_type: Registration;
  gstin: string;
  state_code: string;
  pan: string;
  contact_person: string;
  phone: string;
  email: string;
  credit_days: number;
  credit_limit: string; // rupees, "" = no limit
  opening: string; // rupees
  opening_side: "dr" | "cr";
  billing: AddressDraft;
  shipping: AddressDraft[];
};

const KIND_LABELS: Record<Kind, string> = { customer: "Customer", supplier: "Supplier", both: "Customer and supplier" };
const LIST = "/masters/parties";

const stack = style({ display: "flex", flexDirection: "column", gap: 16 });
const page = style({ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 });
const head = style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const sectionTitle = style({ font: "heading", margin: 0 });
const section = style({ display: "flex", flexDirection: "column", gap: 16 });
const card = style({ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderWidth: 1, borderStyle: "solid", borderColor: "gray-200", borderRadius: "lg" });
const cardHead = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const error = style({ font: "body-sm", color: "negative", margin: 0 });
const actions = style({ display: "flex", gap: 12, flexWrap: "wrap" });

const needsGstin = (r: Registration) => r === "regular" || r === "composition";
function parsed(gstin: string) {
  try {
    return gstin.trim() ? parseGstin(gstin) : null;
  } catch {
    return null;
  }
}
const rupees = (paise: number | null) => (paise ? formatRupees(Math.abs(paise)).replaceAll(",", "") : "");

function toDraft(p: Party | null, homeState: string): Draft {
  if (!p) {
    return {
      name: "", kind: "customer", registration_type: "regular", gstin: "", state_code: homeState, pan: "", contact_person: "", phone: "", email: "",
      credit_days: 0, credit_limit: "", opening: "", opening_side: "dr", billing: blankAddress("billing", homeState), shipping: [],
    };
  }
  const address = (a: Party["addresses"][number]): AddressDraft => ({ kind: a.kind as AddressDraft["kind"], label: a.label ?? "", address: a.address, city: a.city, pincode: a.pincode ?? "", state_code: a.state_code });
  const billing = p.addresses.find((a) => a.kind === "billing");
  return {
    name: p.name, kind: p.kind as Kind, registration_type: p.registration_type as Registration, gstin: p.gstin ?? "", state_code: p.state_code, pan: p.pan ?? "",
    contact_person: p.contact_person ?? "", phone: p.phone ?? "", email: p.email ?? "", credit_days: p.credit_days,
    credit_limit: rupees(p.credit_limit), opening: rupees(p.opening_balance), opening_side: p.opening_balance < 0 ? "cr" : "dr",
    billing: billing ? address(billing) : blankAddress("billing", p.state_code),
    shipping: p.addresses.filter((a) => a.kind === "shipping").map(address),
  };
}

/** The body the API takes, or the fields we can't convert (amounts that aren't amounts). */
function toBody(d: Draft) {
  const errors: Record<string, string[]> = {};
  const amount = (key: string, text: string) => {
    if (!text.trim()) return null;
    try {
      return parseRupees(text);
    } catch {
      errors[key] = ["Enter an amount like 25000 or 25,000.50."];
      return null;
    }
  };
  const credit_limit = amount("credit_limit", d.credit_limit);
  const opening = amount("opening_balance", d.opening) ?? 0;
  const registered = needsGstin(d.registration_type);
  const addresses = [...(isBlank(d.billing) ? [] : [d.billing]), ...d.shipping];
  return {
    errors,
    body: {
      name: d.name,
      kind: d.kind,
      registration_type: d.registration_type,
      gstin: registered ? d.gstin : null,
      pan: registered ? null : d.pan, // with a GSTIN the server takes PAN from it
      state_code: d.state_code,
      contact_person: d.contact_person,
      phone: d.phone,
      email: d.email,
      credit_days: d.credit_days,
      credit_limit,
      opening_balance: d.opening_side === "cr" ? -Math.abs(opening) : Math.abs(opening),
      addresses: addresses.map(({ label, ...a }) => ({ ...a, label: a.kind === "shipping" ? label : null })),
    },
  };
}

/** /masters/parties/new and /masters/parties/:id */
export function PartyForm() {
  const { id } = useParams();
  const [party, setParty] = useState<Party | null | "missing">(null);
  useEffect(() => {
    if (!id) return;
    setParty(null);
    call(client.api.parties[":id"].$get({ param: { id } })).then(setParty, () => setParty("missing")); // failures toast
  }, [id]);
  const homeState = useAtomValue(companyAtom)?.state_code ?? "06";

  if (!id) return <PartyEditor party={null} homeState={homeState} onSaved={setParty} />;
  if (party === "missing") return <p className={note}>This party couldn't be loaded. Go back to the party list and try again.</p>;
  if (!party) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  // key: after a save or (de)activation the form starts again from what the server returned.
  return <PartyEditor key={JSON.stringify(party)} party={party} homeState={homeState} onSaved={setParty} />;
}

function PartyEditor({ party, homeState, onSaved }: { party: Party | null; homeState: string; onSaved: (p: Party) => void }) {
  const readOnly = useUser().role === "viewer";
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => toDraft(party, homeState));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setShipping = (i: number, a: AddressDraft) => setDraft((d) => ({ ...d, shipping: d.shipping.map((s, j) => (j === i ? a : s)) }));

  const registered = needsGstin(draft.registration_type);
  const fromGstin = registered ? parsed(draft.gstin) : null;
  const billingSent = !isBlank(draft.billing);
  const shippingName = (i: number) => `addresses.${i + (billingSent ? 1 : 0)}`;

  async function run(action: () => Promise<Party>, message: string) {
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
    const { body, errors: local } = toBody(draft);
    if (Object.keys(local).length) return setErrors(local);
    const saved = await run(
      () => call(party ? client.api.parties[":id"].$put({ param: { id: String(party.id) }, json: body }) : client.api.parties.$post({ json: body })),
      `${draft.name.trim()} saved.`,
    );
    if (saved) navigate(LIST);
  }

  async function setActive(active: boolean) {
    if (!party) return;
    const param = { param: { id: String(party.id) } };
    const saved = await run(
      () => call(active ? client.api.parties[":id"].reactivate.$post(param) : client.api.parties[":id"].deactivate.$post(param)),
      active ? `${party.name} is active again.` : `${party.name} deactivated. Old documents keep it; new ones can't pick it.`,
    );
    if (saved) onSaved(saved);
  }

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>{party ? party.name : "New party"}</h1>
        {party && !party.active && <Badge variant="neutral">Inactive</Badge>}
      </div>
      {readOnly && <p className={note}>You can view parties; ask an accountant or admin to change them.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={stack}>
          <TextField isReadOnly={readOnly} isRequired label="Name" name="name" value={draft.name} onChange={set("name")} autoFocus={!party && !readOnly} />
          <Picker isDisabled={readOnly} label="Type" name="kind" selectedKey={draft.kind} onSelectionChange={(k) => k != null && set("kind")(k as Kind)}>
            {PARTY_KINDS.map((k) => (
              <PickerItem key={k} id={k}>
                {KIND_LABELS[k]}
              </PickerItem>
            ))}
          </Picker>
          <Picker isDisabled={readOnly} label="GST registration" name="registration_type" selectedKey={draft.registration_type} onSelectionChange={(k) => k != null && set("registration_type")(k as Registration)}>
            {REGISTRATION_TYPES.map((r) => (
              <PickerItem key={r} id={r}>
                {REGISTRATION_LABELS[r]}
              </PickerItem>
            ))}
          </Picker>
          {registered && (
            <TextField
                    isReadOnly={readOnly}
              isRequired
              label="GSTIN"
              name="gstin"
              description={fromGstin ? `${fromGstin.state.name}. State and PAN come from the GSTIN.` : "State and PAN are filled in from it."}
              value={draft.gstin}
              onChange={set("gstin")}
            />
          )}
          <Picker
            isDisabled={readOnly || !!fromGstin}
            label="State"
            name="state_code"
            selectedKey={fromGstin?.state.code ?? draft.state_code}
            onSelectionChange={(k) => k != null && set("state_code")(String(k))}>
            {PICKABLE_STATES.map((s) => (
              <PickerItem key={s.code} id={s.code}>
                {`${s.code} – ${s.name}`}
              </PickerItem>
            ))}
          </Picker>
          <TextField isReadOnly={readOnly || registered} label="PAN" name="pan" value={registered ? (fromGstin?.pan ?? "") : draft.pan} onChange={set("pan")} />
        </div>

        <div className={section}>
          <h2 className={sectionTitle}>Contact</h2>
          <div className={stack}>
            <TextField isReadOnly={readOnly} label="Contact person" name="contact_person" value={draft.contact_person} onChange={set("contact_person")} />
            <TextField isReadOnly={readOnly} label="Phone" name="phone" type="tel" value={draft.phone} onChange={set("phone")} />
            <TextField isReadOnly={readOnly} label="Email" name="email" type="email" value={draft.email} onChange={set("email")} />
          </div>
        </div>

        <div className={section}>
          <h2 className={sectionTitle}>Credit and opening balance</h2>
          <div className={stack}>
            <NumberField isReadOnly={readOnly} label="Credit days" name="credit_days" minValue={0} maxValue={365} value={draft.credit_days} onChange={(v) => set("credit_days")(Number.isNaN(v) ? 0 : v)} />
            <TextField isReadOnly={readOnly} label="Credit limit (₹)" name="credit_limit" inputMode="decimal" description="Leave blank for no limit." value={draft.credit_limit} onChange={set("credit_limit")} />
            <TextField isReadOnly={readOnly} label="Opening balance (₹)" name="opening_balance" inputMode="decimal" value={draft.opening} onChange={set("opening")} />
            <Picker isDisabled={readOnly} label="Balance is" name="opening_side" selectedKey={draft.opening_side} onSelectionChange={(k) => k != null && set("opening_side")(k as "dr" | "cr")}>
              <PickerItem id="dr">Dr: they owe us</PickerItem>
              <PickerItem id="cr">Cr: we owe them</PickerItem>
            </Picker>
          </div>
        </div>

        <div className={section}>
          <h2 className={sectionTitle}>Addresses</h2>
          {errors.addresses?.map((m) => (
            <p key={m} className={error}>
              {m}
            </p>
          ))}
          <section className={card} aria-label="Billing address">
            <h3 className={sectionTitle}>Billing address</h3>
            <p className={note}>Printed on invoices.</p>
            {/* Unsent while blank: then "addresses.0" is the first shipping address, and errors must land there. */}
            <AddressFields value={draft.billing} onChange={set("billing")} name={billingSent ? "addresses.0" : "billing"} readOnly={readOnly} />
          </section>
          {draft.shipping.map((a, i) => (
            <section key={i} className={card} aria-label={`Shipping address ${i + 1}`}>
              <div className={cardHead}>
                <h3 className={sectionTitle}>Shipping address {i + 1}</h3>
                {!readOnly && (
                  <ActionButton size="S" onPress={() => setDraft((d) => ({ ...d, shipping: d.shipping.filter((_, j) => j !== i) }))}>
                    Remove
                  </ActionButton>
                )}
              </div>
              <AddressFields value={a} onChange={(v) => setShipping(i, v)} name={shippingName(i)} readOnly={readOnly} />
            </section>
          ))}
          {!readOnly && (
            <div>
              <ActionButton onPress={() => setDraft((d) => ({ ...d, shipping: [...d.shipping, blankAddress("shipping", fromGstin?.state.code ?? d.state_code)] }))}>
                Add shipping address
              </ActionButton>
            </div>
          )}
        </div>

        <div className={actions}>
          {!readOnly && (
            <Button type="submit" variant="accent" isPending={busy}>
              Save
            </Button>
          )}
          <LinkButton href={LIST} variant="secondary">
            {readOnly ? "Back to parties" : "Cancel"}
          </LinkButton>
          {party && !readOnly && (
            <Button variant="secondary" isDisabled={busy} onPress={() => void setActive(!party.active)}>
              {party.active ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>
      </Form>
    </div>
  );
}
