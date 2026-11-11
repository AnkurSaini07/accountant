// Ship to on a document: the party's billing address (null) or one of its saved shipping addresses,
// copied onto the document when picked. A document's address that's since left the party's list
// still shows, as "As on this document".
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useEffect, useState } from "react";
import { call, client } from "../api.ts";

export type ShipTo = { label: string | null; address: string; city: string; pincode: string | null; state_code: string };

const same = (a: ShipTo, b: ShipTo) => a.label === b.label && a.address === b.address && a.city === b.city && a.pincode === b.pincode && a.state_code === b.state_code;
const describe = (a: ShipTo) => [a.label, a.address, a.city].filter(Boolean).join(", ");

type Props = { partyId: number | null; value: ShipTo | null; onChange: (a: ShipTo | null) => void; isReadOnly?: boolean };

export function ShipToPicker({ partyId, value, onChange, isReadOnly }: Props) {
  const [saved, setSaved] = useState<ShipTo[]>([]);
  useEffect(() => {
    setSaved([]);
    if (!partyId) return;
    let current = true;
    call(client.api.parties[":id"].$get({ param: { id: String(partyId) } })).then(
      (p) => current && setSaved(p.addresses.filter((a) => a.kind === "shipping").map(({ label, address, city, pincode, state_code }) => ({ label, address, city, pincode, state_code }))),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [partyId]);

  const options: { key: string; text: string; address: ShipTo | null }[] = [
    { key: "billing", text: "Same as billing address", address: null },
    ...saved.map((a, i) => ({ key: `s${i}`, text: describe(a), address: a })),
  ];
  if (value && !saved.some((a) => same(a, value))) options.push({ key: "doc", text: `${describe(value)} (as on this document)`, address: value });
  const selected = value ? options.find((o) => o.address && same(o.address, value))!.key : "billing";

  return (
    <Picker
      label="Ship to"
      name="shipping_address"
      isDisabled={isReadOnly || !partyId}
      selectedKey={selected}
      onSelectionChange={(k) => onChange(options.find((o) => o.key === k)?.address ?? null)}
      styles={style({ width: "full", maxWidth: 360 })}>
      {options.map((o) => (
        <PickerItem key={o.key} id={o.key}>
          {o.text}
        </PickerItem>
      ))}
    </Picker>
  );
}
