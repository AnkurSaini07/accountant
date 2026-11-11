// GET /api/units, GET /api/gst-rates: everyone signed in (items and documents pick from them).
// POST to either: admin only. Rows aren't edited or deleted: documents refer to them.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { onConstraint, validate } from "../errors.ts";
import insertGstRate from "./insert_gst_rate.sql";
import insertUnit from "./insert_unit.sql";
import listGstRates from "./list_gst_rates.sql";
import listUnits from "./list_units.sql";

const unitInput = z.object({
  code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => /^[A-Z]{3}$/.test(v), "Use the 3-letter UQC, like KGS or NOS."),
  name: z.string().trim().min(1, "Name is required.").max(100),
  decimals: z.number().int().min(0).max(3, "At most 3 decimals.").default(0),
});

const gstRateInput = z.object({
  rate: z
    .number()
    .min(0, "Can't be negative.")
    .max(100, "At most 100%.")
    .refine((r) => Math.abs(r * 100 - Math.round(r * 100)) < 1e-9, "At most 2 decimals."), // 0.25 ok, 0.125 not
  effective_from: z.iso.date("Use a date like 2025-09-22."),
});

export function unitRoutes(db: SQL) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => c.json(await listUnits.run(db, {})))
    .post("/", requireRole("admin"), validate("json", unitInput), async (c) => {
      const unit = c.req.valid("json");
      return c.json(await onConstraint({ units_code_key: ["code", `${unit.code} already exists.`] }, () => insertUnit.run(db, unit)), 201);
    });
}

export function gstRateRoutes(db: SQL) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => c.json(await listGstRates.run(db, {})))
    .post("/", requireRole("admin"), validate("json", gstRateInput), async (c) => {
      const { rate, effective_from } = c.req.valid("json");
      const saved = await onConstraint({ gst_rates_rate_effective_from_key: ["rate", `${rate}% from ${effective_from} already exists.`] }, () =>
        insertGstRate.run(db, { rate: String(rate), effective_from }),
      );
      return c.json(saved, 201);
    });
}
