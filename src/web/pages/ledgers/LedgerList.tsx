// Masters → Ledgers (FR-3.4): every ledger, grouped by its ledger group (the API sorts by group,
// then name). Search, inactive flag and page live in the URL. A row opens the ledger in a dialog;
// so does "New ledger".
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Cell, Column, Row, TableBody, TableHeader, TableView } from "@react-spectrum/s2/TableView";
import { useEffect, useState } from "react";
import { call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";
import { LedgerDialog, type LedgerRow } from "./LedgerDialog.tsx";

const loadLedgers = (query: Parameters<typeof client.api.ledgers.$get>[0]["query"]) => call(client.api.ledgers.$get({ query }));
type ListResponse = Awaited<ReturnType<typeof loadLedgers>>;

const page = style({ display: "flex", flexDirection: "column", gap: 16 });
const head = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const filters = style({ display: "flex", alignItems: "end", gap: 16, flexWrap: "wrap" });
const nameCell = style({ display: "flex", alignItems: "center", gap: 8 });

export function LedgerList() {
  const { q, inactive, pageNo, update, text, setText } = useListUrl();
  const role = useUser().role;
  const canWrite = role === "admin" || role === "accountant";
  const [open, setOpen] = useState<LedgerRow | "new" | null>(null);
  const [reload, setReload] = useState(0); // bumped after a save to fetch the page again

  const [data, setData] = useState<ListResponse | null>(null);
  useEffect(() => {
    let current = true; // a slow older response must not overwrite a newer one
    setData(null);
    loadLedgers({
      ...(q && { q }),
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
  }, [q, inactive, pageNo, reload]);

  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>Ledgers</h1>
        {canWrite && (
          <Button variant="accent" onPress={() => setOpen("new")}>
            New ledger
          </Button>
        )}
      </div>
      <div className={filters}>
        <SearchField label="Search" placeholder="Ledger or group name" value={text} onChange={setText} styles={style({ width: 280 })} />
        <Checkbox isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })}>
          Show inactive
        </Checkbox>
      </div>
      <TableView
        aria-label="Ledgers"
        loadingState={data ? "idle" : "loading"}
        styles={style({ minHeight: 320 })}
        onAction={(key) => setOpen(data?.ledgers.find((l) => l.id === key) ?? null)}>
        <TableHeader>
          <Column minWidth={180}>Group</Column>
          <Column isRowHeader minWidth={240}>
            Name
          </Column>
        </TableHeader>
        <TableBody
          items={data?.ledgers ?? []}
          renderEmptyState={() => (data ? (q || inactive ? "No ledgers match. Try another search." : "No ledgers yet.") : null)}>
          {(l) => (
            <Row id={l.id}>
              <Cell>{l.group_name}</Cell>
              <Cell>
                <span className={nameCell}>
                  {l.name}
                  {l.is_system && <Badge variant="informative">System</Badge>}
                  {!l.active && <Badge variant="neutral">Inactive</Badge>}
                </span>
              </Cell>
            </Row>
          )}
        </TableBody>
      </TableView>
      {data && <Pager total={data.total} shown={data.ledgers.length} pageNo={pageNo} update={update} />}
      <LedgerDialog
        open={open}
        canWrite={canWrite}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          setReload((n) => n + 1);
        }}
      />
    </div>
  );
}
