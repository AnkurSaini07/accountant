// Sales → Quotations → New / open (FR-4.1): party, date, validity, lines, terms and notes. A draft is
// edited and saved; then marked Sent, and a sent one Accepted, Rejected or Expired. Anything past
// draft, or seen by someone who can't write quotations, is read-only.
import { parseDate } from "@internationalized/date";
import { Badge } from "@react-spectrum/s2/Badge";
import { Button } from "@react-spectrum/s2/Button";
import { DatePicker } from "@react-spectrum/s2/DatePicker";
import { Form } from "@react-spectrum/s2/Form";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextArea } from "@react-spectrum/s2/TextArea";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import type { InferResponseType } from "hono/client";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { todayInIndia } from "../../../shared/fy.ts";
import { formatRupees } from "../../../shared/money.ts";
import { formatQty } from "../../../shared/quantity.ts";
import { QUOTATION_MOVES } from "../../../shared/schemas/document.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import { emptyLine, type LineDraft, LineItems, linesBody } from "../../components/LineItems.tsx";
import { type PickedParty, PartyPicker } from "../../components/PartyPicker.tsx";
import { companyAtom } from "../../state.ts";
import { STATUS_BADGE, STATUS_LABELS } from "./QuotationList.tsx";

type Quotation = InferResponseType<(typeof client.api.quotations)[":id"]["$get"], 200>;
type Status = keyof typeof STATUS_LABELS;
type Move = Exclude<Status, "draft">;

const LIST = "/sales/quotations";
const MOVE_LABELS: Record<Move, string> = { sent: "Mark as sent", accepted: "Accepted", rejected: "Rejected", expired: "Expired" };
const page = style({ display: "flex", flexDirection: "column", gap: 24 });
const head = style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const row = style({ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "start" });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const actions = style({ display: "flex", gap: 12, flexWrap: "wrap" });
const narrow = style({ maxWidth: 720 });

/** A saved line back into the editor's shape: the line keeps its own (snapshotted) HSN, unit and rate. */
function toDraft(l: Quotation["lines"][number]): LineDraft {
  return {
    ...emptyLine(),
    item: {
      id: l.item_id, code: l.item_code, name: l.item_name, hsn: l.hsn, unit: l.unit, unit_decimals: l.unit_decimals,
      gst_rate: Number(l.gst_rate), sale_price: l.rate, purchase_price: l.rate, type: "finished", active: true,
    },
    description: l.description,
    qty: formatQty(l.qty, l.unit_decimals),
    rate: l.rate ? formatRupees(l.rate).replaceAll(",", "") : "",
    discount: l.discount_bp ? String(l.discount_bp / 100) : "",
  };
}

/** /sales/quotations/new and /sales/quotations/:id */
export function QuotationForm() {
  const { id } = useParams();
  const [doc, setDoc] = useState<Quotation | null | "missing">(null);
  useEffect(() => {
    if (!id) return;
    setDoc(null);
    call(client.api.quotations[":id"].$get({ param: { id } })).then(setDoc, () => setDoc("missing")); // failures toast
  }, [id]);
  const company = useAtomValue(companyAtom);

  if (doc === "missing") return <p className={note}>This quotation couldn't be loaded. Go back to the list and try again.</p>;
  if (!company || (id && !doc)) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  const loaded = id ? (doc as Quotation) : null;
  // key: after a save or status change the editor starts again from what the server returned.
  return <QuotationEditor key={loaded ? `${loaded.id}:${loaded.updated_at}` : "new"} doc={loaded} companyState={company.state_code} onSaved={setDoc} />;
}

