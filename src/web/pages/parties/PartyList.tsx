// Masters → Parties (FR-3.1): searchable, filterable list of customers and suppliers.
// The search, kind, inactive flag and page live in the URL (?q=&kind=&inactive=1&page=), so
// refresh, Back and shared links keep the view. Clicking a row opens the party (form: #29).
import { Badge } from "@react-spectrum/s2/Badge";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { SegmentedControl, SegmentedControlItem } from "@react-spectrum/s2/SegmentedControl";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import { useEffect, useState } from "react";
import { formatRupees } from "../../../shared/money.ts";
import { call, client } from "../../api.ts";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";

export { PAGE_SIZE, SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";

type ListResponse = Awaited<ReturnType<typeof loadParties>>;
const loadParties = (query: Parameters<typeof client.api.parties.$get>[0]["query"]) => call(client.api.parties.$get({ query }));

/** Opening balance as the ledger shows it: "12,345.00 Dr" / "Cr", blank when nil. */
export const balanceText = (paise: number) => (paise === 0 ? "" : `${formatRupees(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`);

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });
const nameCell = style({ display: "flex", alignItems: "center", gap: 8 });

export function PartyList() {
  const { params, q, inactive, pageNo, update, text, setText } = useListUrl();
  const kind = params.get("kind") === "customer" || params.get("kind") === "supplier" ? (params.get("kind") as "customer" | "supplier") : undefined;

  const [data, setData] = useState<ListResponse | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    loadParties({
      ...(q && { q }),
      ...(kind && { kind }),
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
  }, [q, kind, inactive, pageNo]);

  const filtered = !!(q || kind || inactive);

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>Parties</h1>
        <LinkButton href="/masters/parties/new" variant="accent">
          New party
        </LinkButton>
      </div>
      <div className={filters}>
        <SearchField label="Search" placeholder="Name, GSTIN or phone" value={text} onChange={setText} styles={style({ width: 280 })} />
        <SegmentedControl aria-label="Kind" selectedKey={kind ?? "all"} onSelectionChange={(k) => update({ kind: k === "all" ? null : String(k) })}>
          <SegmentedControlItem id="all">All</SegmentedControlItem>
          <SegmentedControlItem id="customer">Customers</SegmentedControlItem>
          <SegmentedControlItem id="supplier">Suppliers</SegmentedControlItem>
        </SegmentedControl>
        <Checkbox isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })}>
          Show inactive
        </Checkbox>
      </div>
      <TableView aria-label="Parties" loadingState={data ? "idle" : "loading"} styles={style({ minHeight: 320 })}>
        <TableHeader>
          {/* Minimum widths: on a phone the table scrolls sideways instead of squeezing every column. */}
          <Column isRowHeader minWidth={220}>
            Name
          </Column>
          <Column minWidth={170}>GSTIN</Column>
          <Column minWidth={120}>City</Column>
          <Column minWidth={130}>Phone</Column>
          <Column align="end" minWidth={150}>
            Opening balance
          </Column>
        </TableHeader>
        <TableBody
          items={data?.parties ?? []}
          renderEmptyState={() => (data ? (filtered ? "No parties match. Try another search or filter." : "No parties yet. Add your first customer or supplier.") : null)}>
          {(p) => (
            <Row id={p.id} href={`/masters/parties/${p.id}`}>
              <Cell>
                <span className={nameCell}>
                  {p.name}
                  {!p.active && <Badge variant="neutral">Inactive</Badge>}
                </span>
              </Cell>
              <Cell>{p.gstin ?? (p.registration_type === "consumer" ? "Consumer" : "Unregistered")}</Cell>
              <Cell>{p.city ?? ""}</Cell>
              <Cell>{p.phone ?? ""}</Cell>
              <Cell align="end">{balanceText(p.opening_balance)}</Cell>
            </Row>
          )}
        </TableBody>
      </TableView>
      {data && <Pager total={data.total} shown={data.parties.length} pageNo={pageNo} update={update} />}
    </div>
  );
}
