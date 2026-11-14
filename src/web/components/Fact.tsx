import type { ReactNode } from "react";
import { factLabel } from "./formLayout.ts";
import classes from "./Fact.module.css";

/** One labelled fact on a read-only document ("Date: 11 Nov 2026"); nothing when it's empty. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className={classes.fact}>
      <dt className={factLabel}>{label}</dt>
      <dd className={classes.value}>{children}</dd>
    </div>
  );
}
