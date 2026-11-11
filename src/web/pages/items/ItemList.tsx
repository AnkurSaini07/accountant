// Masters → Items (FR-3.2): searchable, filterable list. Like the party list, the search, type,
// inactive flag and page live in the URL (?q=&type=&inactive=1&page=). Rows open the item.
import { Badge } from "@react-spectrum/s2/Badge";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import { useEffect, useState } from "react";
import { formatRupees } from "../../../shared/money.ts";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "../../../shared/schemas/item.ts";
import { call, client } from "../../api.ts";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";

export { PAGE_SIZE, SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";
type ItemType = (typeof ITEM_TYPES)[number];

const loadItems = (query: Parameters<typeof client.api.items.$get>[0]["query"]) => call(client.api.items.$get({ query }));
type ListResponse = Awaited<ReturnType<typeof loadItems>>;

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });
const nameCell = style({ display: "flex", alignItems: "center", gap: 8 });

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

  const filtered = !!(q || type || inactive);

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>Items</h1>
        <LinkButton href="/masters/items/new" variant="accent">
          New item
        </LinkButton>
      </div>
      <div className={filters}>
        <SearchField label="Search" placeholder="Code, name or HSN" value={text} onChange={setText} styles={style({ width: 280 })} />
        <Picker label="Type" selectedKey={type ?? "all"} onSelectionChange={(k) => update({ type: k === "all" ? null : String(k) })} styles={style({ width: 180 })}>
          {[
            <PickerItem key="all" id="all">
              All types
            </PickerItem>,
            ...ITEM_TYPES.map((t: ItemType) => (
              <PickerItem key={t} id={t}>
                {ITEM_TYPE_LABELS[t]}
              </PickerItem>
            )),
          ]}
        </Picker>
        <Checkbox isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })}>
          Show inactive
        </Checkbox>
      </div>
      <TableView aria-label="Items" loadingState={data ? "idle" : "loading"} styles={style({ minHeight: 320 })}>
        <TableHeader>
          <Column minWidth={110}>Code</Column>
          <Column isRowHeader minWidth={220}>
            Name
          </Column>
          <Column minWidth={130}>Type</Column>
          <Column minWidth={100}>HSN/SAC</Column>
          <Column minWidth={70}>Unit</Column>
          <Column align="end" minWidth={70}>
            GST
          </Column>
          <Column align="end" minWidth={120}>
            Sale price
          </Column>
        </TableHeader>
        <TableBody
          items={data?.items ?? []}
          renderEmptyState={() => (data ? (filtered ? "No items match. Try another search or filter." : "No items yet. Add what you buy, make and sell.") : null)}>
          {(i) => (
            <Row id={i.id} href={`/masters/items/${i.id}`}>
              <Cell>{i.code}</Cell>
              <Cell>
                <span className={nameCell}>
                  {i.name}
                  {!i.active && <Badge variant="neutral">Inactive</Badge>}
                </span>
              </Cell>
              <Cell>{ITEM_TYPE_LABELS[i.type as ItemType]}</Cell>
              <Cell>{i.hsn ?? ""}</Cell>
              <Cell>{i.unit}</Cell>
              <Cell align="end">{`${i.gst_rate}%`}</Cell>
              <Cell align="end">{i.sale_price ? formatRupees(i.sale_price) : ""}</Cell>
            </Row>
          )}
        </TableBody>
      </TableView>
      {data && <Pager total={data.total} shown={data.items.length} pageNo={pageNo} update={update} />}
    </div>
  );
}
