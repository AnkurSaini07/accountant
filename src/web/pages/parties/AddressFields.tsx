// One party address (billing or shipping). `name` is its path in the saved body, e.g. "addresses.1",
// so server errors like "addresses.1.pincode" land on the right field.
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextArea } from "@react-spectrum/s2/TextArea";
import { TextField } from "@react-spectrum/s2/TextField";
import { STATES } from "../../../shared/states.ts";

export type AddressDraft = { kind: "billing" | "shipping"; label: string; address: string; city: string; pincode: string; state_code: string };

export const PICKABLE_STATES = STATES.filter((s) => !s.legacy);
export const blankAddress = (kind: AddressDraft["kind"], state_code: string): AddressDraft => ({ kind, label: "", address: "", city: "", pincode: "", state_code });
/** A billing address nobody filled in isn't saved (the state alone is just the default). */
export const isBlank = (a: AddressDraft) => !a.label.trim() && !a.address.trim() && !a.city.trim() && !a.pincode.trim();


const stack = style({ display: "flex", flexDirection: "column", gap: 16 });

export function AddressFields({ value, onChange, name, readOnly }: { value: AddressDraft; onChange: (a: AddressDraft) => void; name: string; readOnly: boolean }) {
  const set = (patch: Partial<AddressDraft>) => onChange({ ...value, ...patch });
  return (
    <div className={stack}>
      {value.kind === "shipping" && (
        <TextField isReadOnly={readOnly} label="Label" name={`${name}.label`} description="e.g. Plant 2, Godown" value={value.label} onChange={(label) => set({ label })} />
      )}
      <TextArea isReadOnly={readOnly} label="Address" name={`${name}.address`} value={value.address} onChange={(address) => set({ address })} />
      <TextField isReadOnly={readOnly} label="City" name={`${name}.city`} value={value.city} onChange={(city) => set({ city })} />
      <TextField isReadOnly={readOnly} label="PIN code" name={`${name}.pincode`} inputMode="numeric" value={value.pincode} onChange={(pincode) => set({ pincode })} />
      <Picker
        isDisabled={readOnly}
        label="State"
        name={`${name}.state_code`}
        description={value.kind === "shipping" ? "Decides the place of supply for goods sent here." : undefined}
        selectedKey={value.state_code}
        onSelectionChange={(k) => k != null && set({ state_code: String(k) })}>
        {PICKABLE_STATES.map((s) => (
          <PickerItem key={s.code} id={s.code}>
            {`${s.code} – ${s.name}`}
          </PickerItem>
        ))}
      </Picker>
    </div>
  );
}