function QuotationEditor({ doc, companyState, onSaved }: { doc: Quotation | null; companyState: string; onSaved: (d: Quotation) => void }) {
  const role = useUser().role;
  const canWrite = role === "admin" || role === "accountant";
  const status = (doc?.status ?? "draft") as Status;
  const readOnly = !canWrite || status !== "draft";
  const navigate = useNavigate();

  const [party, setParty] = useState<PickedParty | null>(
    doc && { id: doc.party_id, name: doc.party_name, gstin: doc.party_gstin, city: doc.billing_address?.city ?? null, state_code: doc.party_state_code },
  );
  const [date, setDate] = useState(doc?.date ?? todayInIndia());
  const [validUntil, setValidUntil] = useState<string | null>(doc?.due_date ?? null);
  const [lines, setLines] = useState<LineDraft[]>(() => (doc?.lines.length ? doc.lines.map(toDraft) : [emptyLine()]));
  const [terms, setTerms] = useState(doc?.terms ?? "");
  const [notes, setNotes] = useState(doc?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<Quotation>, message: string) {
    setBusy(true);
    try {
      const saved = await action();
      setErrors({});
      ToastQueue.positive(message, { timeout: 5000 });
      return saved;
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** True once saved. */
  async function save(): Promise<boolean> {
    if (!party) return false; // the required Customer field stops the submit first
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
    const json = { party_id: party.id, date, due_date: validUntil, terms, notes, lines: body.lines };
    const saved = await run(
      () => call(doc ? client.api.quotations[":id"].$put({ param: { id: String(doc.id) }, json }) : client.api.quotations.$post({ json })),
      doc ? "Quotation saved." : "Quotation created.",
    );
    if (!saved) return false;
    if (doc) onSaved(saved);
    else navigate(`${LIST}/${saved.id}`, { replace: true });
    return true;
  }

  async function move(to: Move) {
    if (!doc) return;
    if (!readOnly && !(await save())) return; // a draft's unsaved edits go with it, not lost
    const saved = await run(() => call(client.api.quotations[":id"].status.$post({ param: { id: String(doc.id) }, json: { status: to } })), `Quotation ${doc.number} marked ${STATUS_LABELS[to].toLowerCase()}.`);
    if (saved) onSaved(saved);
  }

  const moves: readonly Move[] = doc && canWrite ? ((QUOTATION_MOVES as Record<string, readonly Move[]>)[status] ?? []) : [];
  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>{doc ? `Quotation ${doc.number}` : "New quotation"}</h1>
        {doc && <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>}
      </div>
      {!canWrite && <p className={note}>You can view quotations; ask an accountant or admin to change them.</p>}
      {canWrite && status !== "draft" && <p className={note}>This quotation is {STATUS_LABELS[status].toLowerCase()}, so it can't be edited.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={row}>
          <PartyPicker label="Customer" kind="customer" party={party} onPick={setParty} isRequired isReadOnly={readOnly} autoFocus={!doc && !readOnly} />
          <DatePicker label="Date" name="date" isRequired isReadOnly={readOnly} value={parseDate(date)} onChange={(v) => v && setDate(v.toString())} styles={style({ width: 180 })} />
          <DatePicker label="Valid until" name="due_date" isReadOnly={readOnly} value={validUntil ? parseDate(validUntil) : null} onChange={(v) => setValidUntil(v?.toString() ?? null)} styles={style({ width: 180 })} />
        </div>
        <LineItems lines={lines} onChange={setLines} side="sale" isReadOnly={readOnly} totals={{ type: "quotation", companyState, partyState: party?.state_code ?? null, placeOfSupply: null }} />
        <div className={narrow}>
          <TextArea label="Terms" name="terms" description="Printed on the quotation: prices, delivery, payment, validity." isReadOnly={readOnly} value={terms} onChange={setTerms} styles={style({ width: "full" })} />
        </div>
        <div className={narrow}>
          <TextArea label="Notes" name="notes" isReadOnly={readOnly} value={notes} onChange={setNotes} styles={style({ width: "full" })} />
        </div>
        <div className={actions}>
          {!readOnly && (
            <Button type="submit" variant="accent" isPending={busy}>
              Save
            </Button>
          )}
          {moves.map((to) => (
            <Button key={to} variant={to === "sent" || to === "accepted" ? "accent" : "secondary"} isDisabled={busy} onPress={() => void move(to)}>
              {MOVE_LABELS[to]}
            </Button>
          ))}
          <LinkButton href={LIST} variant="secondary">
            {readOnly ? "Back to quotations" : "Cancel"}
          </LinkButton>
        </div>
      </Form>
    </div>
  );
}
