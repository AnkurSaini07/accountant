// The item cell of a document line: type part of a code or name, pick from the matches (GET /api/items).
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { call, client } from "../api.ts";
import { ComboBox } from "./ComboBox.tsx";
import { SEARCH_DELAY_MS } from "./ListUrl.tsx";

export type PickedItem = InferResponseType<typeof client.api.items.$get, 200>["items"][number];
const label = (i: PickedItem) => `${i.code} – ${i.name}`;

type Props = { "aria-label": string; name: string; item: PickedItem | null; onPick: (item: PickedItem) => void; isReadOnly?: boolean; autoFocus?: boolean; className?: string };

export function ItemPicker({ item, onPick, "aria-label": ariaLabel, ...props }: Props) {
  const [text, setText] = useState(item ? label(item) : "");
  const [found, setFound] = useState<PickedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = text.trim();
    if (!q || (item && q === label(item))) return;
    let current = true; // only the latest search may fill the list
    const t = setTimeout(() => {
      setLoading(true);
      call(client.api.items.$get({ query: { q, page_size: "20" } })).then(
        (r) => current && setFound(r.items),
        () => {}, // failures toast
      ).finally(() => current && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- only typing searches

  // The picked item stays an option, so the box can show it while other matches load.
  const options = item && !found.some((i) => i.id === item.id) ? [item, ...found] : found;
  return (
    <ComboBox
      {...props}
      label={ariaLabel}
      hideLabel
      options={options.map((i) => ({ id: i.id, label: label(i) }))}
      inputValue={text}
      onInputChange={setText}
      selectedId={item?.id ?? null}
      onSelect={(o) => {
        const picked = options.find((i) => i.id === o.id);
        if (!picked) return;
        setText(label(picked));
        onPick(picked);
      }}
      loading={loading}
      menuWidth={360}
    />
  );
}
