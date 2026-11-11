// /api/items: everyone signed in reads; accountants and admins write (REQUIREMENTS §2: masters
// are theirs; operators pick items on challans but don't define them). Deactivated, never deleted.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { ITEM_TYPES, itemInput } from "../../shared/schemas/item.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { NotFoundError, onConstraint, validate } from "../errors.ts";
import { createItem, getItem, listItems, setItemActive, updateItem } from "./items.ts";

const canWrite = requireRole("admin", "accountant");
const listQuery = z.object({
  q: z.string().max(100).optional(),
  type: z.enum(ITEM_TYPES).optional(),
  include_inactive: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Database rules the schema can't check (another item's code, a unit or rate that doesn't exist) as field errors. */
const constraints = (code: string) =>
  ({
    items_company_code: ["code", `Item code ${code} is already used.`],
    items_unit_id_fkey: ["unit_id", "Choose a unit from the list."],
    items_gst_rate_id_fkey: ["gst_rate_id", "Choose a GST rate from the list."],
  }) satisfies Record<string, [string, string]>;

export function itemRoutes(db: SQL) {
  const found = async (companyId: number, id: number) => {
    const item = await getItem(db, companyId, id);
    if (!item) throw new NotFoundError(`Item ${id} not found.`);
    return item;
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { q, type, include_inactive, page, page_size } = c.req.valid("query");
      const result = await listItems(db, await currentCompanyId(db), { q, type, includeInactive: include_inactive, limit: page_size, offset: (page - 1) * page_size });
      return c.json({ ...result, page, page_size });
    })
    .get("/:id", validate("param", idParam), async (c) => c.json(await found(await currentCompanyId(db), c.req.valid("param").id)))
    .post("/", canWrite, validate("json", itemInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const item = c.req.valid("json");
      const id = await onConstraint(constraints(item.code), () => createItem(db, companyId, item));
      return c.json(await found(companyId, id), 201);
    })
    .put("/:id", canWrite, validate("param", idParam), validate("json", itemInput), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      const item = c.req.valid("json");
      if (!(await onConstraint(constraints(item.code), () => updateItem(db, companyId, id, item)))) throw new NotFoundError(`Item ${id} not found.`);
      return c.json(await found(companyId, id));
    })
    .post("/:id/deactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      if (!(await setItemActive(db, companyId, id, false))) throw new NotFoundError(`Item ${id} not found.`);
      return c.json(await found(companyId, id));
    })
    .post("/:id/reactivate", canWrite, validate("param", idParam), async (c) => {
      const companyId = await currentCompanyId(db);
      const { id } = c.req.valid("param");
      if (!(await setItemActive(db, companyId, id, true))) throw new NotFoundError(`Item ${id} not found.`);
      return c.json(await found(companyId, id));
    });
}
