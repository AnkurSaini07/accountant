// A document register (quotations, orders, challans, invoices…): the header FY's documents, newest
// first, with search, a status filter and paging in the URL (?q=&status=&page=). Rows open the
// document. Each type's page passes its loader, labels and any extra columns.
import { Badge } from "@react-spectrum/s2/Badge";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import type { InferResponseType } from "hono/client";
import { useAtomValue } from "jotai";
import { type ReactNode, useEffect, useState } from "react";
import { parseFyLabel } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import type { client } from "../api.ts";
import { useUser } from "../auth.tsx";
import { financialYearAtom } from "../state.ts";
import { PAGE_SIZE, Pager, useListUrl } from "./ListUrl.tsx";

/** One row of any document list (documents/list.sql). */
export type ListRow = InferResponseType<typeof client.api.quotations.$get, 200>["quotations"][number];
export type ListQuery = { fy: string; q?: string; status?: string; page: string; page_size: string };
export type BadgeVariant = "neutral" | "informative" | "positive" | "negative" | "notice";
export type StatusInfo = Record<string, { label: string; badge: BadgeVariant }>;

export const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Props = {
  title: string; // "Quotations"
  noun: string; // "quotations", for the empty states
  basePath: string; // "/sales/quotations": rows go to basePath/:id, New to basePath/new
  newLabel: string;
  statuses: StatusInfo;
  load: (query: ListQuery) => Promise<{ total: number; rows: ListRow[] }>;
  columns?: { label: string; cell: (r: ListRow) => ReactNode }[]; // between Party and Status
  writers?: string[];
};

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const titleStyle = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });

export const StatusBadge = ({ statuses, status }: { statuses: StatusInfo; status: string }) => (
  <Badge variant={statuses[status]?.badge ?? "neutral"}>{statuses[status]?.label ?? status}</Badge>
);

export function DocumentList({ title, noun, basePath, newLabel, statuses, load, columns = [], writers = ["admin", "accountant"] }: Props) {
  const { params, q, pageNo, update, text, setText } = useListUrl();
  const status = Object.keys(statuses).find((s) => s === params.get("status"));
  const fy = parseFyLabel(useAtomValue(financialYearAtom));
  const role = useUser().role;

  const [data, setData] = useState<{ total: number; rows: ListRow[] } | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    load({ fy: String(fy), ...(q && { q }), ...(status && { status }), page: String(pageNo), page_size: String(PAGE_SIZE) }).then(
      (d) => current && setData(d),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [fy, q, status, pageNo]); // eslint-disable-line react-hooks/exhaustive-deps -- load is fixed per page

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={titleStyle}>{title}</h1>
        {writers.includes(role) && (
          <LinkButton href={`${basePath}/new`} variant="accent">
            {newLabel}
          </LinkButton>
        )}
      </div>
      <div className={filters}>
        <SearchField label="Search" placeholder="Number or party" value={text} onChange={setText} styles={style({ width: 280 })} />
        <Picker label="Status" selectedKey={status ?? "all"} onSelectionChange={(k) => update({ status: k === "all" ? null : String(k) })} styles={style({ width: 180 })}>
          {[
            <PickerItem key="all" id="all">
              All statuses
            </PickerItem>,
            ...Object.entries(statuses).map(([s, { label }]) => (
              <PickerItem key={s} id={s}>
                {label}
              </PickerItem>
            )),
          ]}
        </Picker>
      </div>
      <TableView aria-label={title} loadingState={data ? "idle" : "loading"} styles={style({ minHeight: 320 })}>
        <TableHeader>
          {[
            <Column key="number" minWidth={150}>Number</Column>,
            <Column key="date" minWidth={110}>Date</Column>,
            <Column key="party" isRowHeader minWidth={220}>Party</Column>,
            ...columns.map((c) => (
              <Column key={c.label} minWidth={120}>
                {c.label}
              </Column>
            )),
            <Column key="status" minWidth={110}>Status</Column>,
            <Column key="total" align="end" minWidth={130}>Total</Column>,
          ]}
        </TableHeader>
        <TableBody items={data?.rows ?? []} renderEmptyState={() => (data ? (q || status ? `No ${noun} match. Try another search or status.` : `No ${noun} in this financial year yet.`) : null)}>
          {(r) => (
            <Row id={r.id} href={`${basePath}/${r.id}`}>
              {[
                <Cell key="number">{r.number ?? ""}</Cell>,
                <Cell key="date">{formatDate(r.date)}</Cell>,
                <Cell key="party">{r.party_name}</Cell>,
                ...columns.map((c) => <Cell key={c.label}>{c.cell(r)}</Cell>),
                <Cell key="status">
                  <StatusBadge statuses={statuses} status={r.status} />
                </Cell>,
                <Cell key="total" align="end">{formatRupees(r.grand_total)}</Cell>,
              ]}
            </Row>
          )}
        </TableBody>
      </TableView>
      {data && <Pager total={data.total} shown={data.rows.length} pageNo={pageNo} update={update} />}
    </div>
  );
}
