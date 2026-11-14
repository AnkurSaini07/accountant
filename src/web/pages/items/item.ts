// An item, its units and GST rates as the API returns them.
import type { InferResponseType } from "hono/client";
import { client } from "../../api.ts";

export type Item = InferResponseType<(typeof client.api.items)[":id"]["$get"], 200>;

export type Unit = InferResponseType<typeof client.api.units.$get, 200>[number];

export type GstRate = InferResponseType<(typeof client.api)["gst-rates"]["$get"], 200>[number];

export { note } from "../../components/formLayout.ts";
