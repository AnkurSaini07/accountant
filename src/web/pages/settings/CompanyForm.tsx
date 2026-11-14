import { Button, Label } from "@primer/react";
import { TextField } from "../../components/TextField.tsx";
import { TextAreaField } from "../../components/TextAreaField.tsx";
import { Form } from "../../components/Form.tsx";
import { stack } from "../../components/formLayout.ts";
import { SelectField } from "../../components/SelectField.tsx";
import { ToastQueue } from "../../toast.ts";
import { useState } from "react";
import { parseGstin } from "../../../shared/gstin.ts";
import { STATES } from "../../../shared/states.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { formPage, twoUp } from "../../components/formLayout.ts";
import { EnterSubmits } from "../../components/EnterSubmits.tsx";
import { Panel } from "../../components/Panel.tsx";
import { Cell } from "../../components/Cell.tsx";
import { FieldGrid } from "../../components/FieldGrid.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { type Address, type BankAccount, type Company, error, note, section } from "./company.ts";
import { ImageField } from "./ImageField.tsx";
import c from "./CompanyForm.module.css";

const STATE_OPTIONS = STATES.filter((s) => !s.legacy).map((s) => [s.code, `${s.code} – ${s.name}`] as const);

const blankAddress = (primary: boolean): Address => ({ label: "", address: "", city: "", pincode: "", is_primary: primary });

const blankAccount = (isDefault: boolean): BankAccount => ({
  bank_name: "",
  account_name: "",
  account_number: "",
  ifsc: "",
  branch: "",
  is_default: isDefault,
});

/** State from a valid GSTIN, else null (the user picks it). */
function gstinState(gstin: string | null) {
  try {
    return gstin ? parseGstin(gstin).state : null;
  } catch {
    return null;
  }
}

