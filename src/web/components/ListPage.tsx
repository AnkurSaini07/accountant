// The frame every register shares (documents and masters): the page header with its actions, and one
// compact row of filters, behind a Filters button on a phone so the rows come first.
import { FilterIcon } from "@primer/octicons-react";
import { Button, CounterLabel } from "@primer/react";
import { type ReactNode, useState } from "react";
import { formPage } from "./formLayout.ts";
import { PageHeader } from "./PageHeader.tsx";
import classes from "./ListPage.module.css";

type Props = {
  title: string;
  actions?: ReactNode; // New…, From quotations…
  search: ReactNode; // always in view
  filters?: ReactNode; // status, dates, kind…: behind Filters on a phone
  activeFilters?: number; // how many of `filters` are set, shown on the phone's Filters button
  children: ReactNode; // the table (or cards) and the pager
};

export function ListPage({ title, actions, search, filters, activeFilters = 0, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={formPage}>
      <PageHeader title={title} actions={actions} />
      <div className={classes.toolbar}>
        <div className={classes.search}>{search}</div>
        {filters && (
          <>
            <Button
              size="small"
              className={classes.toggle}
              leadingVisual={FilterIcon}
              aria-pressed={open}
              aria-label={activeFilters ? `Filters (${activeFilters} on)` : "Filters"}
              trailingVisual={activeFilters ? () => <CounterLabel>{activeFilters}</CounterLabel> : undefined}
              onClick={() => setOpen(!open)}>
              Filters
            </Button>
            <div className={open ? `${classes.filters} ${classes.open}` : classes.filters}>{filters}</div>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
