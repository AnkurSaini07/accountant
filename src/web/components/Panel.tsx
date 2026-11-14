// A titled group of fields ("Contact", "Billing address"): GitHub's bordered box, its title on a grey
// header row. Depth is the border, not a shadow. `nested` inside another panel: no header row.
import type { ReactNode } from "react";
import classes from "./Panel.module.css";

export function Panel({ title, note, action, label, nested, children }: { title: string; note?: string; action?: ReactNode; label?: string; nested?: boolean; children: ReactNode }) {
  return (
    <section className={nested ? `${classes.panel} ${classes.nested}` : classes.panel} aria-label={label ?? title}>
      <div className={classes.head}>
        <div className={classes.heading}>
          <h2 className={classes.title}>{title}</h2>
          {note && <p className={classes.note}>{note}</p>}
        </div>
        {action}
      </div>
      <div className={classes.body}>{children}</div>
    </section>
  );
}
