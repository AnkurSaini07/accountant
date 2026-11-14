// Masters → Items (FR-3.2): searchable, filterable list. Like the party list, the search, type,
// inactive flag and page live in the URL (?q=&type=&inactive=1&page=). Rows open the item.
import { Label, LinkButton } from "@primer/react";
import { useEffect, useState } from "react";
import { formatRupees } from "../../../shared/money.ts";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../../shared/schemas/item.ts";
import { call, client } from "../../api.ts";
import { useIsPhone } from "../../components/useIsPhone.ts";
import { CardList } from "../../components/CardList.tsx";
import { ListPage } from "../../components/ListPage.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";
import { CheckboxField } from "../../components/CheckboxField.tsx";
import { RecordTable } from "../../components/RecordTable.tsx";
import { SearchField } from "../../components/SearchField.tsx";
import { SelectField } from "../../components/SelectField.tsx";

export { PAGE_SIZE, SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";
type ItemType = (typeof ITEM_TYPES)[number];

const loadItems = (query: Parameters<typeof client.api.items.$get>[0]["query"]) => call(client.api.items.$get({ query }));
type ListResponse = Awaited<ReturnType<typeof loadItems>>;

const nameCell = { display: "inline-flex", alignItems: "center", gap: 8 } as const;

export function ItemList() {
  const { params, q, inactive, pageNo, update, text, setText } = useListUrl();
  const type = ITEM_TYPES.find((t) => t === params.get("type"));

  const [data, setData] = useState<ListResponse | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    loadItems({
      ...(q && { q }),
      ...(type && { type }),
      ...(inactive && { include_inactive: "true" as const }),
      page: String(pageNo),
      page_size: String(PAGE_SIZE),
    }).then(
      (d) => current && setData(d),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [q, type, inactive, pageNo]);

  const phone = useIsPhone();
  const filtered = !!(q || type || inactive);

  return (
    <ListPage
      title="Items"
      actions={
        <>
        <LinkButton href="/masters/items/new" variant="primary" size="small">
          New item
        </LinkButton>
        </>
      }
      search={<SearchField aria-label="Search" placeholder="Code, name or HSN" value={text} onChange={setText} />}
      activeFilters={[type, inactive].filter(Boolean).length}
      filters={
        <>
        <SelectField label="Type" hideLabel value={type ?? "all"} onChange={(k) => update({ type: k === "all" ? null : k })} options={[["all", "All types"], ...ITEM_TYPES.map((t: ItemType) => [t, ITEM_TYPE_LABELS[t]] as const)]} />
        <CheckboxField label="Show inactive" isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })} />
        </>
      }>
      {phone ? (
        <CardList label="Items" empty={filtered ? "No items match. Try another search or filter." : "No items yet. Add what you buy, make and sell."} rows={data?.items.map((i) => ({ id: i.id, title: `${i.code} – ${i.name}`, href: `/masters/items/${i.id}`, amount: i.sale_price ? formatRupees(i.sale_price, { symbol: true }) : "", meta: [ITEM_TYPE_LABELS[i.type as ItemType], i.hsn, i.unit, `${i.gst_rate}% GST`].filter(Boolean).join(" · "), ...(!i.active && { badge: { label: "Inactive", variant: "neutral" as const } }) })) ?? null} />
      ) : (
        <RecordTable
          label="Items"
          rows={data?.items ?? null}
          rowKey={(i) => i.id}
          href={(i) => `/masters/items/${i.id}`}
          empty={filtered ? "No items match. Try another search or filter." : "No items yet. Add what you buy, make and sell."}
          columns={[
            { label: "Code", width: "minmax(100px, auto)", cell: (i) => i.code },
            {
              label: "Name",
              rowHeader: true,
              width: "minmax(220px, 3fr)",
              cell: (i) => (
                <span style={nameCell}>
                  {i.name}
                  {!i.active && <Label variant="secondary">Inactive</Label>}
                </span>
              ),
            },
            { label: "Type", cell: (i) => ITEM_TYPE_LABELS[i.type as ItemType] },
            { label: "HSN/SAC", width: "minmax(100px, auto)", cell: (i) => i.hsn ?? "" },
            { label: "Unit", width: "minmax(70px, auto)", cell: (i) => i.unit },
            { label: "GST", align: "end", width: "minmax(70px, auto)", cell: (i) => `${i.gst_rate}%` },
            { label: "Sale price", align: "end", width: "minmax(120px, auto)", cell: (i) => (i.sale_price ? formatRupees(i.sale_price) : "") },
          ]}
        />
      )}
      {data && <Pager total={data.total} shown={data.items.length} pageNo={pageNo} update={update} />}
    </ListPage>
  );
}
