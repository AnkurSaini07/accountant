// A document's screen once loaded: party, dates and references, lines with live totals, terms and
// notes; Save while it's a draft, then its status moves. Past draft, or for someone who can't write
// it, it reads as a document instead of a form.
import { KebabHorizontalIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Button, IconButton, LinkButton, useConfirm } from "@primer/react";
import { ToastQueue } from "../toast.ts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { todayInIndia } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import { formatQty } from "../../shared/quantity.ts";
import { ApiError } from "../api.ts";
import { useUser } from "../auth.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { fieldGrid, formPage } from "./formLayout.ts";
import { EnterSubmits } from "./EnterSubmits.tsx";
import { Cell } from "./Cell.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { emptyLine, type LineDraft, LineItems, linesBody } from "./LineItems.tsx";
import { type PickedParty, PartyPicker } from "./PartyPicker.tsx";
import { type ShipTo, ShipToPicker } from "./ShipToPicker.tsx";
import { type Body, type Doc, type DocConfig, type Draft, factLabel, note } from "./documentForm.ts";
import { CancelDialog } from "./CancelDialog.tsx";
import { Fact } from "./Fact.tsx";
import { CheckboxField } from "./CheckboxField.tsx";
import { DateField } from "./DateField.tsx";
import { Form } from "./Form.tsx";
import { SelectField } from "./SelectField.tsx";
import { TextAreaField } from "./TextAreaField.tsx";
import { TextField } from "./TextField.tsx";
import c from "./DocumentEditor.module.css";

// Moves that can't be undone ask first.
const FINAL = new Set(["cancelled", "rejected", "expired"]);

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const rupees = (paise: number) => (paise ? formatRupees(paise).replaceAll(",", "") : "");

const shortDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

type LineSource = Pick<Doc["lines"][number], "item_id" | "item_code" | "item_name" | "hsn" | "unit" | "unit_decimals" | "gst_rate" | "rate" | "description" | "qty" | "discount_bp" | "from_line_id"> & { rejected_qty?: number };

/** A saved or drafted line back into the editor's shape; the line keeps its own (snapshotted) HSN, unit and rate. */
function toDraft(l: LineSource): LineDraft {
  return {
    ...emptyLine(),
    item: {
      id: l.item_id, code: l.item_code, name: l.item_name, hsn: l.hsn, unit: l.unit, unit_decimals: l.unit_decimals,
      gst_rate: Number(l.gst_rate), sale_price: l.rate, purchase_price: l.rate, type: "finished", active: true,
    },
    description: l.description,
    qty: formatQty(l.qty, l.unit_decimals),
    rate: rupees(l.rate),
    discount: l.discount_bp ? String(l.discount_bp / 100) : "",
    from_line_id: l.from_line_id,
    rejected: l.rejected_qty ? formatQty(l.rejected_qty, l.unit_decimals) : "",
  };
}

