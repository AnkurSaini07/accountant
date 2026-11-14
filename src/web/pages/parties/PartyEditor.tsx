import { PlusIcon } from "@primer/octicons-react";
import { Button, Label } from "@primer/react";
import { TextField } from "../../components/TextField.tsx";
import { Form } from "../../components/Form.tsx";
import { NumberField } from "../../components/NumberField.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { ToastQueue } from "../../toast.ts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { parseGstin } from "../../../shared/gstin.ts";
import { formatRupees, parseRupees } from "../../../shared/money.ts";
import { PARTY_KINDS, REGISTRATION_LABELS, REGISTRATION_TYPES } from "../../../shared/schemas/party.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { errorText, formPage, stack, twoUp } from "../../components/formLayout.ts";
import { EnterSubmits } from "../../components/EnterSubmits.tsx";
import { Panel } from "../../components/Panel.tsx";
import { Cell } from "../../components/Cell.tsx";
import { FieldGrid } from "../../components/FieldGrid.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { AddressFields, type AddressDraft, blankAddress, isBlank, STATE_OPTIONS } from "./AddressFields.tsx";
import { type Party, note } from "./party.ts";

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

export function PartyEditor({ party, homeState, onSaved }: { party: Party | null; homeState: string; onSaved: (p: Party) => void }) {
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
    <div className={formPage}>
      <PageHeader
        back={{ href: LIST, label: "Back to parties" }}
        eyebrow={party ? "Party" : "New"}
        title={party ? party.name : "party"}
        badge={party && !party.active && <Label variant="default">Inactive</Label>}
        actions={
          !readOnly && (
            <>
              {party && (
                <Button variant="default" size="small" disabled={busy} onClick={() => void setActive(!party.active)}>
                  {party.active ? "Deactivate" : "Reactivate"}
                </Button>
              )}
              <Button type="submit" form="party-form" variant="primary" size="small" loading={busy}>
                Save
              </Button>
            </>
          )
        }
      />
      {readOnly && <p className={note}>You can view parties; ask an accountant or admin to change them.</p>}
      <Form id="party-form" errors={errors} className={stack} onSubmit={() => void save()}>
        <EnterSubmits />
        <Panel title="Party">
          <FieldGrid>
            <Cell wide>
              <TextField isReadOnly={readOnly} isRequired label="Name" name="name" value={draft.name} onChange={set("name")} autoFocus={!party && !readOnly} />
            </Cell>
            <Cell>
              <SelectField isReadOnly={readOnly} label="Type" name="kind" value={draft.kind} onChange={(k) => k && set("kind")(k as Kind)} options={KIND_LABELS} />
            </Cell>
            <Cell>
              <SelectField isReadOnly={readOnly} label="GST registration" name="registration_type" value={draft.registration_type} onChange={(k) => k && set("registration_type")(k as Registration)} options={REGISTRATION_TYPES.map((r) => [r, REGISTRATION_LABELS[r]] as const)} />
            </Cell>
            {registered && (
              <Cell wide>
                <TextField
                  isReadOnly={readOnly}
                  isRequired
                  label="GSTIN"
                  name="gstin"
                  description={fromGstin ? `${fromGstin.state.name}. State and PAN come from the GSTIN.` : "State and PAN are filled in from it."}
                  value={draft.gstin}
                  onChange={set("gstin")}
                 
                />
              </Cell>
            )}
            <Cell wide>
              <SelectField isReadOnly={readOnly || !!fromGstin} label="State" name="state_code" value={fromGstin?.state.code ?? draft.state_code} onChange={(k) => k && set("state_code")(k)} options={STATE_OPTIONS} />
            </Cell>
            <Cell>
              <TextField isReadOnly={readOnly || registered} label="PAN" name="pan" value={registered ? (fromGstin?.pan ?? "") : draft.pan} onChange={set("pan")} />
            </Cell>
          </FieldGrid>
        </Panel>

        <div className={twoUp}>
          <Panel title="Contact">
            <FieldGrid half>
              <Cell>
                <TextField isReadOnly={readOnly} label="Contact person" name="contact_person" value={draft.contact_person} onChange={set("contact_person")} />
              </Cell>
              <Cell>
                <TextField isReadOnly={readOnly} label="Phone" name="phone" type="tel" value={draft.phone} onChange={set("phone")} />
              </Cell>
              <Cell>
                <TextField isReadOnly={readOnly} label="Email" name="email" type="email" value={draft.email} onChange={set("email")} />
              </Cell>
            </FieldGrid>
          </Panel>
          <Panel title="Credit and opening balance">
            <FieldGrid half>
              <Cell>
                <NumberField isReadOnly={readOnly} label="Credit days" name="credit_days" minValue={0} maxValue={365} value={draft.credit_days} onChange={set("credit_days")} />
              </Cell>
              <Cell>
                <TextField isReadOnly={readOnly} label="Credit limit (₹)" name="credit_limit" inputMode="decimal" description="Blank: no limit." value={draft.credit_limit} onChange={set("credit_limit")} />
              </Cell>
              <Cell>
                <TextField isReadOnly={readOnly} label="Opening balance (₹)" name="opening_balance" inputMode="decimal" value={draft.opening} onChange={set("opening")} />
              </Cell>
              <Cell>
                <SelectField isReadOnly={readOnly} label="Balance is" name="opening_side" value={draft.opening_side} onChange={(k) => k && set("opening_side")(k as "dr" | "cr")} options={[["dr", "Dr: they owe us"], ["cr", "Cr: we owe them"]]} />
              </Cell>
            </FieldGrid>
          </Panel>
        </div>

        <Panel
          title="Addresses"
          action={
            !readOnly && (
              <Button size="small" leadingVisual={PlusIcon} onClick={() => setDraft((d) => ({ ...d, shipping: [...d.shipping, blankAddress("shipping", fromGstin?.state.code ?? d.state_code)] }))}>
                Add shipping address
              </Button>
            )
          }>
          {errors.addresses?.map((m) => (
            <p key={m} className={errorText}>
              {m}
            </p>
          ))}
          <div className={twoUp}>
            <Panel nested title="Billing address" note="Printed on invoices.">
              {/* Unsent while blank: then "addresses.0" is the first shipping address, and errors must land there. */}
              <AddressFields value={draft.billing} onChange={set("billing")} name={billingSent ? "addresses.0" : "billing"} readOnly={readOnly} />
            </Panel>
            {draft.shipping.map((a, i) => (
              <Panel
                nested
                key={i}
                title={`Shipping address ${i + 1}`}
                action={
                  !readOnly && (
                    <Button size="small" variant="invisible" onClick={() => setDraft((d) => ({ ...d, shipping: d.shipping.filter((_, j) => j !== i) }))}>
                      Remove
                    </Button>
                  )
                }>
                <AddressFields value={a} onChange={(v) => setShipping(i, v)} name={shippingName(i)} readOnly={readOnly} />
              </Panel>
            ))}
          </div>
        </Panel>
      </Form>
    </div>
  );
}
