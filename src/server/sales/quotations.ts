// /api/quotations (FR-4.1): everyone signed in reads; admins and accountants write (REQUIREMENTS §2:
// operators make challans and GRNs, not quotations). Saving goes through the document service
// (numbering, lines, server-side totals); status moves are Draft → Sent → Accepted / Rejected / Expired.
// ponytail: list/get/save wiring is written for quotations only; extract it when sales orders (#44) need the same.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { QUOTATION_MOVES, QUOTATION_STATUSES, quotationInput } from "../../shared/schemas/document.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { escapeLike } from "../db.ts";
import getQuery from "../documents/get.sql";
import listQuery from "../documents/list.sql";
import { saveDocument } from "../documents/service.ts";
import setStatus from "../documents/set_status.sql";
import { ConflictError, NotFoundError, validate } from "../errors.ts";

const TYPE = "quotation";
const canWrite = requireRole("admin", "accountant");
const date = z.iso.date();
const listParams = z
  .object({
    fy: z.coerce.number().int().min(2000).max(2999),
    q: z.string().max(100).optional(),
    status: z.enum(QUOTATION_STATUSES).optional(),
    party_id: z.coerce.number().int().positive().optional(),
    from: date.optional(),
    to: date.optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine((p) => !p.from || !p.to || p.from <= p.to, { path: ["to"], message: "The end date is before the start date." });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const statusBody = z.object({ status: z.enum(QUOTATION_STATUSES) });

export function quotationRoutes(db: SQL) {
  const found = async (companyId: number, id: number) => {
    const doc = await getQuery.run(db, { company_id: companyId, id });
    if (!doc || doc.type !== TYPE) throw new NotFoundError(`Quotation ${id} not found.`);
    return doc;
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listParams), async (c) => {
      const { fy, q, status, party_id, from, to, page, page_size } = c.req.valid("query");
      const rows = await listQuery.run(db, {
        company_id: await currentCompanyId(db),
        type: TYPE,
        fy,
        q: q?.trim() ? escapeLike(q.trim()) : null,
        status: status ?? null,
        party_id: party_id ?? null,
        date_from: from ?? null,
        date_to: to ?? null,
        limit: page_size,
        offset: (page - 1) * page_size,
      });
      return c.json({ total: rows[0]?.total ?? 0, quotations: rows.map(({ total: _, ...r }) => r), page, page_size });
    })
    .get("/:id", validate("param", idParam), async (c) => c.json(await found(await currentCompanyId(db), c.req.valid("param").id)))
    .post("/", canWrite, validate("json", quotationInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const id = await saveDocument(db, { companyId, userId: c.get("user").id, doc: c.req.valid("json") });
      return c.json(await found(companyId, id), 201);
    })
    .put("/:id", canWrite, validate("param", idParam), validate("json", quotationInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      await found(companyId, id); // a quotation, not some other document's id
      await saveDocument(db, { companyId, userId: c.get("user").id, id, doc: c.req.valid("json") });
      return c.json(await found(companyId, id));
    })
    .post("/:id/status", canWrite, validate("param", idParam), validate("json", statusBody), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const { status: from } = await found(companyId, id);
      const allowed: readonly string[] = QUOTATION_MOVES[from as keyof typeof QUOTATION_MOVES] ?? [];
      if (!allowed.includes(status)) {
        throw new ConflictError(allowed.length ? `A ${from} quotation can be marked ${allowed.join(" or ")}, not ${status}.` : `This quotation is ${from}; its status is final.`);
      }
      if (!(await setStatus.run(db, { company_id: companyId, id, type: TYPE, from, status }))) throw new ConflictError("This quotation was just changed by someone else. Reload it and try again.");
      return c.json(await found(companyId, id));
    });
}
