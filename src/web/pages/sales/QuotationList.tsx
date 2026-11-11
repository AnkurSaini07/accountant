// Sales → Quotations (FR-4.1): the selected FY's quotations, newest first. Search, status and page
// live in the URL (?q=&status=&page=); the FY comes from the header. Rows open the quotation.
import { Badge } from "@react-spectrum/s2/Badge";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { parseFyLabel } from "../../../shared/fy.ts";
import { formatRupees } from "../../../shared/money.ts";
import { QUOTATION_STATUSES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";
import { financialYearAtom } from "../../state.ts";

type Status = (typeof QUOTATION_STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Rejected", expired: "Expired" };
export const STATUS_BADGE = { draft: "neutral", sent: "informative", accepted: "positive", rejected: "negative", expired: "notice" } as const satisfies Record<Status, string>;

const loadQuotations = (query: Parameters<typeof client.api.quotations.$get>[0]["query"]) => call(client.api.quotations.$get({ query }));
type ListResponse = Awaited<ReturnType<typeof loadQuotations>>;

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });
const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function QuotationList() {
  const { params, q, pageNo, update, text, setText } = useListUrl();
  const status = QUOTATION_STATUSES.find((s) => s === params.get("status"));
  const fy = parseFyLabel(useAtomValue(financialYearAtom));
  const role = useUser().role;

  const [data, setData] = useState<ListResponse | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    loadQuotations({ fy: String(fy), ...(q && { q }), ...(status && { status }), page: String(pageNo), page_size: String(PAGE_SIZE) }).then(
      (d) => current && setData(d),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [fy, q, status, pageNo]);

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>Quotations</h1>
        {(role === "admin" || role === "accountant") && (
          <LinkButton href="/sales/quotations/new" variant="accent">
            New quotation
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
            ...QUOTATION_STATUSES.map((s) => (
              <PickerItem key={s} id={s}>
                {STATUS_LABELS[s]}
              </PickerItem>
            )),
          ]}
        </Picker>
      </div>
      <TableView aria-label="Quotations" loadingState={data ? "idle" : "loading"} styles={style({ minHeight: 320 })}>
        <TableHeader>
          <Column minWidth={150}>Number</Column>
          <Column minWidth={110}>Date</Column>
          <Column isRowHeader minWidth={220}>
            Party
          </Column>
          <Column minWidth={110}>Valid until</Column>
          <Column minWidth={110}>Status</Column>
          <Column align="end" minWidth={130}>
            Total
          </Column>
        </TableHeader>
        <TableBody
          items={data?.quotations ?? []}
          renderEmptyState={() => (data ? (q || status ? "No quotations match. Try another search or status." : "No quotations in this financial year yet.") : null)}>
          {(r) => (
            <Row id={r.id} href={`/sales/quotations/${r.id}`}>
              <Cell>{r.number ?? ""}</Cell>
              <Cell>{date(r.date)}</Cell>
              <Cell>{r.party_name}</Cell>
              <Cell>{r.due_date ? date(r.due_date) : ""}</Cell>
              <Cell>
                <Badge variant={STATUS_BADGE[r.status as Status]}>{STATUS_LABELS[r.status as Status]}</Badge>
              </Cell>
              <Cell align="end">{formatRupees(r.grand_total)}</Cell>
            </Row>
          )}
        </TableBody>
      </TableView>
      {data && <Pager total={data.total} shown={data.quotations.length} pageNo={pageNo} update={update} />}
    </div>
  );
}
