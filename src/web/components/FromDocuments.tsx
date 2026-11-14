// "From quotations" on Sales → Orders, "Receive against PO" on Purchase → GRNs: pick the party,
// tick any of their open documents (this FY) with something still pending, and open one new
// document made from all of them.
import { Button } from "@primer/react";
import { useState } from "react";
import type { ListRow } from "./DocumentList.tsx";
import { FromDocumentsPicker } from "./FromDocumentsPicker.tsx";

export type Props = {
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

export function FromDocuments({ button, ...picker }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        {button}
      </Button>
      {open && <FromDocumentsPicker {...picker} onClose={() => setOpen(false)} />}
    </>
  );
}
