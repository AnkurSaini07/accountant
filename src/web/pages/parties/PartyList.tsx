// Masters → Parties (FR-3.1): searchable, filterable list of customers and suppliers.
// The search, kind, inactive flag and page live in the URL (?q=&kind=&inactive=1&page=), so
// refresh, Back and shared links keep the view. Clicking a row opens the party (form: #29).
import { Label, LinkButton, SegmentedControl } from "@primer/react";
import { useEffect, useState } from "react";
import { formatRupees } from "../../../shared/money.ts";
import { call, client } from "../../api.ts";
import { useIsPhone } from "../../components/useIsPhone.ts";
import { CardList } from "../../components/CardList.tsx";
import { ListPage } from "../../components/ListPage.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";
import { CheckboxField } from "../../components/CheckboxField.tsx";
import { RecordTable } from "../../components/RecordTable.tsx";
import { SearchField } from "../../components/SearchField.tsx";

export { PAGE_SIZE, SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";

type ListResponse = Awaited<ReturnType<typeof loadParties>>;
const loadParties = (query: Parameters<typeof client.api.parties.$get>[0]["query"]) => call(client.api.parties.$get({ query }));

/** Opening balance as the ledger shows it: "12,345.00 Dr" / "Cr", blank when nil. */
export const balanceText = (paise: number) => (paise === 0 ? "" : `${formatRupees(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`);

const nameCell = { display: "inline-flex", alignItems: "center", gap: 8 } as const;
const KINDS = [["all", "All"], ["customer", "Customers"], ["supplier", "Suppliers"]] as const;

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

  const phone = useIsPhone();
  const filtered = !!(q || kind || inactive);

  return (
    <ListPage
      title="Parties"
      actions={
        <>
        <LinkButton href="/masters/parties/new" variant="primary" size="small">
          New party
        </LinkButton>
        </>
      }
      search={<SearchField aria-label="Search" placeholder="Name, GSTIN or phone" value={text} onChange={setText} />}
      activeFilters={[kind, inactive].filter(Boolean).length}
      filters={
        <>
        <SegmentedControl aria-label="Kind" size="small" onChange={(i) => update({ kind: i === 0 ? null : KINDS[i]![0] })}>
          {KINDS.map(([k, label]) => (
            <SegmentedControl.Button key={k} selected={(kind ?? "all") === k}>
              {label}
            </SegmentedControl.Button>
          ))}
        </SegmentedControl>
        <CheckboxField label="Show inactive" isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })} />
        </>
      }>
      {phone ? (
        <CardList label="Parties" empty={filtered ? "No parties match. Try another search or filter." : "No parties yet. Add your first customer or supplier."} rows={data?.parties.map((p) => ({ id: p.id, title: p.name, href: `/masters/parties/${p.id}`, amount: balanceText(p.opening_balance), meta: [p.gstin ?? (p.registration_type === "consumer" ? "Consumer" : "Unregistered"), p.city, p.phone].filter(Boolean).join(" · "), ...(!p.active && { badge: { label: "Inactive", variant: "neutral" as const } }) })) ?? null} />
      ) : (
        <RecordTable
          label="Parties"
          rows={data?.parties ?? null}
          rowKey={(p) => p.id}
          href={(p) => `/masters/parties/${p.id}`}
          empty={filtered ? "No parties match. Try another search or filter." : "No parties yet. Add your first customer or supplier."}
          columns={[
            {
              label: "Name",
              rowHeader: true,
              width: "minmax(220px, 3fr)",
              cell: (p) => (
                <span style={nameCell}>
                  {p.name}
                  {!p.active && <Label variant="secondary">Inactive</Label>}
                </span>
              ),
            },
            { label: "GSTIN", width: "minmax(170px, 1fr)", cell: (p) => p.gstin ?? (p.registration_type === "consumer" ? "Consumer" : "Unregistered") },
            { label: "City", cell: (p) => p.city ?? "" },
            { label: "Phone", width: "minmax(130px, 1fr)", cell: (p) => p.phone ?? "" },
            { label: "Opening balance", align: "end", width: "minmax(150px, 1fr)", cell: (p) => balanceText(p.opening_balance) },
          ]}
        />
      )}
      {data && <Pager total={data.total} shown={data.parties.length} pageNo={pageNo} update={update} />}
    </ListPage>
  );
}
