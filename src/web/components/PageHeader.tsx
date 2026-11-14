// The header stays in view while the page scrolls: what this is, its status, and what you can do.
import { ArrowLeftIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";
import type { ReactNode } from "react";
import classes from "./PageHeader.module.css";

type HeaderProps = {
  back?: { href: string; label: string }; // { href: "/masters/parties", label: "Back to parties" }; none on a top-level page
  eyebrow?: string; // the kind of thing, before the title: "Invoice", "New"
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

/** The sticky top of a screen. The h1 reads "<eyebrow> <title>" ("Invoice INV/26-27/0001"). */
export function PageHeader({ back, eyebrow, title, badge, actions }: HeaderProps) {
  return (
    <div className={classes.head}>
      <div className={classes.titleArea}>
        {back && <IconButton as="a" href={back.href} icon={ArrowLeftIcon} aria-label={back.label} variant="invisible" size="small" />}
        <h1 className={classes.title}>
          {eyebrow && <span className={classes.eyebrow}>{`${eyebrow} `}</span>}
          <span className={classes.text}>{title}</span>
        </h1>
        {badge}
      </div>
      {actions && <div className={classes.actions}>{actions}</div>}
    </div>
  );
}