export function CompanyForm({ company, onSaved }: { company: Company; onSaved: (c: Company) => void }) {
  const readOnly = useUser().role !== "admin";
  const [draft, setDraft] = useState(company);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Company>(key: K) => (value: Company[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setAddress = (i: number, patch: Partial<Address>) =>
    setDraft((d) => ({ ...d, addresses: d.addresses.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const setAccount = (i: number, patch: Partial<BankAccount>) =>
    setDraft((d) => ({ ...d, bank_accounts: d.bank_accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const makePrimary = (i: number) => setDraft((d) => ({ ...d, addresses: d.addresses.map((a, j) => ({ ...a, is_primary: j === i })) }));
  const makeDefault = (i: number) =>
    setDraft((d) => ({ ...d, bank_accounts: d.bank_accounts.map((a, j) => ({ ...a, is_default: j === i })) }));
  const removeAt = <T extends { is_primary?: boolean; is_default?: boolean }>(rows: T[], i: number, flag: "is_primary" | "is_default") => {
    const rest = rows.filter((_, j) => j !== i);
    // Removing the primary/default row hands the flag to the first remaining one.
    if (rows[i]?.[flag] && rest[0]) rest[0] = { ...rest[0], [flag]: true };
    return rest;
  };

  const derived = gstinState(draft.gstin);

  async function save() {
    setSaving(true);
    try {
      const { id: _id, ...body } = draft;
      const saved = await call(client.api.company.$put({ json: body }));
      setErrors({});
      ToastQueue.positive("Company details saved.", { timeout: 5000 });
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  const listError = (key: string) => errors[key]?.map((m) => <p key={m} className={error}>{m}</p>);

  return (
    <div className={formPage}>
      <PageHeader
        title="Company"
        actions={
          !readOnly && (
            <Button type="submit" form="company-form" variant="primary" size="small" loading={saving}>
              Save
            </Button>
          )
        }
      />
      {readOnly && <p className={note}>Only an admin can change these details.</p>}
      <Form id="company-form" errors={errors} className={stack} onSubmit={() => void save()}>
        <EnterSubmits />
        <Panel title="Business">
          <FieldGrid>
            <Cell wide>
              <TextField isReadOnly={readOnly} label="Legal name" name="legal_name" isRequired value={draft.legal_name} onChange={set("legal_name")} />
            </Cell>
            <Cell wide>
              <TextField isReadOnly={readOnly} label="Trade name" name="trade_name" description="Shown in the header instead of the legal name, if set." value={draft.trade_name ?? ""} onChange={set("trade_name")} />
            </Cell>
            <Cell wide>
              <TextField
                isReadOnly={readOnly}
                label="GSTIN"
                name="gstin"
                description={derived ? `${derived.name} (${derived.code}). State and PAN come from the GSTIN.` : "State and PAN are filled in from it."}
                value={draft.gstin ?? ""}
                onChange={set("gstin")}
               
              />
            </Cell>
            <Cell wide>
              <SelectField label="State" name="state_code" isReadOnly={readOnly || !!derived} value={derived?.code ?? draft.state_code} onChange={(k) => k && set("state_code")(k)} options={STATE_OPTIONS} />
            </Cell>
            {!derived && (
              <Cell>
                <TextField isReadOnly={readOnly} label="PAN" name="pan" value={draft.pan ?? ""} onChange={set("pan")} />
              </Cell>
            )}
            <Cell>
              <TextField isReadOnly={readOnly} label="Phone" name="phone" type="tel" value={draft.phone ?? ""} onChange={set("phone")} />
            </Cell>
            <Cell wide>
              <TextField isReadOnly={readOnly} label="Email" name="email" type="email" value={draft.email ?? ""} onChange={set("email")} />
            </Cell>
          </FieldGrid>
        </Panel>

        <Panel
          title="Addresses"
          note="The primary address is printed on the letterhead."
          action={
            !readOnly && (
              <Button size="small" onClick={() => setDraft((d) => ({ ...d, addresses: [...d.addresses, blankAddress(d.addresses.length === 0)] }))}>
                Add address
              </Button>
            )
          }>
          {listError("addresses")}
          <div className={c.cards}>
            {draft.addresses.map((a, i) => (
              <section key={a.id ?? `new-${i}`} className={c.card} aria-label={`Address ${i + 1}`}>
                <div className={c.row}>
                  {a.is_primary ? <Label variant="success">Primary</Label> : !readOnly && <Button size="small" onClick={() => makePrimary(i)}>Set as primary</Button>}
                  {!readOnly && draft.addresses.length > 1 && (
                    <Button size="small" variant="invisible" onClick={() => setDraft((d) => ({ ...d, addresses: removeAt(d.addresses, i, "is_primary") }))}>
                      Remove address
                    </Button>
                  )}
                </div>
                <FieldGrid half>
                  <Cell full>
                    <TextField isReadOnly={readOnly} label="Name" name={`addresses.${i}.label`} description="e.g. Registered office, Factory, Godown" isRequired value={a.label} onChange={(v) => setAddress(i, { label: v })} />
                  </Cell>
                  <Cell full>
                    <TextAreaField isReadOnly={readOnly} label="Address" name={`addresses.${i}.address`} value={a.address} onChange={(v) => setAddress(i, { address: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="City" name={`addresses.${i}.city`} value={a.city} onChange={(v) => setAddress(i, { city: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="PIN code" name={`addresses.${i}.pincode`} inputMode="numeric" value={a.pincode ?? ""} onChange={(v) => setAddress(i, { pincode: v })} />
                  </Cell>
                </FieldGrid>
              </section>
            ))}
          </div>
        </Panel>

        <Panel
          title="Bank accounts"
          note="The default account is printed on invoices."
          action={
            !readOnly && (
              <Button size="small" onClick={() => setDraft((d) => ({ ...d, bank_accounts: [...d.bank_accounts, blankAccount(d.bank_accounts.length === 0)] }))}>
                Add bank account
              </Button>
            )
          }>
          {listError("bank_accounts")}
          {draft.bank_accounts.length === 0 && <p className={note}>No bank accounts yet.</p>}
          <div className={c.cards}>
            {draft.bank_accounts.map((b, i) => (
              <section key={b.id ?? `new-${i}`} className={c.card} aria-label={`Bank account ${i + 1}`}>
                <div className={c.row}>
                  {b.is_default ? <Label variant="success">Default</Label> : !readOnly && <Button size="small" onClick={() => makeDefault(i)}>Set as default</Button>}
                  {!readOnly && (
                    <Button size="small" variant="invisible" onClick={() => setDraft((d) => ({ ...d, bank_accounts: removeAt(d.bank_accounts, i, "is_default") }))}>
                      Remove account
                    </Button>
                  )}
                </div>
                <FieldGrid half>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="Bank" name={`bank_accounts.${i}.bank_name`} isRequired value={b.bank_name} onChange={(v) => setAccount(i, { bank_name: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="Account holder" name={`bank_accounts.${i}.account_name`} description="If not the legal name" value={b.account_name ?? ""} onChange={(v) => setAccount(i, { account_name: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="Account number" name={`bank_accounts.${i}.account_number`} isRequired value={b.account_number} onChange={(v) => setAccount(i, { account_number: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="IFSC" name={`bank_accounts.${i}.ifsc`} isRequired value={b.ifsc} onChange={(v) => setAccount(i, { ifsc: v })} />
                  </Cell>
                  <Cell>
                    <TextField isReadOnly={readOnly} label="Branch" name={`bank_accounts.${i}.branch`} value={b.branch ?? ""} onChange={(v) => setAccount(i, { branch: v })} />
                  </Cell>
                </FieldGrid>
              </section>
            ))}
          </div>
        </Panel>

        <div className={twoUp}>
          <Panel title="Logo and signature">
            <ImageField label="Logo" value={draft.logo} onChange={set("logo")} readOnly={readOnly} />
            <ImageField label="Signature" value={draft.signature} onChange={set("signature")} readOnly={readOnly} />
            {listError("logo")}
            {listError("signature")}
          </Panel>
          <Panel title="Terms & conditions" note="Printed on documents by default.">
            <TextAreaField isReadOnly={readOnly} label="Terms & conditions" hideLabel name="terms" value={draft.terms} onChange={set("terms")} />
          </Panel>
        </div>
      </Form>
    </div>
  );
}
