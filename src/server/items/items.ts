// Item data access. Callers (the API, #32) validate input; these functions only read and write.
import type { SQL } from "bun";
import type { ItemInput } from "../../shared/schemas/item.ts";
import { escapeLike } from "../db.ts";
import getQuery from "./get.sql";
import insertQuery from "./insert.sql";
import listQuery from "./list.sql";
import setActiveQuery from "./set_active.sql";
import updateQuery from "./update.sql";

export type { ItemInput } from "../../shared/schemas/item.ts";
export type ItemType = ItemInput["type"];

export async function listItems(
  db: SQL,
  companyId: number,
  { q, type, includeInactive = false, limit = 50, offset = 0 }: { q?: string; type?: ItemType; includeInactive?: boolean; limit?: number; offset?: number } = {},
) {
  const rows = await listQuery.run(db, {
    company_id: companyId,
    q: q?.trim() ? escapeLike(q.trim()) : null,
    type: type ?? null,
    include_inactive: includeInactive,
    limit,
    offset,
  });
  return { total: rows[0]?.total ?? 0, items: rows.map(({ total: _, ...item }) => item) };
}

export const getItem = (db: SQL, companyId: number, id: number) => getQuery.run(db, { company_id: companyId, id });

/** Creates an item; returns its id. */
export async function createItem(db: SQL, companyId: number, item: ItemInput): Promise<number> {
  return (await insertQuery.run(db, { company_id: companyId, ...item })).id;
}

/** Replaces an item. False when there's no such item. */
export async function updateItem(db: SQL, companyId: number, id: number, item: ItemInput): Promise<boolean> {
  return (await updateQuery.run(db, { company_id: companyId, id, ...item })) !== null;
}

/** Deactivates or reactivates. False when there's no such item. */
export async function setItemActive(db: SQL, companyId: number, id: number, active: boolean): Promise<boolean> {
  return (await setActiveQuery.run(db, { company_id: companyId, id, active })) !== null;
}
