import type { ReactNode } from "react";
import classes from "./layout.module.css";

/** One field-grid cell: `wide` takes two columns, `full` the whole row, `check` sits a checkbox on the fields' baseline. */
export function Cell({ wide, full, check, children }: { wide?: boolean; full?: boolean; check?: boolean; children: ReactNode }) {
  return <div className={[classes.cell, wide && classes.wide, full && classes.full, check && classes.check].filter(Boolean).join(" ")}>{children}</div>;
}
