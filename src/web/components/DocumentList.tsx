// A document register (quotations, orders, challans, invoices…): the header FY's documents, newest
// first, with search, a status filter and paging in the URL (?q=&status=&page=). Rows open the
// document. Each type's page passes its loader, labels and any extra columns.
import { LinkButton } from "@primer/react";
import type { InferResponseType } from "hono/client";
import { useAtomValue } from "jotai";
import { type ReactNode, useEffect, useState } from "react";
import { parseFyLabel } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import type { client } from "../api.ts";
import { useUser } from "../auth.tsx";
import { financialYearAtom } from "../state.ts";
import { useIsPhone } from "./useIsPhone.ts";
import { CardList } from "./CardList.tsx";
import { ListPage } from "./ListPage.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "./ListUrl.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { DateField } from "./DateField.tsx";
import { RecordTable } from "./RecordTable.tsx";
import { SearchField } from "./SearchField.tsx";
import { SelectField } from "./SelectField.tsx";
import classes from "./DocumentList.module.css";

const NOTHING = { total: 0, rows: [] as ListRow[] };

/** One row of any document list (documents/list.sql). */
export type ListRow = InferResponseType<typeof client.api.quotations.$get, 200>["quotations"][number];
export type ListQuery = { fy: string; q?: string; status?: string; from?: string; to?: string; page: string; page_size: string };
export type BadgeVariant = "neutral" | "informative" | "positive" | "negative" | "notice";
export type StatusInfo = Record<string, { label: string; badge: BadgeVariant }>;

/** A column's cell as card text: plain strings show, anything richer needs the column's own `text`. */
const cellText = (n: ReactNode) => (typeof n === "string" || typeof n === "number" ? String(n) : "");

export const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Props = {
  title: string; // "Quotations"
  noun: string; // "quotations", for the empty states
  basePath: string; // "/sales/quotations": rows go to basePath/:id, New to basePath/new
  newLabel?: string; // none: made only from other documents (credit notes from invoices)
  statuses: StatusInfo;
  load: (query: ListQuery) => Promise<{ total: number; rows: ListRow[] }>;
  columns?: { label: string; cell: (r: ListRow) => ReactNode; text?: (r: ListRow) => string }[]; // between Party and Status; `text` also shows it on phone cards
  writers?: string[];
  actions?: ReactNode; // more buttons beside New, for writers ("From quotations")
};

export function DocumentList({ title, noun, basePath, newLabel, statuses, load, columns = [], writers = ["admin", "accountant"], actions }: Props) {
  const { params, q, pageNo, update, text, setText } = useListUrl();
  const status = Object.keys(statuses).find((s) => s === params.get("status"));
  // ?date_from=&date_to= (ISO); a range that runs backwards isn't sent, and the To box says why.
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(params.get(k) ?? "") ? params.get(k)! : null);
  const [from, to] = [iso("date_from"), iso("date_to")];
  const backwards = !!from && !!to && from > to;
  const fy = parseFyLabel(useAtomValue(financialYearAtom));
  const role = useUser().role;

  const [loaded, setData] = useState<{ total: number; rows: ListRow[] } | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    if (backwards) return;
    load({ fy: String(fy), ...(q && { q }), ...(status && { status }), ...(from && { from }), ...(to && { to }), page: String(pageNo), page_size: String(PAGE_SIZE) }).then(
      (d) => current && setData(d),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [fy, q, status, from, to, pageNo]); // eslint-disable-line react-hooks/exhaustive-deps -- load is fixed per page

  const data = backwards ? NOTHING : loaded;
  const phone = useIsPhone();
  const filtersOn = [status, from, to].filter(Boolean).length;
  const emptyText = q || status || from || to ? `No ${noun} match. Try another search, status or dates.` : `No ${noun} in this financial year yet.`;

  return (
    <ListPage
      title={title}
      actions={
        writers.includes(role) && (
          <>
            {actions}
            {newLabel && (
              <LinkButton href={`${basePath}/new`} variant="primary" size="small">
                {newLabel}
              </LinkButton>
            )}
          </>
        )
      }
      search={<SearchField aria-label="Search" placeholder="Number or party" value={text} onChange={setText} />}
      activeFilters={filtersOn}
      filters={
        <>
          <SelectField label="Status" hideLabel className={classes.status} value={status ?? "all"} onChange={(k) => update({ status: k === "all" ? null : k })} options={[["all", "All statuses"], ...Object.entries(statuses).map(([s, { label }]) => [s, label] as const)]} />
          <DateField label="From" inlineLabel className={classes.date} value={from} onChange={(v) => update({ date_from: v })} />
          <DateField label="To" inlineLabel className={classes.date} value={to} onChange={(v) => update({ date_to: v })} errorMessage={backwards ? "Pick a date on or after From." : undefined} />
        </>
      }>
      {phone ? (
        <CardList
          label={title}
          empty={emptyText}
          rows={
            data?.rows.map((r) => ({
              id: r.id,
              title: r.number ?? "Draft",
              href: `${basePath}/${r.id}`,
              amount: formatRupees(r.grand_total, { symbol: true }),
              meta: [r.party_name, formatDate(r.date), ...columns.map((c) => c.text?.(r) ?? cellText(c.cell(r)))].filter(Boolean).join(" · "),
              badge: { label: statuses[r.status]?.label ?? r.status, variant: statuses[r.status]?.badge ?? "neutral" },
            })) ?? null
          }
        />
      ) : (
        <RecordTable
          label={title}
          rows={data?.rows ?? null}
          rowKey={(r) => r.id}
          href={(r) => `${basePath}/${r.id}`}
          empty={emptyText}
          columns={[
            { label: "Number", rowHeader: true, width: "minmax(140px, 1fr)", cell: (r) => r.number ?? "Draft" },
            { label: "Date", width: "minmax(110px, auto)", cell: (r) => formatDate(r.date) },
            { label: "Party", width: "minmax(200px, 2fr)", cell: (r) => r.party_name },
            ...columns.map((c) => ({ label: c.label, cell: c.cell })),
            { label: "Status", width: "minmax(110px, auto)", cell: (r) => <StatusBadge statuses={statuses} status={r.status} /> },
            { label: "Total", align: "end" as const, width: "minmax(120px, auto)", cell: (r) => formatRupees(r.grand_total) },
          ]}
        />
      )}
      {data && <Pager total={data.total} shown={data.rows.length} pageNo={pageNo} update={update} />}
    </ListPage>
  );
}
