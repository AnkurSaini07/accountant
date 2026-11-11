// The item a client sends (create/update), validated the same on the server and in the form (#33).
// Money in paise; quantities in the unit's smallest step (1.250 KGS = 1250, see units.decimals).
import { z } from "zod";

export const ITEM_TYPES = ["raw", "semi", "finished", "service"] as const;
export const ITEM_TYPE_LABELS: Record<(typeof ITEM_TYPES)[number], string> = {
  raw: "Raw material",
  semi: "Semi-finished",
  finished: "Finished good",
  service: "Service",
};

const amount = (what: string) =>
  z
    .number()
    .int(`${what} must be a whole number of the smallest unit.`)
    .min(0, "Can't be negative.")
    .refine(Number.isSafeInteger, `${what} is too large.`);

export const itemInput = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,29}$/, "Up to 30 letters, digits and / _ . - (no spaces)."),
    name: z.string().trim().min(1, "Name is required.").max(200),
    description: z.string().trim().max(1000).default(""),
    type: z.enum(ITEM_TYPES),
    hsn: z
      .string()
      .nullish()
      .transform((v) => v?.replace(/\s/g, "") || null)
      .refine((v) => v === null || /^([0-9]{4}|[0-9]{6}|[0-9]{8})$/.test(v), "HSN/SAC is 4, 6 or 8 digits."),
    unit_id: z.number().int().positive("Choose a unit."),
    gst_rate_id: z.number().int().positive("Choose a GST rate."),
    sale_price: amount("Price").default(0),
    purchase_price: amount("Price").default(0),
    opening_qty: amount("Quantity").default(0),
    opening_value: amount("Value").default(0),
    reorder_level: amount("Quantity").nullish().transform((v) => v ?? null),
  })
  .superRefine((item, ctx) => {
    if (item.type === "service") {
      for (const key of ["opening_qty", "opening_value"] as const) {
        if (item[key]) ctx.addIssue({ code: "custom", path: [key], message: "A service has no stock." });
      }
      if (item.reorder_level !== null) ctx.addIssue({ code: "custom", path: ["reorder_level"], message: "A service has no stock." });
    } else if (item.opening_value && !item.opening_qty) {
      ctx.addIssue({ code: "custom", path: ["opening_value"], message: "Enter the opening quantity this value is for." });
    }
  });
export type ItemInput = z.output<typeof itemInput>;
