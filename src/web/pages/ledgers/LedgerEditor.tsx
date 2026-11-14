import { Dialog, Spinner } from "@primer/react";
import { ToastQueue } from "../../toast.ts";
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { ApiError, call, client } from "../../api.ts";
import { Form } from "../../components/Form.tsx";
import { note, stack } from "../../components/formLayout.ts";
import { SelectField } from "../../components/SelectField.tsx";
import { TextField } from "../../components/TextField.tsx";
import type { LedgerRow } from "./ledger.ts";

type Group = InferResponseType<(typeof client.api)["ledger-groups"]["$get"], 200>["groups"][number];

const FORM_ID = "ledger-form";

/** A primary group and everything under it, parents first. */
const flatten = (g: Group): Group[] => [g, ...g.children.flatMap(flatten)];

export function LedgerEditor({ ledger, canWrite, onClose, onSaved }: { ledger: LedgerRow | null; canWrite: boolean; onClose: () => void; onSaved: () => void }) {
  const partyLedger = ledger?.party_id != null;
  const locked = !canWrite || !!ledger?.is_system || partyLedger;
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState(ledger?.name ?? "");
  const [groupId, setGroupId] = useState<number | null>(ledger?.group_id ?? null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call(client.api["ledger-groups"].$get()).then((r) => setGroups(r.groups), () => {}); // failures toast
  }, []);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      ToastQueue.positive(message, { timeout: 5000 });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    const json = { name, group_id: groupId ?? 0 }; // 0 → "Choose a group." from the server
    return run(
      () => call(ledger ? client.api.ledgers[":id"].$put({ param: { id: String(ledger.id) }, json }) : client.api.ledgers.$post({ json })),
      `${name.trim()} saved.`,
    );
  };
  const setActive = (active: boolean) => {
    const param = { param: { id: String(ledger!.id) } };
    return run(
      () => call(active ? client.api.ledgers[":id"].reactivate.$post(param) : client.api.ledgers[":id"].deactivate.$post(param)),
      active ? `${ledger!.name} is active again.` : `${ledger!.name} deactivated. Old vouchers keep it; new ones can't pick it.`,
    );
  };

  return (
    <Dialog
      title={ledger ? ledger.name : "New ledger"}
      onClose={onClose}
      footerButtons={[
        ...(ledger && !locked ? [{ buttonType: "default" as const, content: ledger.active ? "Deactivate" : "Reactivate", disabled: busy, onClick: () => void setActive(!ledger.active) }] : []),
        { buttonType: "default" as const, content: locked ? "Close" : "Cancel", onClick: onClose },
        ...(!locked ? [{ buttonType: "primary" as const, content: "Save", type: "submit" as const, form: FORM_ID, loading: busy, disabled: !groups }] : []),
      ]}>
      {!groups ? (
        <Spinner srText="Loading" />
      ) : (
        <Form id={FORM_ID} errors={errors} className={stack} onSubmit={() => void save()}>
          {ledger?.is_system && <p className={note}>A system ledger: invoices and vouchers post to it, so it can't be renamed, moved or deactivated.</p>}
          {partyLedger && <p className={note}>A party's ledger: it follows the party's name and kind. Change it in Masters → Parties.</p>}
          {!canWrite && !ledger?.is_system && !partyLedger && <p className={note}>You can view ledgers; ask an accountant or admin to change them.</p>}
          <TextField isReadOnly={locked} isRequired label="Name" name="name" value={name} onChange={setName} autoFocus={!locked} />
          <SelectField
            isReadOnly={locked}
            isRequired
            label="Group"
            name="group_id"
            placeholder="Choose a group"
            value={groupId === null ? null : String(groupId)}
            onChange={(k) => k && setGroupId(Number(k))}
            groups={groups.map((g) => ({ label: g.name, options: flatten(g).map((n) => [String(n.id), n.name] as const) }))}
          />
        </Form>
      )}
    </Dialog>
  );
}
