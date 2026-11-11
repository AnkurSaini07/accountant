// GET /api/company: anyone signed in (every document prints the letterhead).
// PUT /api/company: admin only (REQUIREMENTS §2). The whole profile is sent each time.
// With a GSTIN, state and PAN come from it; without one, state is required.
// Addresses and bank accounts are saved as whole lists (replaced on each save): documents copy the
// ones they print, so nothing points at these rows.
import type { SQL } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { normalizeGstin, parseGstin } from "../../shared/gstin.ts";
import { stateByCode } from "../../shared/states.ts";
import { requireRole, type AuthEnv } from "../auth/middleware.ts";
import { NotFoundError, validate } from "../errors.ts";
import deleteAddresses from "./delete_addresses.sql";
import deleteBankAccounts from "./delete_bank_accounts.sql";
import getCompany from "./get_company.sql";
import insertAddresses from "./insert_addresses.sql";
import insertBankAccounts from "./insert_bank_accounts.sql";
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

const address = z.object({
  label: z.string().trim().min(1, "Give this address a name, like Factory.").max(100),
  address: z.string().trim().max(500).default(""),
  city: z.string().trim().max(100).default(""),
  pincode: optionalCode(/^[1-9][0-9]{5}$/, "PIN code is 6 digits."),
  is_primary: z.boolean().default(false),
});
const bankAccount = z.object({
  bank_name: z.string().trim().min(1, "Bank name is required.").max(200),
  account_name: optional(),
  account_number: z
    .string()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => /^[0-9A-Z]{6,20}$/.test(v), "Account number is 6–20 letters or digits."),
  ifsc: z
    .string()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "IFSC is 11 characters, like HDFC0001234."),
  branch: optional(),
  is_default: z.boolean().default(false),
});
/** Empty, or exactly one row with `flag` set. */
const exactlyOne = <T>(rows: T[], flag: keyof T) => rows.length === 0 || rows.filter((r) => r[flag]).length === 1;

export const companyInput = z
  .object({
    legal_name: z.string().trim().min(1, "Legal name is required.").max(200),
    trade_name: optional(),
    state_code: optional(2),
    gstin: z.string().nullish().transform((v) => (v ? normalizeGstin(v) : null)),
    pan: optionalCode(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN is 5 letters, 4 digits, 1 letter."),
    phone: optional(50),
    email: z.email("Not a valid email address.").nullish().or(z.literal("")).transform((v) => v || null),
    logo: image,
    signature: image,
    terms: z.string().trim().max(5000).default(""),
    addresses: z
      .array(address)
      .min(1, "Add at least the registered office address.")
      .max(20)
      .refine((rows) => exactlyOne(rows, "is_primary"), "Mark exactly one address as primary."),
    bank_accounts: z
      .array(bankAccount)
      .max(20)
      .default([])
      .refine((rows) => exactlyOne(rows, "is_default"), "Mark exactly one bank account as the default.")
      .refine((rows) => new Set(rows.map((r) => r.account_number)).size === rows.length, "The same account number is listed twice."),
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
      const { addresses, bank_accounts, ...company } = c.req.valid("json");
      const { id } = await current(db);
      await db.begin(async (tx) => {
        await updateCompany.run(tx, { id, ...company });
        await deleteAddresses.run(tx, { company_id: id });
        await insertAddresses.run(tx, { company_id: id, rows: addresses });
        await deleteBankAccounts.run(tx, { company_id: id });
        if (bank_accounts.length) await insertBankAccounts.run(tx, { company_id: id, rows: bank_accounts });
      });
      return c.json(await current(db));
    });
}
