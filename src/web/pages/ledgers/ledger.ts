// A ledger row as the API lists it.
import type { InferResponseType } from "hono/client";
import { client } from "../../api.ts";

export type LedgerRow = InferResponseType<typeof client.api.ledgers.$get, 200>["ledgers"][number];
