// One party address (billing or shipping). `name` is its path in the saved body, e.g. "addresses.1",
// so server errors like "addresses.1.pincode" land on the right field.
import { TextField } from "../../components/TextField.tsx";
import { TextAreaField } from "../../components/TextAreaField.tsx";
import { SelectField } from "../../components/SelectField.tsx";
import { STATES } from "../../../shared/states.ts";
import { Cell } from "../../components/Cell.tsx";
import { FieldGrid } from "../../components/FieldGrid.tsx";

export type AddressDraft = { kind: "billing" | "shipping"; label: string; address: string; city: string; pincode: string; state_code: string };

export const PICKABLE_STATES = STATES.filter((s) => !s.legacy);
export const STATE_OPTIONS = PICKABLE_STATES.map((s) => [s.code, `${s.code} – ${s.name}`] as const);
export const blankAddress = (kind: AddressDraft["kind"], state_code: string): AddressDraft => ({ kind, label: "", address: "", city: "", pincode: "", state_code });
/** A billing address nobody filled in isn't saved (the state alone is just the default). */
export const isBlank = (a: AddressDraft) => !a.label.trim() && !a.address.trim() && !a.city.trim() && !a.pincode.trim();

export function AddressFields({ value, onChange, name, readOnly }: { value: AddressDraft; onChange: (a: AddressDraft) => void; name: string; readOnly: boolean }) {
  const set = (patch: Partial<AddressDraft>) => onChange({ ...value, ...patch });
  return (
    <FieldGrid half>
      {value.kind === "shipping" && (
        <Cell full>
          <TextField isReadOnly={readOnly} label="Label" name={`${name}.label`} description="e.g. Plant 2, Godown" value={value.label} onChange={(label) => set({ label })} />
        </Cell>
      )}
      <Cell full>
        <TextAreaField isReadOnly={readOnly} label="Address" name={`${name}.address`} value={value.address} onChange={(address) => set({ address })} />
      </Cell>
      <Cell>
        <TextField isReadOnly={readOnly} label="City" name={`${name}.city`} value={value.city} onChange={(city) => set({ city })} />
      </Cell>
      <Cell>
        <TextField isReadOnly={readOnly} label="PIN code" name={`${name}.pincode`} inputMode="numeric" value={value.pincode} onChange={(pincode) => set({ pincode })} />
      </Cell>
      <Cell>
      <SelectField
        isReadOnly={readOnly}
        label="State"
        name={`${name}.state_code`}
        description={value.kind === "shipping" ? "Decides the place of supply for goods sent here." : undefined}
        value={value.state_code}
        onChange={(k) => k && set({ state_code: k })}
        options={STATE_OPTIONS}
      />
      </Cell>
    </FieldGrid>
  );
}
