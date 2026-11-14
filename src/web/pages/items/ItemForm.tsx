// Masters → Items → New / edit (FR-3.2). Prices are typed in rupees and sent in paise; quantities
// are typed in the item's unit (1.250 KGS) and sent in its smallest step (1250). Services have no
// stock fields. Admins and accountants edit; everyone else sees it read-only.
import { Spinner } from "@primer/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { call, client } from "../../api.ts";
import { type GstRate, type Item, type Unit, note } from "./item.ts";
import { ItemEditor } from "./ItemEditor.tsx";

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
  if (!lists || (id && !item)) return <Spinner srText="Loading" />;
  const loaded = id ? (item as Item) : null;
  // key: after a save or (de)activation the form starts again from what the server returned.
  return <ItemEditor key={JSON.stringify(loaded)} item={loaded} units={lists.units} rates={lists.rates} onSaved={setItem} />;
}
