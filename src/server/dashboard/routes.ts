// /api/dashboard?fy=2026: the home screen's numbers for one FY, worked out in SQL (dashboard.sql).
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { validate } from "../errors.ts";
import dashboardQuery from "./dashboard.sql";

const params = z.object({ fy: z.coerce.number().int().min(2000).max(2999) });

// The query coalesces everything, but its inferred types can't see that (aggregates and json read
// as nullable), so the response's shape is stated here for the client.
export type Dashboard = {
  net_sales: number; output_gst: number; invoice_count: number; draft_invoices: number;
  quotes_awaiting: number; quotes_awaiting_value: number; orders_to_deliver: number; pos_to_receive: number;
  monthly: { month: string; net_sales: number }[];
  top_customers: { party_id: number; party_name: string; net_sales: number }[];
  recent: { id: number; type: string; number: string | null; date: string; status: string; party_name: string; grand_total: number }[];
};

export const dashboardRoutes = (db: SQL) =>
  new Hono<AuthEnv>().get("/", validate("query", params), async (c) => {
    const row = await dashboardQuery.run(db, { company_id: await currentCompanyId(db), fy: c.req.valid("query").fy });
    return c.json(row as unknown as Dashboard);
  });
