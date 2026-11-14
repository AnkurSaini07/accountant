// Records as two-line rows (title and amount; details and status): lists on a phone, and the
// dashboard's recent documents.
import { Label, Link } from "@primer/react";
import type { BadgeVariant } from "./DocumentList.tsx";
import { LABEL_VARIANT } from "./StatusBadge.tsx";
import classes from "./CardList.module.css";

export type CardRow = {
  id: number | string;
  title: string; // the link text: number or name
  href?: string;
  amount?: string; // top right
  meta: string; // under the title: party · date · type
  badge?: { label: string; variant: BadgeVariant };
};

/** Records as two-line rows: title link and amount on top, details and status under. */
export function CardList({ label, rows, empty }: { label: string; rows: CardRow[] | null; empty: string }) {
  if (!rows) return <p className={classes.empty}>Loading…</p>;
  if (!rows.length) return <p className={classes.empty}>{empty}</p>;
  return (
    <ul className={classes.list} aria-label={label}>
      {rows.map((r) => (
        <li key={r.id} className={classes.row}>
          {r.href ? (
            <Link href={r.href} className={classes.title}>
              {r.title}
            </Link>
          ) : (
            <span className={classes.title}>{r.title}</span>
          )}
          <span className={classes.amount}>{r.amount ?? ""}</span>
          <span className={classes.meta}>{r.meta}</span>
          <span className={classes.end}>{r.badge && <Label variant={LABEL_VARIANT[r.badge.variant]}>{r.badge.label}</Label>}</span>
        </li>
      ))}
    </ul>
  );
}
