// Masters → Parties → New / edit (FR-3.1). A valid GSTIN fills in state and PAN (the server derives
// them too). One billing address, any number of shipping addresses. Viewers see it read-only.
// Money is typed in rupees and sent in paise; the opening balance is an amount plus Dr/Cr.
import { Spinner } from "@primer/react";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { call, client } from "../../api.ts";
import { companyAtom } from "../../state.ts";
import { type Party, note } from "./party.ts";
import { PartyEditor } from "./PartyEditor.tsx";

/** /masters/parties/new and /masters/parties/:id */
export function PartyForm() {
  const { id } = useParams();
  const [party, setParty] = useState<Party | null | "missing">(null);
  useEffect(() => {
    if (!id) return;
    setParty(null);
    call(client.api.parties[":id"].$get({ param: { id } })).then(setParty, () => setParty("missing")); // failures toast
  }, [id]);
  const homeState = useAtomValue(companyAtom)?.state_code ?? "06";

  if (!id) return <PartyEditor party={null} homeState={homeState} onSaved={setParty} />;
  if (party === "missing") return <p className={note}>This party couldn't be loaded. Go back to the party list and try again.</p>;
  if (!party) return <Spinner srText="Loading" />;
  // key: after a save or (de)activation the form starts again from what the server returned.
  return <PartyEditor key={JSON.stringify(party)} party={party} homeState={homeState} onSaved={setParty} />;
}
