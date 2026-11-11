// Settings → Company (FR-1.1): the profile printed on every document. Admins edit; everyone else reads.
// <CompanyProvider> loads the company once for the whole app (the header shows its name).
import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { FileTrigger } from "@react-spectrum/s2/FileTrigger";
import { Form } from "@react-spectrum/s2/Form";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextArea } from "@react-spectrum/s2/TextArea";
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { parseGstin } from "../../../shared/gstin.ts";
import { STATES } from "../../../shared/states.ts";
import { ApiError, api } from "../../api.ts";
import { useUser } from "../../auth.tsx";

export type Address = { id?: number; label: string; address: string; city: string; pincode: string | null; is_primary: boolean };
export type BankAccount = {
  id?: number;
  bank_name: string;
  account_name: string | null;
  account_number: string;
  ifsc: string;
  branch: string | null;
  is_default: boolean;
};
export type Company = {
  id: number;
  legal_name: string;
  trade_name: string | null;
  state_code: string;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  signature: string | null;
  terms: string;
  addresses: Address[];
  bank_accounts: BankAccount[];
};

type CompanyContextValue = { company: Company | null; setCompany: (c: Company) => void };
const CompanyContext = createContext<CompanyContextValue>({ company: null, setCompany: () => {} });

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    api.get<Company>("/company").then(setCompany, () => {}); // failures toast
  }, []);
  return <CompanyContext.Provider value={{ company, setCompany }}>{children}</CompanyContext.Provider>;
}
export const useCompany = () => useContext(CompanyContext);

/** Name for the header: trade name if set, else the legal name. */
export const displayName = (c: Company | null) => c?.trade_name || c?.legal_name || "";

const MAX_IMAGE_BYTES = 290_000; // the API takes ≈ 300 KB as a data URL
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PICKABLE_STATES = STATES.filter((s) => !s.legacy);

const page = style({ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 });
const title = style({ font: "heading-xl", margin: 0 });
const sectionTitle = style({ font: "heading", margin: 0 });
const section = style({ display: "flex", flexDirection: "column", gap: 16 });
const card = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "gray-200",
  borderRadius: "lg",
});
const row = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const error = style({ font: "body-sm", color: "negative", margin: 0 });
const imageBox = style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" });
const preview = style({ height: 64, maxWidth: 200, objectFit: "contain" });

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

