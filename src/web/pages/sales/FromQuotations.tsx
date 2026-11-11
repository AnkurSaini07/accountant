// "From quotations" on Sales → Orders: pick a customer, tick any of their sent or accepted
// quotations (this FY) with something still pending, and open one new order made from all of them.
import { Checkbox, CheckboxGroup } from "@react-spectrum/s2/CheckboxGroup";
import { Button, ButtonGroup, Content, Dialog, DialogTrigger, Heading } from "@react-spectrum/s2/Dialog";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { parseFyLabel } from "../../../shared/fy.ts";
import { formatRupees } from "../../../shared/money.ts";
import { call, client } from "../../api.ts";
import { formatDate, type ListRow } from "../../components/DocumentList.tsx";
import { type PickedParty, PartyPicker } from "../../components/PartyPicker.tsx";
import { financialYearAtom } from "../../state.ts";

const OPEN = new Set(["sent", "accepted"]);

// State lives here, above <Dialog>: S2's Dialog renders its children once per layout slot.
function Picker() {
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
    // ponytail: one page of 200 is plenty for one customer's quotations in a year.
    call(client.api.quotations.$get({ query: { fy: String(fy), party_id: String(party.id), page: "1", page_size: "200" } })).then(
      (r) => current && setOpen(r.quotations.filter((q) => OPEN.has(q.status) && (q.pending_qty ?? 0) > 0)),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [party, fy]);

  return (
    <Dialog>
      {({ close }) => (
        <>
          <Heading>Sales order from quotations</Heading>
          <Content>
            <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
              <PartyPicker label="Customer" kind="customer" party={party} onPick={setParty} autoFocus />
              {party && open?.length === 0 && <p className={style({ font: "body", margin: 0 })}>{party.name} has no sent or accepted quotations with anything left to order this year.</p>}
              {party && !!open?.length && (
                <CheckboxGroup label="Quotations" value={ticked} onChange={setTicked}>
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
                navigate(`/sales/orders/new?from=${ticked.join(",")}`);
              }}>
              Create order
            </Button>
          </ButtonGroup>
        </>
      )}
    </Dialog>
  );
}

export function FromQuotations() {
  return (
    <DialogTrigger>
      <Button variant="secondary">From quotations</Button>
      <Picker />
    </DialogTrigger>
  );
}