export function DocumentEditor({ config, doc, draft, companyState, onSaved }: { config: DocConfig; doc: Doc | null; draft: Draft | null; companyState: string; onSaved: (d: Doc) => void }) {
  const { label, api } = config;
  const role = useUser().role;
  const canWrite = (config.writers ?? ["admin", "accountant"]).includes(role);
  const status = doc?.status ?? "draft";
  const readOnly = !canWrite || status !== "draft";
  const navigate = useNavigate();

  const start = doc ?? draft;
  const [party, setParty] = useState<PickedParty | null>(
    doc ? { id: doc.party_id, name: doc.party_name, gstin: doc.party_gstin, city: doc.billing_address?.city ?? null, state_code: doc.party_state_code } : (draft?.party ?? null),
  );
  const [date, setDate] = useState(doc?.date ?? todayInIndia());
  const [due, setDue] = useState<string | null>(doc?.due_date ?? null);
  const [ref, setRef] = useState(start?.party_ref ?? "");
  const [refDate, setRefDate] = useState<string | null>(start?.party_ref_date ?? null);
  const [lines, setLines] = useState<LineDraft[]>(() => (start?.lines.length ? start.lines.map(toDraft) : [emptyLine()]));
  const [shipTo, setShipTo] = useState<ShipTo | null>(() => {
    const a = start?.shipping_address;
    return a ? { label: a.label, address: a.address ?? "", city: a.city ?? "", pincode: a.pincode, state_code: a.state_code ?? party?.state_code ?? "" } : null;
  });
  const [challanType, setChallanType] = useState<string | null>(start?.challan_type ?? null);
  const [noteReason, setNoteReason] = useState<string | null>(start?.note_reason ?? null);
  const [vehicle, setVehicle] = useState(start?.vehicle_no ?? "");
  const [transporter, setTransporter] = useState(start?.transporter ?? "");
  const [eway, setEway] = useState(start?.eway_bill_no ?? "");
  const [reverse, setReverse] = useState(start?.reverse_charge ?? false);
  const [cancelling, setCancelling] = useState(false);
  const [terms, setTerms] = useState(start?.terms ?? "");
  const [notes, setNotes] = useState(start?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function run(action: () => Promise<Doc>, message: string) {
    setBusy(true);
    try {
      const result = await action();
      setErrors({});
      ToastQueue.positive(message, { timeout: 5000 });
      return result;
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** True once saved. */
  async function save(): Promise<boolean> {
    if (!party) return false; // the required party field stops the submit first
    const body = linesBody(lines);
    if (Object.keys(body.errors).length) {
      setErrors(body.errors);
      return false;
    }
    if (!body.lines.length) {
      // The server would say so too, but on "lines", which has no field to show it next to.
      ToastQueue.negative("Add at least one line.", { timeout: 5000 });
      return false;
    }
    const json: Body = {
      party_id: party.id, date, due_date: due, party_ref: ref.trim() || null, party_ref_date: refDate, terms, notes, lines: body.lines,
      ...(config.shipTo && { shipping_address: shipTo }),
      ...(config.challanTypes && { challan_type: challanType as Body["challan_type"] }),
      ...(config.noteReasons && { note_reason: noteReason as Body["note_reason"] }),
      ...(config.transport && { vehicle_no: vehicle.trim() || null, transporter: transporter.trim() || null, eway_bill_no: eway.trim() || null }),
      ...(config.reverseCharge && { reverse_charge: reverse }),
    };
    const result = await run(() => (doc ? api.update(String(doc.id), json) : api.create(json)), doc ? `${capital(label)} saved.` : `${capital(label)} created.`);
    if (!result) return false;
    if (doc) onSaved(result);
    else navigate(`${config.listPath}/${result.id}`, { replace: true });
    return true;
  }

  async function move(to: string) {
    if (!doc) return;
    if (!readOnly && !(await save())) return; // a draft's unsaved edits go with it, not lost
    const result = await run(() => api.move(String(doc.id), to), `${capital(label)} ${doc.number} marked ${config.statuses[to]!.label.toLowerCase()}.`);
    if (result) onSaved(result);
  }

  const moves = doc && canWrite ? (config.moves[status] ?? []) : [];
  // Cancelling is final and rare: it lives in the ⋯ menu, never beside the everyday buttons.
  const buttonMoves = moves.filter((to) => to !== "cancelled");
  const menuMoves = moves.filter((to) => to === "cancelled");
  const canCancel = !!(doc && api.cancel && role === "admin" && status !== "cancelled");
  const converts = doc && canWrite ? (config.converts ?? []).filter((c) => c.when.includes(status)) : [];
  const statusLabel = config.statuses[status]?.label.toLowerCase() ?? status;
  const moveLabel = (to: string) => config.moveLabels[to] ?? config.statuses[to]?.label ?? to;
  /** A final move asks "are you sure?" first. */
  async function ask(to: string) {
    if (doc && (FINAL.has(to) || config.confirm?.includes(to))) {
      const sure = await confirm({
        title: `Mark ${label} ${doc.number} as ${config.statuses[to]?.label.toLowerCase() ?? to}?`,
        content: "This can't be undone.",
        confirmButtonContent: moveLabel(to),
        cancelButtonContent: "Keep it",
        confirmButtonType: "danger",
      });
      if (!sure) return;
    }
    await move(to);
  }
  // One accent button per screen: the next step if there is one, else Save.
  const accentMove = buttonMoves.find((to) => !FINAL.has(to));

  const header = (
    <PageHeader
      back={{ href: config.listPath, label: `Back to ${config.plural}` }}
      eyebrow={doc ? capital(label) : "New"}
      title={doc ? (doc.number ?? "(draft)") : label}
      badge={doc && <StatusBadge statuses={config.statuses} status={status} />}
      actions={
        <>
          {doc && config.printPath && (
            <LinkButton href={config.printPath(doc.id)} size="small">
              Print
            </LinkButton>
          )}
          {converts.map((cv) => (
            <LinkButton key={cv.label} href={cv.href(doc!)} size="small">
              {cv.label}
            </LinkButton>
          ))}
          {!readOnly && (
            <Button type="submit" form="document-form" variant={accentMove ? "default" : "primary"} size="small" loading={busy}>
              Save
            </Button>
          )}
          {buttonMoves.map((to) => (
            <Button key={to} variant={to === accentMove ? "primary" : "default"} size="small" disabled={busy} onClick={() => void ask(to)}>
              {moveLabel(to)}
            </Button>
          ))}
          {(menuMoves.length > 0 || canCancel) && (
            <ActionMenu>
              <ActionMenu.Anchor>
                <IconButton icon={KebabHorizontalIcon} aria-label="More actions" size="small" disabled={busy} />
              </ActionMenu.Anchor>
              <ActionMenu.Overlay align="end">
                <ActionList>
                  {menuMoves.map((to) => (
                    <ActionList.Item key={to} onSelect={() => void ask(to)}>
                      {moveLabel(to)}
                    </ActionList.Item>
                  ))}
                  {canCancel && (
                    <ActionList.Item variant="danger" onSelect={() => setCancelling(true)}>
                      {`Cancel ${label}…`}
                    </ActionList.Item>
                  )}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          )}
        </>
      }
    />
  );

  const notes_ = (
    <>
      {!canWrite && <p className={note}>You can view {config.plural}; ask an accountant or admin to change them.</p>}
      {canWrite && status !== "draft" && <p className={note}>This {label} is {statusLabel}, so it can't be edited.</p>}
      {doc?.cancel_reason && <p className={note}>Cancelled{doc.cancelled_at ? ` on ${new Date(doc.cancelled_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}: {doc.cancel_reason}. Its number stays used.</p>}
      {draft && <p className={note}>Made from {draft.lines.length === 1 ? "1 pending line" : `${draft.lines.length} pending lines`}. Change quantities to take less, or remove lines you don't need now.</p>}
    </>
  );
  const lineItems = <LineItems lines={lines} onChange={setLines} side={config.side} isReadOnly={readOnly} rejected={config.rejected} totals={{ type: config.type, companyState, partyState: party?.state_code ?? null, placeOfSupply: (config.shipTo && shipTo?.state_code) || null }} />;

  return (
    <div className={formPage}>
      {header}
      {notes_}
      {readOnly && doc ? (
        <section className={c.paper} aria-label={`${capital(label)} ${doc.number ?? ""}`.trim()}>
          <div className={c.parties}>
            <div>
              <p className={factLabel}>{config.partyLabel}</p>
              <p className={c.partyName}>{doc.party_name}</p>
              <p className={c.partyMeta}>{[doc.party_gstin ?? "Unregistered", doc.billing_address?.city].filter(Boolean).join(" · ")}</p>
              {doc.billing_address?.address && <p className={c.partyMeta}>{[doc.billing_address.address, doc.billing_address.pincode].filter(Boolean).join(" ")}</p>}
            </div>
            <dl className={c.facts}>
              <Fact label="Date">{shortDate(doc.date)}</Fact>
              {config.dueLabel && <Fact label={config.dueLabel}>{shortDate(doc.due_date)}</Fact>}
              {config.refLabels && <Fact label={config.refLabels.ref}>{doc.party_ref}</Fact>}
              {config.refLabels && <Fact label={config.refLabels.date}>{shortDate(doc.party_ref_date)}</Fact>}
              {config.shipTo && <Fact label="Ship to">{doc.shipping_address ? [doc.shipping_address.label, doc.shipping_address.address, doc.shipping_address.city].filter(Boolean).join(", ") : "Same as billing address"}</Fact>}
              {config.challanTypes && <Fact label="Challan type">{doc.challan_type ? config.challanTypes[doc.challan_type] : ""}</Fact>}
              {config.noteReasons && <Fact label="Reason">{doc.note_reason ? config.noteReasons[doc.note_reason] : ""}</Fact>}
              {config.transport && <Fact label="Vehicle no.">{doc.vehicle_no}</Fact>}
              {config.transport && <Fact label="Transporter">{doc.transporter}</Fact>}
              {config.transport && <Fact label="E-way bill no.">{doc.eway_bill_no}</Fact>}
              {config.reverseCharge && doc.reverse_charge && <Fact label="Reverse charge">Yes, the customer pays the GST</Fact>}
            </dl>
          </div>
          {lineItems}
          {(doc.terms || doc.notes) && (
            <div className={c.footer}>
              {doc.terms && (
                <div>
                  <h2 className={c.sectionTitle}>Terms</h2>
                  <p className={c.prose}>{doc.terms}</p>
                </div>
              )}
              {doc.notes && (
                <div>
                  <h2 className={c.sectionTitle}>Notes</h2>
                  <p className={c.prose}>{doc.notes}</p>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <Form id="document-form" errors={errors} className={c.form} onSubmit={() => void save()}>
          <EnterSubmits />
          <div className={fieldGrid}>
            <Cell wide>
              <PartyPicker
                label={config.partyLabel}
                kind={config.partyKind}
                party={party}
                onPick={(p) => {
                  setParty(p);
                  setShipTo(null); // the last party's address isn't this one's
                }}
                isRequired
                isReadOnly={readOnly || !!draft}
                autoFocus={!doc && !draft && !readOnly}
              />
            </Cell>
            <Cell>
              <DateField label="Date" name="date" isRequired isReadOnly={readOnly} value={date} onChange={(v) => v && setDate(v)} />
            </Cell>
            {config.dueLabel && (
              <Cell>
                <DateField label={config.dueLabel} name="due_date" isReadOnly={readOnly} value={due} onChange={setDue} />
              </Cell>
            )}
            {config.refLabels && (
              <Cell>
                <TextField label={config.refLabels.ref} name="party_ref" isReadOnly={readOnly} value={ref} onChange={setRef} />
              </Cell>
            )}
            {config.refLabels && (
              <Cell>
                <DateField label={config.refLabels.date} name="party_ref_date" isReadOnly={readOnly} value={refDate} onChange={setRefDate} />
              </Cell>
            )}
            {config.shipTo && (
              <Cell wide>
                <ShipToPicker partyId={party?.id ?? null} value={shipTo} onChange={setShipTo} isReadOnly={readOnly} />
              </Cell>
            )}
            {config.noteReasons && (
              <Cell>
                <SelectField label="Reason" name="note_reason" isRequired isDisabled={readOnly} placeholder="Choose a reason" value={noteReason} onChange={setNoteReason} options={config.noteReasons} />
              </Cell>
            )}
            {config.challanTypes && (
              <Cell>
                <SelectField label="Challan type" name="challan_type" isRequired isDisabled={readOnly} placeholder="Choose a type" value={challanType} onChange={setChallanType} options={config.challanTypes} />
              </Cell>
            )}
            {config.transport && (
              <>
                <Cell>
                  <TextField label="Vehicle no." name="vehicle_no" isReadOnly={readOnly} value={vehicle} onChange={setVehicle} />
                </Cell>
                <Cell>
                  <TextField label="Transporter" name="transporter" isReadOnly={readOnly} value={transporter} onChange={setTransporter} />
                </Cell>
                <Cell>
                  <TextField label="E-way bill no." name="eway_bill_no" inputMode="numeric" isReadOnly={readOnly} value={eway} onChange={setEway} />
                </Cell>
              </>
            )}
            {config.reverseCharge && (
              <Cell check>
                <CheckboxField label="Reverse charge (customer pays GST)" name="reverse_charge" isSelected={reverse} onChange={setReverse} isReadOnly={readOnly} />
              </Cell>
            )}
          </div>
          {lineItems}
          <div className={c.footer}>
            <TextAreaField label="Terms" name="terms" description={config.termsHelp} isReadOnly={readOnly} value={terms} onChange={setTerms} />
            <TextAreaField label="Notes" name="notes" description="Internal: not printed." isReadOnly={readOnly} value={notes} onChange={setNotes} />
          </div>
        </Form>
      )}
      {doc && cancelling && api.cancel && (
        <CancelDialog
          title={`Cancel ${label} ${doc.number}?`}
          onClose={() => setCancelling(false)}
          onCancel={async (reason) => {
            const result = await run(() => api.cancel!(String(doc.id), reason), `${capital(label)} ${doc.number} cancelled.`);
            if (result) onSaved(result);
            return !!result;
          }}
        />
      )}
      {doc && config.progress && status !== "draft" && (
        <section aria-label="Progress">
          <h2 className={c.sectionTitle}>{config.progress} so far</h2>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Item</th>
                <th className={c.thEnd}>Ordered</th>
                <th className={c.thEnd}>{config.progress}</th>
                <th className={c.thEnd}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.id}>
                  <td className={c.td}>{l.item_name}</td>
                  <td className={c.tdEnd}>{`${formatQty(l.qty, l.unit_decimals)} ${l.unit}`}</td>
                  <td className={c.tdEnd}>{`${formatQty(l.qty - l.pending, l.unit_decimals)} ${l.unit}`}</td>
                  <td className={c.tdEnd}>{`${formatQty(l.pending, l.unit_decimals)} ${l.unit}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
