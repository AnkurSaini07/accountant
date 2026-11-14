import { Label } from "@primer/react";
import type { BadgeVariant, StatusInfo } from "./DocumentList.tsx";

/** Our status colours as Primer Label variants. */
export const LABEL_VARIANT = { neutral: "secondary", informative: "accent", positive: "success", negative: "danger", notice: "attention" } as const satisfies Record<BadgeVariant, string>;

export const StatusBadge = ({ statuses, status }: { statuses: StatusInfo; status: string }) => (
  <Label variant={LABEL_VARIANT[statuses[status]?.badge ?? "neutral"]}>{statuses[status]?.label ?? status}</Label>
);
