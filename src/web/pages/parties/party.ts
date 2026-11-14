// A party as the API returns it.
import type { InferResponseType } from "hono/client";
import { client } from "../../api.ts";

export type Party = InferResponseType<(typeof client.api.parties)[":id"]["$get"], 200>;

export { note } from "../../components/formLayout.ts";
