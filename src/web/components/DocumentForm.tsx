// One document's screen (new, or open by id): party, date, due date and the party's reference,
// lines with live totals, terms and notes; Save while it's a draft, then its status moves. A new one
// can start from source documents (?from=12,15: an order from quotations…). Anything past draft, or
// seen by someone who can't write it, is read-only. Each type's page passes its API and labels.
import { parseDate } from "@internationalized/date";
import { Button } from "@react-spectrum/s2/Button";
import { DatePicker } from "@react-spectrum/s2/DatePicker";
import { Form } from "@react-spectrum/s2/Form";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextArea } from "@react-spectrum/s2/TextArea";
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import type { InferResponseType } from "hono/client";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { todayInIndia } from "../../shared/fy.ts";
import { formatRupees } from "../../shared/money.ts";
import { formatQty } from "../../shared/quantity.ts";
import type { DocumentType } from "../../shared/schemas/document.ts";
import { ApiError, type client } from "../api.ts";
import { useUser } from "../auth.tsx";
import { companyAtom } from "../state.ts";
import { StatusBadge, type StatusInfo } from "./DocumentList.tsx";
import { emptyLine, type LineDraft, LineItems, linesBody } from "./LineItems.tsx";
import { type PickedParty, PartyPicker } from "./PartyPicker.tsx";

/** A saved document as GET /api/<documents>/:id returns it (documents/get.sql + pending per line). */
export type Doc = InferResponseType<(typeof client.api.quotations)[":id"]["$get"], 200>;
/** A new draft from source documents (GET /api/<documents>/new?from=…). */
export type Draft = InferResponseType<(typeof client.api)["sales-orders"]["new"]["$get"], 200>;
export type Body = { party_id: number; date: string; due_date: string | null; party_ref: string | null; party_ref_date: string | null; terms: string; notes: string; lines: ReturnType<typeof linesBody>["lines"] };

export type DocApi = {
  get: (id: string) => Promise<Doc>;
  create: (json: Body) => Promise<Doc>;
  update: (id: string, json: Body) => Promise<Doc>;
  move: (id: string, status: string) => Promise<Doc>;
  draftFrom?: (from: string) => Promise<Draft>;
};

export type DocConfig = {
  type: DocumentType;
  label: string; // "quotation"
  plural: string; // "quotations"
  listPath: string; // "/sales/quotations"
  api: DocApi;
  partyLabel: string; // "Customer"
  partyKind: "customer" | "supplier";
  side: "sale" | "purchase";
  statuses: StatusInfo;
  moves: Partial<Record<string, readonly string[]>>;
  moveLabels: Record<string, string>; // the button for each move: { sent: "Mark as sent" }
  dueLabel: string; // what due_date means here: "Valid until", "Deliver by"
  refLabels?: { ref: string; date: string }; // party_ref and its date: "Customer PO no.", "PO date"
  termsHelp?: string;
  printPath?: (id: number) => string;
  progress?: string; // for an order: the column for what's been converted ("Delivered")
  converts?: { label: string; when: readonly string[]; href: (doc: Doc) => string }[]; // "Create sales order" on a sent quotation
  writers?: string[];
};

const page = style({ display: "flex", flexDirection: "column", gap: 24 });
const head = style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" });
const title = style({ font: "heading-xl", margin: 0 });
const row = style({ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "start" });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const actions = style({ display: "flex", gap: 12, flexWrap: "wrap" });
const narrow = style({ maxWidth: 720 });
const sectionTitle = style({ font: "heading-sm", margin: 0 });
const table = style({ borderCollapse: "collapse", font: "body", width: "full", maxWidth: 720 });
const th = style({ font: "ui-sm", color: "gray-700", textAlign: "start", paddingX: 8, paddingY: 4 });
const thEnd = style({ font: "ui-sm", color: "gray-700", textAlign: "end", paddingX: 8, paddingY: 4 });
const td = style({ paddingX: 8, paddingY: 4, borderTopWidth: 1, borderTopStyle: "solid", borderColor: "gray-200" });
const tdEnd = style({ paddingX: 8, paddingY: 4, borderTopWidth: 1, borderTopStyle: "solid", borderColor: "gray-200", textAlign: "end", fontVariantNumeric: "tabular-nums" });
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const rupees = (paise: number) => (paise ? formatRupees(paise).replaceAll(",", "") : "");

type LineSource = Pick<Doc["lines"][number], "item_id" | "item_code" | "item_name" | "hsn" | "unit" | "unit_decimals" | "gst_rate" | "rate" | "description" | "qty" | "discount_bp" | "from_line_id">;
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
  };
}

