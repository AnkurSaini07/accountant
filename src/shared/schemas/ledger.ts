// The ledger a client sends (create/update), validated the same on the server and in the dialog (#36).
import { z } from "zod";

export const ledgerInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  group_id: z.number().int().positive("Choose a group."),
});
export type LedgerInput = z.output<typeof ledgerInput>;
