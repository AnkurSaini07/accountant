// "From quotations" on Sales → Orders, "Receive against PO" on Purchase → GRNs: pick the party,
// tick any of their open documents (this FY) with something still pending, and open one new
// document made from all of them.
import { Checkbox, CheckboxGroup } from "@react-spectrum/s2/CheckboxGroup";
import { Button, ButtonGroup, Content, Dialog, DialogTrigger, Heading } from "@react-spectrum/s2/Dialog";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { parseFyLabel } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import { formatDate, type ListRow } from "./DocumentList.tsx";
import { type PickedParty, PartyPicker } from "./PartyPicker.tsx";
import { financialYearAtom } from "../state.ts";

type Props = {
  button: string; // "From quotations"
  heading: string; // "Sales order from quotations"
  partyLabel: string; // "Customer"
  partyKind: "customer" | "supplier";
  listLabel: string; // "Quotations"
  open: readonly string[]; // the statuses something can be made from
  // ponytail: one page of 200 is plenty for one party's open documents in a year.
  load: (query: { fy: string; party_id: string; page: string; page_size: string }) => Promise<ListRow[]>;
  empty: (party: string) => string; // "Acme has no sent or accepted quotations with anything left to order this year."
  action: string; // "Create order"
  to: string; // "/sales/orders/new": ?from=<ticked> is added
};

// State lives here, above <Dialog>: S2's Dialog renders its children once per layout slot.
function Picker({ heading, partyLabel, partyKind, listLabel, open: statuses, load, empty, action, to }: Omit<Props, "button">) {
  const fy = parseFyLabel(useAtomValue(financialYearAtom));
  const navigate = useNavigate();
  const [party, setParty] = useState<PickedParty | null>(null);
  const [open, setOpen] = useState<ListRow[] | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  useEffect(() => {
    if (!party) return;
    let current = true;
    setOpen(null);
    setTicked([]);
    load({ fy: String(fy), party_id: String(party.id), page: "1", page_size: "200" }).then(
      (rows) => current && setOpen(rows.filter((q) => statuses.includes(q.status) && (q.pending_qty ?? 0) > 0)),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [party, fy]); // eslint-disable-line react-hooks/exhaustive-deps -- load and statuses are fixed per use

  return (
    <Dialog>
      {({ close }) => (
        <>
          <Heading>{heading}</Heading>
          <Content>
            <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
              <PartyPicker label={partyLabel} kind={partyKind} party={party} onPick={setParty} autoFocus />
              {party && open?.length === 0 && <p className={style({ font: "body", margin: 0 })}>{empty(party.name)}</p>}
              {party && !!open?.length && (
                <CheckboxGroup label={listLabel} value={ticked} onChange={setTicked}>
                  {open.map((q) => (
                    <Checkbox key={q.id} value={String(q.id)}>
                      {`${q.number} · ${formatDate(q.date)} · ${formatRupees(q.grand_total, { symbol: true })}`}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              )}
            </div>
          </Content>
          <ButtonGroup>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              isDisabled={!ticked.length}
              onPress={() => {
                close(); // a modal left open would hide the new page
                navigate(`${to}?from=${ticked.join(",")}`);
              }}>
              {action}
            </Button>
          </ButtonGroup>
        </>
      )}
    </Dialog>
  );
}

export function FromDocuments({ button, ...picker }: Props) {
  return (
    <DialogTrigger>
      <Button variant="secondary">{button}</Button>
      <Picker {...picker} />
    </DialogTrigger>
  );
}
