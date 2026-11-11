// GET /api/series?fy=2026: every document type's numbering for that FY (defaults where unset).
// PUT /api/series: admin only; saves them all in one transaction.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { DEFAULT_PADDING, DEFAULT_PREFIX, DOC_TYPES, formatNumber, MAX_LENGTH, PREFIX_PATTERN } from "../../shared/numbering.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { currentCompanyId } from "../company/routes.ts";
import { validate, ValidationError } from "../errors.ts";
import listSeries from "./list_series.sql";
import saveSeries from "./save_series.sql";

const fy = z.coerce.number().int().min(2000).max(2999);

const saveInput = z
  .object({
    fy,
    series: z
      .array(
        z.object({
          doc_type: z.enum(DOC_TYPES),
          prefix: z.string().trim().max(MAX_LENGTH).regex(PREFIX_PATTERN, "Use only letters, digits, / and - (and {FY} for the year)."),
          padding: z.number().int().min(1, "At least 1 digit.").max(8, "At most 8 digits."),
          next_number: z.number().int().min(1, "Numbers start at 1.").max(99_999_999),
        }),
      )
      .min(1),
  })
  .superRefine(({ fy, series }, ctx) => {
    const seen = new Set<string>();
    series.forEach((s, i) => {
      if (seen.has(s.doc_type)) ctx.addIssue({ code: "custom", path: ["series", i, "doc_type"], message: "Listed twice." });
      seen.add(s.doc_type);
      const sample = formatNumber(s.prefix, fy, s.next_number, s.padding);
      if (sample.length > MAX_LENGTH) {
        ctx.addIssue({ code: "custom", path: ["series", i, "prefix"], message: `${sample} is over ${MAX_LENGTH} characters (GST limit).` });
      }
    });
  });

async function list(db: SQL, companyId: number, year: number) {
  const saved = new Map((await listSeries.run(db, { company_id: companyId, fy: year })).map((r) => [r.doc_type, r]));
  return DOC_TYPES.map((doc_type) => saved.get(doc_type) ?? { doc_type, prefix: DEFAULT_PREFIX[doc_type], padding: DEFAULT_PADDING, next_number: 1 });
}

export function seriesRoutes(db: SQL) {
  return new Hono<AuthEnv>()
    .get("/", validate("query", z.object({ fy })), async (c) => {
      const { fy: year } = c.req.valid("query");
      return c.json({ fy: year, series: await list(db, await currentCompanyId(db), year) });
    })
    .put("/", requireRole("admin"), validate("json", saveInput), async (c) => {
      const { fy: year, series } = c.req.valid("json");
      const companyId = await currentCompanyId(db);
      await db.begin(async (tx) => {
        const lowered: Record<string, string[]> = {};
        for (const [i, s] of series.entries()) {
          const saved = await saveSeries.run(tx, { company_id: companyId, fy: year, ...s });
          if (!saved) lowered[`series.${i}.next_number`] = ["Lower than a number already used. Numbers can only move forward."];
        }
        // Throwing rolls back every row of this save, not just the refused ones.
        if (Object.keys(lowered).length) throw new ValidationError("Some numbers can't go back.", lowered);
      });
      return c.json({ fy: year, series: await list(db, companyId, year) });
    });
}
