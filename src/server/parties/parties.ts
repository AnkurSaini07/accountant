// Party data access. Callers (the API, #27) validate input; these functions only read and write.
import type { SQL } from "bun";
import type { PartyInput } from "../../shared/schemas/party.ts";
import { escapeLike } from "../db.ts";
import deleteAddresses from "./delete_addresses.sql";
import getQuery from "./get.sql";
import insertQuery from "./insert.sql";
import insertAddresses from "./insert_addresses.sql";
import listQuery from "./list.sql";
import setActiveQuery from "./set_active.sql";
import updateQuery from "./update.sql";

export type { PartyInput } from "../../shared/schemas/party.ts";
export type PartyAddress = PartyInput["addresses"][number];


export async function listParties(
  db: SQL,
  companyId: number,
  { q, kind, includeInactive = false, limit = 50, offset = 0 }: { q?: string; kind?: "customer" | "supplier"; includeInactive?: boolean; limit?: number; offset?: number } = {},
) {
  const rows = await listQuery.run(db, {
    company_id: companyId,
    q: q?.trim() ? escapeLike(q.trim()) : null,
    kind: kind ?? null,
    include_inactive: includeInactive,
    limit,
    offset,
  });
  return { total: rows[0]?.total ?? 0, parties: rows.map(({ total: _, ...p }) => p) };
}

export const getParty = (db: SQL, companyId: number, id: number) => getQuery.run(db, { company_id: companyId, id });

async function saveAddresses(tx: SQL, partyId: number, addresses: PartyAddress[]) {
  await deleteAddresses.run(tx, { party_id: partyId });
  if (addresses.length) await insertAddresses.run(tx, { party_id: partyId, rows: addresses });
}

/** Creates a party with its addresses; returns the new id. */
export function createParty(db: SQL, companyId: number, { addresses, ...party }: PartyInput): Promise<number> {
  return db.begin(async (tx) => {
    const { id } = await insertQuery.run(tx, { company_id: companyId, ...party });
    await saveAddresses(tx, id, addresses);
    return id;
  });
}

/** Replaces a party and its addresses. False when there's no such party. */
export function updateParty(db: SQL, companyId: number, id: number, { addresses, ...party }: PartyInput): Promise<boolean> {
  return db.begin(async (tx) => {
    const updated = await updateQuery.run(tx, { company_id: companyId, id, ...party });
    if (!updated) return false;
    await saveAddresses(tx, id, addresses);
    return true;
  });
}

/** Deactivates or reactivates. False when there's no such party. */
export async function setPartyActive(db: SQL, companyId: number, id: number, active: boolean): Promise<boolean> {
  return (await setActiveQuery.run(db, { company_id: companyId, id, active })) !== null;
}
