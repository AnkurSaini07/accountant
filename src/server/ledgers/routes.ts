// /api/ledger-groups (the chart of accounts tree) and /api/ledgers. Everyone signed in reads;
// accountants and admins write (masters are theirs, REQUIREMENTS §2). Seeded system ledgers are
// read-only (invoices post to them), and party ledgers change only through their party (#37).
// Ledgers are deactivated, never deleted (FR-3.5).
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { ledgerInput } from "../../shared/schemas/ledger.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { escapeLike } from "../db.ts";
import { ConflictError, NotFoundError, onConstraint, ValidationError, validate } from "../errors.ts";
import getQuery from "./get.sql";
import insertQuery from "./insert.sql";
import listQuery from "./list.sql";
import listGroupsQuery from "./list_groups.sql";
import setActiveQuery from "./set_active.sql";
import updateQuery from "./update.sql";

const canWrite = requireRole("admin", "accountant");
const listParams = z.object({
  q: z.string().max(100).optional(),
  include_inactive: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

const uniqueName = (name: string) => ({ ledgers_company_name: ["name", `A ledger named ${name} already exists.`] }) satisfies Record<string, [string, string]>;
const badGroup = () => new ValidationError("Choose a group from the list.", { group_id: ["Choose a group from the list."] });

type Group = Awaited<ReturnType<typeof listGroupsQuery.run>>[number];
export type GroupNode = Omit<Group, "depth"> & { children: GroupNode[] };

/** Rows in tree order (parents before children) → nested primary groups. */
export function nestGroups(rows: Group[]): GroupNode[] {
  const nodes = new Map<number, GroupNode>();
  const roots: GroupNode[] = [];
  for (const { depth: _, ...row } of rows) {
    const node = { ...row, children: [] };
    nodes.set(row.id, node);
    (row.parent_id === null ? roots : nodes.get(row.parent_id)!.children).push(node);
  }
  return roots;
}

export const ledgerGroupRoutes = (db: SQL) =>
  new Hono<AuthEnv>().get("/", async (c) => c.json({ groups: nestGroups(await listGroupsQuery.run(db, { company_id: await currentCompanyId(db) })) }));

export function ledgerRoutes(db: SQL) {
  const found = async (companyId: number, id: number) => {
    const ledger = await getQuery.run(db, { company_id: companyId, id });
    if (!ledger) throw new NotFoundError(`Ledger ${id} not found.`);
    return ledger;
  };
  // System ledgers: the database refuses too (protect_system), this makes it a clear 409, not a 500.
  // Party ledgers follow their party (sync_party_ledger), so they change from the party.
  const editable = async (companyId: number, id: number) => {
    const ledger = await found(companyId, id);
    if (ledger.is_system) throw new ConflictError(`${ledger.name} is a system ledger and can't be changed.`);
    if (ledger.party_id !== null) throw new ConflictError(`${ledger.name} is a party's ledger: change the party in Masters → Parties.`);
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listParams), async (c) => {
      const { q, include_inactive, page, page_size } = c.req.valid("query");
      const rows = await listQuery.run(db, {
        company_id: await currentCompanyId(db),
        q: q?.trim() ? escapeLike(q.trim()) : null,
        include_inactive,
        limit: page_size,
        offset: (page - 1) * page_size,
      });
      return c.json({ total: rows[0]?.total ?? 0, ledgers: rows.map(({ total: _, ...l }) => l), page, page_size });
    })
    .get("/:id", validate("param", idParam), async (c) => c.json(await found(await currentCompanyId(db), c.req.valid("param").id)))
    .post("/", canWrite, validate("json", ledgerInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const ledger = c.req.valid("json");
      const [row] = await onConstraint(uniqueName(ledger.name), () => insertQuery.run(db, { company_id: companyId, ...ledger }));
      if (!row) throw badGroup();
      return c.json(await found(companyId, row.id), 201);
    })
    .put("/:id", canWrite, validate("param", idParam), validate("json", ledgerInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      const ledger = c.req.valid("json");
      await editable(companyId, id);
      const [row] = await onConstraint(uniqueName(ledger.name), () => updateQuery.run(db, { company_id: companyId, id, ...ledger }));
      if (!row) throw badGroup();
      return c.json(await found(companyId, id));
    })
    .post("/:id/deactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      await editable(companyId, id);
      await setActiveQuery.run(db, { company_id: companyId, id, active: false });
      return c.json(await found(companyId, id));
    })
    .post("/:id/reactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      await editable(companyId, id);
      await setActiveQuery.run(db, { company_id: companyId, id, active: true });
      return c.json(await found(companyId, id));
    });
}
