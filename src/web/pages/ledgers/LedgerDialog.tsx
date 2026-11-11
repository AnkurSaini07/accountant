// The new / edit ledger dialog. The group picker shows the chart of accounts as a tree: a section
// per primary group, listing the group itself and its sub-groups. System ledgers (Cash, Sales, the
// GST ledgers…), party ledgers (they follow their party) and readers other than admins and
// accountants see it read-only.
import { Button } from "@react-spectrum/s2/Button";
import { ButtonGroup } from "@react-spectrum/s2/ButtonGroup";
import { Content } from "@react-spectrum/s2/Content";
import { Dialog, DialogContainer, Heading } from "@react-spectrum/s2/Dialog";
import { Form } from "@react-spectrum/s2/Form";
import { Header } from "@react-spectrum/s2/Header";
import { Picker, PickerItem, PickerSection } from "@react-spectrum/s2/Picker";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { ApiError, call, client } from "../../api.ts";

export type LedgerRow = InferResponseType<typeof client.api.ledgers.$get, 200>["ledgers"][number];
type Group = InferResponseType<(typeof client.api)["ledger-groups"]["$get"], 200>["groups"][number];

const FORM_ID = "ledger-form";
const stack = style({ display: "flex", flexDirection: "column", gap: 16 });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });

/** A primary group and everything under it, parents first. */
const flatten = (g: Group): Group[] => [g, ...g.children.flatMap(flatten)];

type Props = { open: LedgerRow | "new" | null; canWrite: boolean; onClose: () => void; onSaved: () => void };

export function LedgerDialog({ open, canWrite, onClose, onSaved }: Props) {
  return (
    <DialogContainer onDismiss={onClose}>
      {open && <LedgerEditor key={open === "new" ? "new" : open.id} ledger={open === "new" ? null : open} canWrite={canWrite} onClose={onClose} onSaved={onSaved} />}
    </DialogContainer>
  );
}

function LedgerEditor({ ledger, canWrite, onClose, onSaved }: { ledger: LedgerRow | null; canWrite: boolean; onClose: () => void; onSaved: () => void }) {
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
    <Dialog size="M">
      <Heading slot="title">{ledger ? ledger.name : "New ledger"}</Heading>
      <Content>
        {!groups ? (
          <ProgressCircle aria-label="Loading" isIndeterminate />
        ) : (
          <Form
            id={FORM_ID}
            validationErrors={errors}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}>
            <div className={stack}>
              {ledger?.is_system && <p className={note}>A system ledger: invoices and vouchers post to it, so it can't be renamed, moved or deactivated.</p>}
              {partyLedger && <p className={note}>A party's ledger: it follows the party's name and kind. Change it in Masters → Parties.</p>}
              {!canWrite && !ledger?.is_system && !partyLedger && <p className={note}>You can view ledgers; ask an accountant or admin to change them.</p>}
              <TextField isReadOnly={locked} isRequired label="Name" name="name" value={name} onChange={setName} autoFocus={!locked} />
              <Picker isDisabled={locked} isRequired label="Group" name="group_id" selectedKey={groupId} onSelectionChange={(k) => k != null && setGroupId(Number(k))}>
                {groups.map((g) => (
                  <PickerSection key={g.id} id={`section-${g.id}`}>
                    <Header>{g.name}</Header>
                    {flatten(g).map((n) => (
                      <PickerItem key={n.id} id={n.id}>
                        {n.name}
                      </PickerItem>
                    ))}
                  </PickerSection>
                ))}
              </Picker>
            </div>
          </Form>
        )}
      </Content>
      <ButtonGroup>
        {ledger && !locked && (
          <Button variant="secondary" isDisabled={busy} onPress={() => void setActive(!ledger.active)}>
            {ledger.active ? "Deactivate" : "Reactivate"}
          </Button>
        )}
        <Button variant="secondary" onPress={onClose}>
          {locked ? "Close" : "Cancel"}
        </Button>
        {!locked && (
          <Button type="submit" form={FORM_ID} variant="accent" isPending={busy} isDisabled={!groups}>
            Save
          </Button>
        )}
      </ButtonGroup>
    </Dialog>
  );
}
