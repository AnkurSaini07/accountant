// A register's table (Primer's Table): one row per record, the row header (its name or number) a
// link (or a button, for records that open in a dialog), and the whole row clickable. Shows a
// loading row and an empty message.
import { Spinner } from "@primer/react";
import { Table } from "@primer/react/experimental";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import classes from "./RecordTable.module.css";

export type RecordColumn<R> = {
  label: string;
  cell: (r: R) => ReactNode;
  align?: "start" | "end";
  width?: string; // a CSS grid track: "minmax(200px, 2fr)"; default "minmax(120px, 1fr)"
  rowHeader?: boolean; // names the row; its cell links to the record
};

type Props<R> = { label: string; columns: RecordColumn<R>[]; rows: R[] | null; rowKey: (r: R) => string | number; empty: string } & (
  | { href: (r: R) => string; onOpen?: never } // a record with its own page
  | { onOpen: (r: R) => void; href?: never } // a record that opens in a dialog (ledgers)
);

export function RecordTable<R>({ label, columns, rows, rowKey, href, onOpen, empty }: Props<R>) {
  const navigate = useNavigate();
  const open = (r: R) => (href ? navigate(href(r)) : onOpen!(r));
  return (
    <Table.Container className={classes.container}>
      <Table aria-label={label} cellPadding="condensed" gridTemplateColumns={columns.map((c) => c.width ?? "minmax(120px, 1fr)").join(" ")}>
        <Table.Head>
          <Table.Row>
            {columns.map((c) => (
              <Table.Header key={c.label} align={c.align}>
                {c.label}
              </Table.Header>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {!rows && (
            <Table.Row>
              <Table.Cell className={classes.message}>
                <Spinner size="small" srText="Loading" />
              </Table.Cell>
            </Table.Row>
          )}
          {rows?.length === 0 && (
            <Table.Row>
              <Table.Cell className={classes.message}>{empty}</Table.Cell>
            </Table.Row>
          )}
          {rows?.map((r) => (
            <Table.Row key={rowKey(r)} className={classes.row} onClick={(e) => !(e.target as Element).closest("a, button, input") && open(r)}>
              {columns.map((c) => (
                <Table.Cell key={c.label} align={c.align} scope={c.rowHeader ? "row" : undefined}>
                  {!c.rowHeader ? (
                    c.cell(r)
                  ) : href ? (
                    <a href={href(r)} className={classes.link}>
                      {c.cell(r)}
                    </a>
                  ) : (
                    <button type="button" className={`${classes.link} ${classes.button}`} onClick={() => onOpen!(r)}>
                      {c.cell(r)}
                    </button>
                  )}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Table.Container>
  );
}
