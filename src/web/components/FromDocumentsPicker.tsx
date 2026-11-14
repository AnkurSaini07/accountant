import { Checkbox, CheckboxGroup, Dialog, FormControl } from "@primer/react";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { parseFyLabel } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import { formatDate, type ListRow } from "./DocumentList.tsx";
import { type PickedParty, PartyPicker } from "./PartyPicker.tsx";
import { financialYearAtom } from "../state.ts";
import type { Props } from "./FromDocuments.tsx";
import { stack } from "./formLayout.ts";

export function FromDocumentsPicker({ heading, partyLabel, partyKind, listLabel, open: statuses, load, empty, action, to, onClose }: Omit<Props, "button"> & { onClose: () => void }) {
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

  const toggle = (id: string, on: boolean) => setTicked((t) => (on ? [...t, id] : t.filter((x) => x !== id)));
  return (
    <Dialog
      title={heading}
      onClose={onClose}
      width="large"
      footerButtons={[
        { buttonType: "default", content: "Cancel", onClick: onClose },
        {
          buttonType: "primary",
          content: action,
          disabled: !ticked.length,
          onClick: () => {
            onClose(); // a modal left open would hide the new page
            navigate(`${to}?from=${ticked.join(",")}`);
          },
        },
      ]}>
      <div className={stack}>
        <PartyPicker label={partyLabel} kind={partyKind} party={party} onPick={setParty} autoFocus />
        {party && open?.length === 0 && <p style={{ margin: 0 }}>{empty(party.name)}</p>}
        {party && !!open?.length && (
          <CheckboxGroup>
            <CheckboxGroup.Label>{listLabel}</CheckboxGroup.Label>
            {open.map((q) => (
              <FormControl key={q.id}>
                <Checkbox value={String(q.id)} checked={ticked.includes(String(q.id))} onChange={(e) => toggle(String(q.id), e.target.checked)} />
                <FormControl.Label>{`${q.number} · ${formatDate(q.date)} · ${formatRupees(q.grand_total, { symbol: true })}`}</FormControl.Label>
              </FormControl>
            ))}
          </CheckboxGroup>
        )}
      </div>
    </Dialog>
  );
}