/** /<list>/new, /<list>/new?from=…, /<list>/:id */
export function DocumentForm(config: DocConfig) {
  const { id } = useParams();
  const from = useSearchParams()[0].get("from");
  const [doc, setDoc] = useState<Doc | Draft | null | "missing">(null);
  useEffect(() => {
    setDoc(null);
    const load = id ? config.api.get(id) : from && config.api.draftFrom ? config.api.draftFrom(from) : null;
    load?.then(setDoc, () => setDoc("missing")); // failures toast
  }, [id, from]); // eslint-disable-line react-hooks/exhaustive-deps -- the API is fixed per page
  const company = useAtomValue(companyAtom);

  if (doc === "missing") return <p className={note}>This {config.label} couldn't be loaded. Go back to the list and try again.</p>;
  const loading = id || (from && config.api.draftFrom);
  if (!company || (loading && !doc)) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  const saved = doc && "id" in doc ? doc : null;
  const draft = doc && !("id" in doc) ? doc : null;
  // key: after a save or status change the editor starts again from what the server returned.
  return <Editor key={saved ? `${saved.id}:${saved.updated_at}` : `new:${from ?? ""}`} config={config} doc={saved} draft={draft} companyState={company.state_code} onSaved={setDoc} />;
}

function Editor({ config, doc, draft, companyState, onSaved }: { config: DocConfig; doc: Doc | null; draft: Draft | null; companyState: string; onSaved: (d: Doc) => void }) {
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
  const [terms, setTerms] = useState(start?.terms ?? "");
  const [notes, setNotes] = useState(start?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

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
    const json: Body = { party_id: party.id, date, due_date: due, party_ref: ref.trim() || null, party_ref_date: refDate, terms, notes, lines: body.lines };
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
  const converts = doc && canWrite ? (config.converts ?? []).filter((c) => c.when.includes(status)) : [];
  const statusLabel = config.statuses[status]?.label.toLowerCase() ?? status;
  return (
    <div className={page}>
      <div className={head}>
        <h1 className={title}>{doc ? `${capital(label)} ${doc.number}` : `New ${label}`}</h1>
        {doc && <StatusBadge statuses={config.statuses} status={status} />}
      </div>
      {!canWrite && <p className={note}>You can view {config.plural}; ask an accountant or admin to change them.</p>}
      {canWrite && status !== "draft" && <p className={note}>This {label} is {statusLabel}, so it can't be edited.</p>}
      {draft && <p className={note}>Made from {draft.lines.length === 1 ? "1 pending line" : `${draft.lines.length} pending lines`}. Change quantities to take less, or remove lines you don't need now.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={row}>
          <PartyPicker label={config.partyLabel} kind={config.partyKind} party={party} onPick={setParty} isRequired isReadOnly={readOnly || !!draft} autoFocus={!doc && !draft && !readOnly} />
          <DatePicker label="Date" name="date" isRequired isReadOnly={readOnly} value={parseDate(date)} onChange={(v) => v && setDate(v.toString())} styles={style({ width: 180 })} />
          <DatePicker label={config.dueLabel} name="due_date" isReadOnly={readOnly} value={due ? parseDate(due) : null} onChange={(v) => setDue(v?.toString() ?? null)} styles={style({ width: 180 })} />
        </div>
        {config.refLabels && (
          <div className={row}>
            <TextField label={config.refLabels.ref} name="party_ref" isReadOnly={readOnly} value={ref} onChange={setRef} styles={style({ width: 240 })} />
            <DatePicker label={config.refLabels.date} name="party_ref_date" isReadOnly={readOnly} value={refDate ? parseDate(refDate) : null} onChange={(v) => setRefDate(v?.toString() ?? null)} styles={style({ width: 180 })} />
          </div>
        )}
        <LineItems lines={lines} onChange={setLines} side={config.side} isReadOnly={readOnly} totals={{ type: config.type, companyState, partyState: party?.state_code ?? null, placeOfSupply: null }} />
        <div className={narrow}>
          <TextArea label="Terms" name="terms" description={config.termsHelp} isReadOnly={readOnly} value={terms} onChange={setTerms} styles={style({ width: "full" })} />
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
            <Button key={to} variant={moves[0] === to && to !== "cancelled" ? "accent" : "secondary"} /* cancelling is final: never the primary button */ isDisabled={busy} onPress={() => void move(to)}>
              {config.moveLabels[to] ?? config.statuses[to]?.label ?? to}
            </Button>
          ))}
          {converts.map((c) => (
            <LinkButton key={c.label} href={c.href(doc!)} variant="secondary">
              {c.label}
            </LinkButton>
          ))}
          {doc && config.printPath && (
            <LinkButton href={config.printPath(doc.id)} variant="secondary">
              Print
            </LinkButton>
          )}
          <LinkButton href={config.listPath} variant="secondary">
            {readOnly ? `Back to ${config.plural}` : "Cancel"}
          </LinkButton>
        </div>
      </Form>
      {doc && config.progress && status !== "draft" && (
        <section aria-label="Progress">
          <h2 className={sectionTitle}>{config.progress} so far</h2>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Item</th>
                <th className={thEnd}>Ordered</th>
                <th className={thEnd}>{config.progress}</th>
                <th className={thEnd}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.id}>
                  <td className={td}>{l.item_name}</td>
                  <td className={tdEnd}>{`${formatQty(l.qty, l.unit_decimals)} ${l.unit}`}</td>
                  <td className={tdEnd}>{`${formatQty(l.qty - l.pending, l.unit_decimals)} ${l.unit}`}</td>
                  <td className={tdEnd}>{`${formatQty(l.pending, l.unit_decimals)} ${l.unit}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
