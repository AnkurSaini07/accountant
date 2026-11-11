// GET /api/company: anyone signed in (every document prints the letterhead).
// PUT /api/company: admin only (REQUIREMENTS §2). The whole profile is sent each time.
// With a GSTIN, state and PAN come from it; without one, state is required.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { normalizeGstin, parseGstin } from "../../shared/gstin.ts";
import { stateByCode } from "../../shared/states.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { NotFoundError, validate } from "../errors.ts";
import getCompany from "./get_company.sql";
import updateCompany from "./update_company.sql";

const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_IMAGE_CHARS = 400_000; // ≈ 300 KB file: plenty for a logo or a signature scan

/** Optional text: trimmed, "" and null become null. */
const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
/** Optional code: also upper-cased with spaces removed, then checked against `pattern`. */
const optionalCode = (pattern: RegExp, message: string) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.replace(/\s/g, "").toUpperCase() || null)
    .refine((v) => v === null || pattern.test(v), message);
const image = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || IMAGE.test(v), "Must be a PNG, JPEG or WebP image.")
  .refine((v) => v === null || v.length <= MAX_IMAGE_CHARS, "Image is too large (max about 300 KB).");

export const companyInput = z
  .object({
    legal_name: z.string().trim().min(1, "Legal name is required.").max(200),
    trade_name: optional(),
    address: z.string().trim().max(500).default(""),
    city: z.string().trim().max(100).default(""),
    pincode: optionalCode(/^[1-9][0-9]{5}$/, "PIN code is 6 digits."),
    state_code: optional(2),
    gstin: z.string().nullish().transform((v) => (v ? normalizeGstin(v) : null)),
    pan: optionalCode(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN is 5 letters, 4 digits, 1 letter."),
    phone: optional(50),
    email: z.email("Not a valid email address.").nullish().or(z.literal("")).transform((v) => v || null),
    bank_name: optional(),
    bank_account: optionalCode(/^[0-9A-Z]{6,20}$/, "Account number is 6–20 letters or digits."),
    bank_ifsc: optionalCode(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC is 11 characters, like HDFC0001234."),
    bank_branch: optional(),
    logo: image,
    signature: image,
    terms: z.string().trim().max(5000).default(""),
  })
  .transform((input, ctx) => {
    if (input.gstin) {
      try {
        const { gstin, state, pan } = parseGstin(input.gstin);
        return { ...input, gstin, state_code: state.code, pan };
      } catch (e) {
        ctx.addIssue({ code: "custom", path: ["gstin"], message: (e as Error).message });
        return z.NEVER;
      }
    }
    if (!input.state_code || !stateByCode(input.state_code)) {
      ctx.addIssue({ code: "custom", path: ["state_code"], message: "Choose the state (or enter the GSTIN)." });
      return z.NEVER;
    }
    return { ...input, state_code: stateByCode(input.state_code)!.code };
  });

async function current(db: SQL) {
  const company = await getCompany.run(db, {});
  if (!company) throw new NotFoundError("No company is set up.");
  return company;
}

export function companyRoutes(db: SQL) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => c.json(await current(db)))
    .put("/", requireRole("admin"), validate("json", companyInput), async (c) => {
      const { id } = await current(db);
      const updated = await updateCompany.run(db, { id, ...c.req.valid("json") });
      return c.json(updated);
    });
}
