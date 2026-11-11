// The REST API one document type gets (FR-4, FR-5): list for an FY with search and filters, get
// (each line with what's still pending to convert), create, update a draft, move status, and a
// draft made from source documents (/new?from=1,2). Everyone signed in reads; admins and
// accountants write unless `writers` says otherwise. Saving goes through the document service.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import type { DocumentInput, DocumentType } from "../../shared/schemas/document.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import type { Role } from "../auth/oidc.ts";
import { currentCompanyId } from "../company/routes.ts";
import { escapeLike } from "../db.ts";
import { ConflictError, NotFoundError, validate } from "../errors.ts";
import { draftFrom, pendingLines, SOURCES } from "./convert.ts";
import getQuery from "./get.sql";
import listQuery from "./list.sql";
import { saveDocument } from "./service.ts";
import setStatus from "./set_status.sql";

type Status = Parameters<typeof setStatus.run>[1]["status"];
type Config<K extends string, S extends Status> = {
  type: DocumentType;
  label: string; // "quotation", "sales order": used in messages
  key: K; // the list's array: { quotations: [...] }
  input: z.ZodType<DocumentInput, unknown>;
  statuses: readonly [S, ...S[]];
  moves: Partial<Record<S, readonly S[]>>;
  writers?: [Role, ...Role[]];
};

const date = z.iso.date();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const ids = z.string().regex(/^\d+(,\d+)*$/, "A comma-separated list of document ids.").transform((s) => [...new Set(s.split(",").map(Number))]);

export function documentRoutes<K extends string, S extends Status>(db: SQL, { type, label, key, input, statuses, moves, writers = ["admin", "accountant"] }: Config<K, S>) {
  const canWrite = requireRole(...writers);
  const Label = label[0]!.toUpperCase() + label.slice(1);
  const listParams = z
    .object({
      fy: z.coerce.number().int().min(2000).max(2999),
      q: z.string().max(100).optional(),
      status: z.enum(statuses).optional(),
      party_id: z.coerce.number().int().positive().optional(),
      from: date.optional(),
      to: date.optional(),
      page: z.coerce.number().int().min(1).default(1),
      page_size: z.coerce.number().int().min(1).max(200).default(50),
    })
    .refine((p) => !p.from || !p.to || p.from <= p.to, { path: ["to"], message: "The end date is before the start date." });
  const statusBody = z.object({ status: z.enum(statuses) });

  const found = async (companyId: number, id: number) => {
    const doc = await getQuery.run(db, { company_id: companyId, id });
    if (!doc || doc.type !== type) throw new NotFoundError(`${Label} ${id} not found.`);
    const pending = new Map((await pendingLines(db, { companyId, documentIds: [id] })).map((l) => [l.id, l.pending]));
    return { ...doc, lines: doc.lines.map((l) => ({ ...l, pending: pending.get(l.id) ?? 0 })) };
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listParams), async (c) => {
      const { fy, q, status, party_id, from, to, page, page_size } = c.req.valid("query");
      const rows = await listQuery.run(db, {
        company_id: await currentCompanyId(db),
        type,
        fy,
        q: q?.trim() ? escapeLike(q.trim()) : null,
        status: status ?? null,
        party_id: party_id ?? null,
        date_from: from ?? null,
        date_to: to ?? null,
        limit: page_size,
        offset: (page - 1) * page_size,
      });
      const list = rows.map(({ total: _, ...r }) => r);
      return c.json({ total: rows[0]?.total ?? 0, page, page_size, ...({ [key]: list } as Record<K, typeof list>) });
    })
    // A new draft from issued source documents of one party (quotations for an order…), to edit and POST.
    .get("/new", canWrite, validate("query", z.object({ from: ids })), async (c) => {
      if (!SOURCES[type]) throw new NotFoundError(`A ${label} isn't made from other documents.`);
      return c.json(await draftFrom(db, { companyId: await currentCompanyId(db), type, sourceIds: c.req.valid("query").from }));
    })
    .get("/:id", validate("param", idParam), async (c) => c.json(await found(await currentCompanyId(db), c.req.valid("param").id)))
    .post("/", canWrite, validate("json", input), async (c) => {
      const companyId = await currentCompanyId(db);
      const id = await saveDocument(db, { companyId, userId: c.get("user").id, doc: c.req.valid("json") });
      return c.json(await found(companyId, id), 201);
    })
    .put("/:id", canWrite, validate("param", idParam), validate("json", input), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      await found(companyId, id); // one of this type, not some other document's id
      await saveDocument(db, { companyId, userId: c.get("user").id, id, doc: c.req.valid("json") });
      return c.json(await found(companyId, id));
    })
    .post("/:id/status", canWrite, validate("param", idParam), validate("json", statusBody), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const { status: from } = await found(companyId, id);
      const allowed: readonly string[] = moves[from as S] ?? [];
      if (!allowed.includes(status)) {
        if (allowed.length) throw new ConflictError(`A ${from} ${label} can be marked ${allowed.join(" or ")}, not ${status}.`);
        throw new ConflictError(from === "draft" ? `A draft ${label} can't change status yet.` : `This ${label} is ${from}; its status is final.`);
      }
      if (!(await setStatus.run(db, { company_id: companyId, id, type, from, status }))) throw new ConflictError(`This ${label} was just changed by someone else. Reload it and try again.`);
      return c.json(await found(companyId, id));
    });
}
