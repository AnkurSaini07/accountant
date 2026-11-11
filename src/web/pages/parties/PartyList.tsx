// Masters → Parties (FR-3.1): searchable, filterable list of customers and suppliers.
// The search, kind, inactive flag and page live in the URL (?q=&kind=&inactive=1&page=), so
// refresh, Back and shared links keep the view. Clicking a row opens the party (form: #29).
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { SegmentedControl, SegmentedControlItem } from "@react-spectrum/s2/SegmentedControl";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { formatRupees } from "../../../shared/money.ts";
import { call, client } from "../../api.ts";

export const PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 300;

type ListResponse = Awaited<ReturnType<typeof loadParties>>;
const loadParties = (query: Parameters<typeof client.api.parties.$get>[0]["query"]) => call(client.api.parties.$get({ query }));

/** Opening balance as the ledger shows it: "12,345.00 Dr" / "Cr", blank when nil. */
export const balanceText = (paise: number) => (paise === 0 ? "" : `${formatRupees(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`);

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });
const pager = style({ display: "flex", alignItems: "center", justifyContent: "end", gap: 12, font: "body-sm" });
const nameCell = style({ display: "flex", alignItems: "center", gap: 8 });

export function PartyList() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kind = params.get("kind") === "customer" || params.get("kind") === "supplier" ? (params.get("kind") as "customer" | "supplier") : undefined;
  const inactive = params.get("inactive") === "1";
  const pageNo = Math.max(1, Number(params.get("page")) || 1);

  /** Changes some URL params; any filter change goes back to page 1. */
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: "q" in patch }, // typing shouldn't fill the Back history
    );

  // The box updates at once; the URL (and the fetch) after the user pauses typing.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => update({ q: text.trim() || null }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- only typing starts the timer

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
  const last = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const from = data && data.total ? (pageNo - 1) * PAGE_SIZE + 1 : 0;

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
      {data && data.total > 0 && (
        <div className={pager}>
          <span>
            {from}–{from + data.parties.length - 1} of {data.total}
          </span>
          <Button variant="secondary" size="S" isDisabled={pageNo <= 1} onPress={() => update({ page: pageNo - 1 > 1 ? String(pageNo - 1) : null })}>
            Previous
          </Button>
          <Button variant="secondary" size="S" isDisabled={pageNo >= last} onPress={() => update({ page: String(pageNo + 1) })}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
