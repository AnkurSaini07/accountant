// Saves a draft document of any type with its lines, all in one transaction: the header, a fresh
// set of lines (an update replaces them), and the amounts, worked out here by documentTotals and
// never taken from the client. A new document takes its number from the series in the same
// transaction (FR-1.4). Drafts are never deleted (only cancelled), so numbers stay consecutive.
// Only drafts can be saved; once issued a document is changed by its own actions (finalize, cancel).
import type { SQL } from "bun";
import { fyLabel, fyOf } from "../../shared/fy.ts";
import type { DocumentInput } from "../../shared/schemas/document.ts";
import { ConflictError, NotFoundError, onConstraint, ValidationError } from "../errors.ts";
import { nextNumber } from "../series/series.ts";
import deleteLines from "./delete_lines.sql";
import insertQuery from "./insert.sql";
import insertLines from "./insert_lines.sql";
import lineItems from "./line_items.sql";
import lockQuery from "./lock.sql";
import setTotals from "./set_totals.sql";
import { documentTotals } from "./totals.ts";
import updateQuery from "./update.sql";

export type { DocumentInput } from "../../shared/schemas/document.ts";

const CONSTRAINTS = { documents_party_id_fkey: ["party_id", "Choose a party from the list."] } satisfies Record<string, [string, string]>;

/**
 * Creates (no `id`) or replaces a draft; returns its id. Throws NotFoundError for an unknown id,
 * ConflictError for a document that isn't a draft, ValidationError for fields the database refuses.
 */
export function saveDocument(db: SQL, { companyId, userId, id, doc }: { companyId: number; userId: number | null; id?: number; doc: DocumentInput }): Promise<number> {
  const { lines, ...header } = doc;
  const fy = fyOf(header.date);
  return onConstraint(CONSTRAINTS, () =>
    db.begin(async (tx) => {
      // Every line's item must be this company's: say which line, not just "an item".
      const items = new Map((await lineItems.run(tx, { company_id: companyId, ids: lines.map((l) => l.item_id) })).map((i) => [i.id, i]));
      const missing = Object.fromEntries(lines.flatMap((l, i) => (items.has(l.item_id) ? [] : [[`lines.${i}.item_id`, ["Choose an item from the list."]]])));
      if (Object.keys(missing).length) throw new ValidationError("Some lines name an item that isn't in the list.", missing);

      const fields = header;
      let saved;
      if (id === undefined) {
        const number = await nextNumber(tx, { companyId, docType: header.type, date: header.date });
        [saved] = await insertQuery.run(tx, { ...fields, company_id: companyId, fy, number, created_by: userId });
      } else {
        const current = await lockQuery.run(tx, { company_id: companyId, id });
        if (!current) throw new NotFoundError(`Document ${id} not found.`);
        if (current.status !== "draft") throw new ConflictError(`This document is ${current.status}; only drafts can be edited.`);
        if (current.type !== header.type) throw new ValidationError("A document can't change type.", { type: ["A document can't change type."] });
        // Its number belongs to its FY's series.
        if (current.fy !== fy) throw new ValidationError("The date must stay in its financial year.", { date: [`Keep the date in FY ${fyLabel(current.fy)}; its number is from that year.`] });
        const { type: _, ...rest } = fields;
        [saved] = await updateQuery.run(tx, { ...rest, company_id: companyId, id }); // locked as a draft above, so a row
        await deleteLines.run(tx, { document_id: id });
      }

      if (!saved) throw new Error("Saving the document header returned no row.");
      let totals;
      try {
        totals = documentTotals({
          type: header.type,
          companyState: saved.company_state!, // companies.state_code is not null
          partyState: saved.party_state_code,
          placeOfSupply: saved.place_of_supply,
          lines: lines.map((l) => ({ ...l, ...items.get(l.item_id)! })),
        });
      } catch (e) {
        // calculateGst names the line ("Line 2: HSN/SAC must be …"); the HSN comes from the item.
        const n = /^Line (\d+): (.*)$/.exec((e as Error).message);
        if (!(e instanceof RangeError) || !n) throw e;
        throw new ValidationError(n[2]!, { [`lines.${Number(n[1]) - 1}.item_id`]: [`${n[2]} Add it to the item first.`] });
      }
      await insertLines.run(tx, { document_id: saved.id, rows: lines.map((l, i) => ({ ...l, ...totals.lines[i] })) });
      const { lines: _l, hsn_summary: _h, sgst_label: _s, ...sums } = totals;
      await setTotals.run(tx, { id: saved.id, ...sums });
      return saved.id;
    }),
  );
}
