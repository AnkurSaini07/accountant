// The party a client sends (create/update), validated the same on the server and in the form (#29).
// GSTIN: required for regular and composition dealers, absent otherwise; when present it decides
// state and PAN. Money is in paise (src/shared/money.ts).
import { z } from "zod";
import { normalizeGstin, parseGstin } from "../gstin.ts";
import { stateByCode } from "../states.ts";

export const PARTY_KINDS = ["customer", "supplier", "both"] as const;
export const REGISTRATION_TYPES = ["regular", "composition", "unregistered", "consumer"] as const;
export const REGISTRATION_LABELS: Record<(typeof REGISTRATION_TYPES)[number], string> = {
  regular: "Registered (regular)",
  composition: "Registered (composition)",
  unregistered: "Unregistered business",
  consumer: "Consumer",
};
const NEEDS_GSTIN = new Set<string>(["regular", "composition"]);

/** Optional text: trimmed; "" and null become null. */
const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const code = (pattern: RegExp, message: string) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.replace(/\s/g, "").toUpperCase() || null)
    .refine((v) => v === null || pattern.test(v), message);
const stateCode = z
  .string()
  .transform((v) => v.trim().padStart(2, "0"))
  .refine((v) => !!stateByCode(v), "Choose a state.");
const paise = z.number().int("Amount must be in whole paise.").refine(Number.isSafeInteger, "Amount is too large.");

export const partyAddressInput = z.object({
  kind: z.enum(["billing", "shipping"]),
  label: optional(100),
  address: z.string().trim().max(500).default(""),
  city: z.string().trim().max(100).default(""),
  pincode: code(/^[1-9][0-9]{5}$/, "PIN code is 6 digits."),
  state_code: stateCode,
});

const partyFields = z.object({
    name: z.string().trim().min(1, "Name is required.").max(200),
    kind: z.enum(PARTY_KINDS),
    registration_type: z.enum(REGISTRATION_TYPES),
    gstin: z.string().nullish().transform((v) => (v ? normalizeGstin(v) : null)),
    pan: code(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN is 5 letters, 4 digits, 1 letter."),
    state_code: z.string().nullish(),
    contact_person: optional(),
    phone: optional(50),
    email: z.email("Not a valid email address.").nullish().or(z.literal("")).transform((v) => v || null),
    credit_days: z.number().int().min(0, "Can't be negative.").max(365, "At most 365 days.").default(0),
    credit_limit: paise.min(0, "Can't be negative.").nullish().transform((v) => v ?? null),
    opening_balance: paise.default(0), // + Dr (owes us), − Cr (we owe)
    addresses: z
      .array(partyAddressInput)
      .max(50)
      .default([])
      .refine((rows) => rows.filter((a) => a.kind === "billing").length <= 1, "Only one billing address."),
});
type Flat = Omit<z.output<typeof partyFields>, "gstin" | "pan" | "state_code"> & { gstin: string | null; pan: string | null; state_code: string };

export const partyInput = partyFields.transform((input, ctx): Flat => {
    if (NEEDS_GSTIN.has(input.registration_type)) {
      if (!input.gstin) {
        ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN is required for a registered party." });
        return z.NEVER;
      }
      try {
        const { gstin, state, pan } = parseGstin(input.gstin);
        return { ...input, gstin, state_code: state.code, pan };
      } catch (e) {
        ctx.addIssue({ code: "custom", path: ["gstin"], message: (e as Error).message });
        return z.NEVER;
      }
    }
    if (input.gstin) {
      ctx.addIssue({ code: "custom", path: ["gstin"], message: "A party with a GSTIN is registered: choose Registered." });
      return z.NEVER;
    }
    const state = input.state_code ? stateByCode(input.state_code.trim().padStart(2, "0")) : undefined;
    if (!state) {
      ctx.addIssue({ code: "custom", path: ["state_code"], message: "Choose a state." });
      return z.NEVER;
    }
    return { ...input, gstin: null, state_code: state.code };
});
export type PartyInput = z.output<typeof partyInput>;