/** The file as a data: URL. Chunked, so a few hundred KB doesn't overflow String.fromCharCode's arguments. */
async function readImage(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${file.type};base64,${btoa(binary)}`;
}

function ImageField({ label, value, onChange, readOnly }: { label: string; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  const [problem, setProblem] = useState<string | null>(null);
  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setProblem("Use a PNG, JPEG or WebP image.");
    if (file.size > MAX_IMAGE_BYTES) return setProblem("That image is over 300 KB. Use a smaller one.");
    setProblem(null);
    onChange(await readImage(file));
  }
  return (
    <div className={section}>
      <p className={sectionTitle}>{label}</p>
      <div className={imageBox}>
        {value ? <img src={value} alt={label} className={preview} /> : <p className={note}>None</p>}
        {!readOnly && (
          <>
            <FileTrigger acceptedFileTypes={IMAGE_TYPES} onSelect={pick}>
              <ActionButton>{value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}</ActionButton>
            </FileTrigger>
            {value && <ActionButton onPress={() => onChange(null)}>Remove {label.toLowerCase()}</ActionButton>}
          </>
        )}
      </div>
      {problem && <p className={error}>{problem}</p>}
    </div>
  );
}

export function CompanySettings() {
  const { company, setCompany } = useCompany();
  if (!company) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  // key: a save replaces the company (new ids), so the form starts from the saved data again.
  return <CompanyForm key={JSON.stringify(company)} company={company} onSaved={setCompany} />;
}

function CompanyForm({ company, onSaved }: { company: Company; onSaved: (c: Company) => void }) {
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
      const saved = await api.put<Company>("/company", body);
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
    <div className={page}>
      <h1 className={title}>Company</h1>
      {readOnly && <p className={note}>Only an admin can change these details.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={section}>
          <TextField isReadOnly={readOnly} label="Legal name" name="legal_name" isRequired value={draft.legal_name} onChange={set("legal_name")} />
          <TextField isReadOnly={readOnly} label="Trade name" name="trade_name" description="Shown in the header instead of the legal name, if set." value={draft.trade_name ?? ""} onChange={set("trade_name")} />
          <TextField
            label="GSTIN"
            name="gstin"
            description={derived ? `${derived.name} (${derived.code}). State and PAN come from the GSTIN.` : "State and PAN are filled in from it."}
            value={draft.gstin ?? ""}
            onChange={set("gstin")}
          />
          <Picker
            label="State"
            name="state_code"
            isDisabled={readOnly || !!derived}
            selectedKey={derived?.code ?? draft.state_code}
            onSelectionChange={(key) => key != null && set("state_code")(String(key))}>
            {PICKABLE_STATES.map((s) => (
              <PickerItem key={s.code} id={s.code}>
                {`${s.code} – ${s.name}`}
              </PickerItem>
            ))}
          </Picker>
          {!derived && <TextField isReadOnly={readOnly} label="PAN" name="pan" value={draft.pan ?? ""} onChange={set("pan")} />}
          <TextField isReadOnly={readOnly} label="Phone" name="phone" type="tel" value={draft.phone ?? ""} onChange={set("phone")} />
          <TextField isReadOnly={readOnly} label="Email" name="email" type="email" value={draft.email ?? ""} onChange={set("email")} />
        </div>

        <div className={section}>
          <h2 className={sectionTitle}>Addresses</h2>
          <p className={note}>The primary address is printed on the letterhead.</p>
          {listError("addresses")}
          {draft.addresses.map((a, i) => (
            <section key={a.id ?? `new-${i}`} className={card} aria-label={`Address ${i + 1}`}>
              <div className={row}>
                {a.is_primary ? <Badge variant="positive">Primary</Badge> : !readOnly && <ActionButton size="S" onPress={() => makePrimary(i)}>Set as primary</ActionButton>}
                {!readOnly && draft.addresses.length > 1 && (
                  <ActionButton size="S" onPress={() => setDraft((d) => ({ ...d, addresses: removeAt(d.addresses, i, "is_primary") }))}>
                    Remove address
                  </ActionButton>
                )}
              </div>
              <TextField isReadOnly={readOnly} label="Name" name={`addresses.${i}.label`} description="e.g. Registered office, Factory, Godown" isRequired value={a.label} onChange={(v) => setAddress(i, { label: v })} />
              <TextArea isReadOnly={readOnly} label="Address" name={`addresses.${i}.address`} value={a.address} onChange={(v) => setAddress(i, { address: v })} />
              <TextField isReadOnly={readOnly} label="City" name={`addresses.${i}.city`} value={a.city} onChange={(v) => setAddress(i, { city: v })} />
              <TextField isReadOnly={readOnly} label="PIN code" name={`addresses.${i}.pincode`} inputMode="numeric" value={a.pincode ?? ""} onChange={(v) => setAddress(i, { pincode: v })} />
            </section>
          ))}
          {!readOnly && (
            <ActionButton onPress={() => setDraft((d) => ({ ...d, addresses: [...d.addresses, blankAddress(d.addresses.length === 0)] }))}>
              Add address
            </ActionButton>
          )}
        </div>

        <div className={section}>
          <h2 className={sectionTitle}>Bank accounts</h2>
          <p className={note}>The default account is printed on invoices.</p>
          {listError("bank_accounts")}
          {draft.bank_accounts.length === 0 && <p className={note}>No bank accounts yet.</p>}
          {draft.bank_accounts.map((b, i) => (
            <section key={b.id ?? `new-${i}`} className={card} aria-label={`Bank account ${i + 1}`}>
              <div className={row}>
                {b.is_default ? <Badge variant="positive">Default</Badge> : !readOnly && <ActionButton size="S" onPress={() => makeDefault(i)}>Set as default</ActionButton>}
                {!readOnly && (
                  <ActionButton size="S" onPress={() => setDraft((d) => ({ ...d, bank_accounts: removeAt(d.bank_accounts, i, "is_default") }))}>
                    Remove account
                  </ActionButton>
                )}
              </div>
              <TextField isReadOnly={readOnly} label="Bank" name={`bank_accounts.${i}.bank_name`} isRequired value={b.bank_name} onChange={(v) => setAccount(i, { bank_name: v })} />
              <TextField isReadOnly={readOnly} label="Account holder" name={`bank_accounts.${i}.account_name`} description="If different from the legal name" value={b.account_name ?? ""} onChange={(v) => setAccount(i, { account_name: v })} />
              <TextField isReadOnly={readOnly} label="Account number" name={`bank_accounts.${i}.account_number`} isRequired value={b.account_number} onChange={(v) => setAccount(i, { account_number: v })} />
              <TextField isReadOnly={readOnly} label="IFSC" name={`bank_accounts.${i}.ifsc`} isRequired value={b.ifsc} onChange={(v) => setAccount(i, { ifsc: v })} />
              <TextField isReadOnly={readOnly} label="Branch" name={`bank_accounts.${i}.branch`} value={b.branch ?? ""} onChange={(v) => setAccount(i, { branch: v })} />
            </section>
          ))}
          {!readOnly && (
            <ActionButton onPress={() => setDraft((d) => ({ ...d, bank_accounts: [...d.bank_accounts, blankAccount(d.bank_accounts.length === 0)] }))}>
              Add bank account
            </ActionButton>
          )}
        </div>

        <ImageField label="Logo" value={draft.logo} onChange={set("logo")} readOnly={readOnly} />
        <ImageField label="Signature" value={draft.signature} onChange={set("signature")} readOnly={readOnly} />
        {listError("logo")}
        {listError("signature")}

        <TextArea isReadOnly={readOnly} label="Terms & conditions" name="terms" description="Printed on documents by default." value={draft.terms} onChange={set("terms")} />

        {!readOnly && (
          <div>
            <Button type="submit" variant="accent" isPending={saving}>
              Save
            </Button>
          </div>
        )}
      </Form>
    </div>
  );
}
