// /api/parties: everyone signed in reads; viewers can't write (REQUIREMENTS §2: operators create
// challans, so they can add a party too). Parties are deactivated, never deleted (FR-3.5).
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { partyInput } from "../../shared/schemas/party.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { NotFoundError, onConstraint, validate } from "../errors.ts";
import { createParty, getParty, listParties, setPartyActive, updateParty } from "./parties.ts";

const canWrite = requireRole("admin", "accountant", "operator");
const listQuery = z.object({
  q: z.string().max(100).optional(),
  kind: z.enum(["customer", "supplier"]).optional(),
  include_inactive: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

// A second party with the same GSTIN, or a name another ledger has (each party gets a ledger named
// after it, 0010_party_ledgers.sql): a 409 on that field instead of a 500.
const uniqueFields = <T>(name: string, write: () => Promise<T>) =>
  onConstraint(
    {
      parties_company_id_gstin_key: ["gstin", "A party with this GSTIN already exists."],
      ledgers_company_name: ["name", `A party or ledger named ${name.trim()} already exists.`],
    },
    write,
  );

export function partyRoutes(db: SQL) {
  const found = async (companyId: number, id: number) => {
    const party = await getParty(db, companyId, id);
    if (!party) throw new NotFoundError(`Party ${id} not found.`);
    return party;
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { q, kind, include_inactive, page, page_size } = c.req.valid("query");
      const result = await listParties(db, await currentCompanyId(db), {
        q, kind, includeInactive: include_inactive, limit: page_size, offset: (page - 1) * page_size,
      });
      return c.json({ ...result, page, page_size });
    })
    .get("/:id", validate("param", idParam), async (c) => c.json(await found(await currentCompanyId(db), c.req.valid("param").id)))
    .post("/", canWrite, validate("json", partyInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const party = c.req.valid("json");
      const id = await uniqueFields(party.name, () => createParty(db, companyId, party));
      return c.json(await found(companyId, id), 201);
    })
    .put("/:id", canWrite, validate("param", idParam), validate("json", partyInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      const party = c.req.valid("json");
      if (!(await uniqueFields(party.name, () => updateParty(db, companyId, id, party)))) throw new NotFoundError(`Party ${id} not found.`);
      return c.json(await found(companyId, id));
    })
    .post("/:id/deactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      if (!(await setPartyActive(db, companyId, id, false))) throw new NotFoundError(`Party ${id} not found.`);
      return c.json(await found(companyId, id));
    })
    .post("/:id/reactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      if (!(await setPartyActive(db, companyId, id, true))) throw new NotFoundError(`Party ${id} not found.`);
      return c.json(await found(companyId, id));
    });
}
