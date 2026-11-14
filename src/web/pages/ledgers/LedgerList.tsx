// Masters → Ledgers (FR-3.4): every ledger, grouped by its ledger group (the API sorts by group,
// then name). Search, inactive flag and page live in the URL. A row opens the ledger in a dialog;
// so does "New ledger".
import { Button, Label } from "@primer/react";
import { useEffect, useState } from "react";
import { call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { useIsPhone } from "../../components/useIsPhone.ts";
import { CardList } from "../../components/CardList.tsx";
import { ListPage } from "../../components/ListPage.tsx";
import { PAGE_SIZE, Pager, useListUrl } from "../../components/ListUrl.tsx";
import { CheckboxField } from "../../components/CheckboxField.tsx";
import { RecordTable } from "../../components/RecordTable.tsx";
import { SearchField } from "../../components/SearchField.tsx";
import { LedgerDialog } from "./LedgerDialog.tsx";
import type { LedgerRow } from "./ledger.ts";

const loadLedgers = (query: Parameters<typeof client.api.ledgers.$get>[0]["query"]) => call(client.api.ledgers.$get({ query }));
type ListResponse = Awaited<ReturnType<typeof loadLedgers>>;

const nameCell = { display: "inline-flex", alignItems: "center", gap: 8 } as const;

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
    <ListPage
      title="Ledgers"
      actions={
        <>
        {canWrite && (
          <Button variant="primary" size="small" onClick={() => setOpen("new")}>
            New ledger
          </Button>
        )}
        </>
      }
      search={<SearchField aria-label="Search" placeholder="Ledger or group name" value={text} onChange={setText} />}
      activeFilters={inactive ? 1 : 0}
      filters={
        <>
        <CheckboxField label="Show inactive" isSelected={inactive} onChange={(on) => update({ inactive: on ? "1" : null })} />
        </>
      }>
      <RecordTable
        label="Ledgers"
        rows={data?.ledgers ?? null}
        rowKey={(l) => l.id}
        onOpen={setOpen}
        empty={q || inactive ? "No ledgers match. Try another search." : "No ledgers yet."}
        columns={[
          { label: "Group", width: "minmax(180px, 1fr)", cell: (l) => l.group_name },
          {
            label: "Name",
            rowHeader: true,
            width: "minmax(240px, 2fr)",
            cell: (l) => (
              <span style={nameCell}>
                {l.name}
                {l.is_system && <Label variant="accent">System</Label>}
                {!l.active && <Label variant="secondary">Inactive</Label>}
              </span>
            ),
          },
        ]}
      />
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
    </ListPage>
  );
}
