// Choose the party on a document: type part of a name, GSTIN or phone; each match shows its GSTIN
// and city so two similar names can be told apart (GET /api/parties).
import { ComboBox, ComboBoxItem, Text } from "@react-spectrum/s2/ComboBox";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { call, client } from "../api.ts";
import { SEARCH_DELAY_MS } from "./ListUrl.tsx";

export type PickedParty = Pick<InferResponseType<typeof client.api.parties.$get, 200>["parties"][number], "id" | "name" | "gstin" | "city" | "state_code">;
const details = (p: PickedParty) => [p.gstin ?? "Unregistered", p.city].filter(Boolean).join(" · ");

type Props = {
  label: string;
  kind: "customer" | "supplier"; // which parties to offer ('both' parties match either)
  party: PickedParty | null;
  onPick: (party: PickedParty) => void;
  isRequired?: boolean;
  isReadOnly?: boolean;
  autoFocus?: boolean;
};

export function PartyPicker({ label, kind, party, onPick, ...props }: Props) {
  const [text, setText] = useState(party?.name ?? "");
  const [found, setFound] = useState<PickedParty[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = text.trim();
    if (!q || q === party?.name) return;
    let current = true; // only the latest search may fill the list
    const t = setTimeout(() => {
      setLoading(true);
      call(client.api.parties.$get({ query: { q, kind, page_size: "20" } }))
        .then((r) => current && setFound(r.parties), () => {}) // failures toast
        .finally(() => current && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- only typing searches

  const options = party && !found.some((p) => p.id === party.id) ? [party, ...found] : found;
  return (
    <ComboBox
      {...props}
      label={label}
      name="party_id"
      description={party ? details(party) : undefined}
      items={options}
      inputValue={text}
      onInputChange={setText}
      selectedKey={party?.id ?? null}
      onSelectionChange={(key) => {
        const picked = options.find((p) => p.id === key);
        if (!picked) return;
        setText(picked.name);
        onPick(picked);
      }}
      loadingState={loading ? "filtering" : "idle"}
      styles={style({ width: "full", maxWidth: 360 })}>
      {(p) => (
        <ComboBoxItem id={p.id} textValue={p.name}>
          <Text slot="label">{p.name}</Text>
          <Text slot="description">{details(p)}</Text>
        </ComboBoxItem>
      )}
    </ComboBox>
  );
}
