// The dashboard's to-do list: drafts, quotes awaiting a reply, orders to deliver or receive; each
// row links to the list behind it, filtered.
import { ChevronRightIcon } from "@primer/octicons-react";
import { Link } from "@primer/react";
import type { Dashboard as DashboardData } from "../../../server/dashboard/routes.ts";
import { wholeRupees } from "./format.ts";
import c from "./Attention.module.css";

export function Attention({ d }: { d: DashboardData }) {
  const items = [
    { count: d.draft_invoices, label: "Draft invoices", note: "Not finalized, so not numbered yet", href: "/sales/invoices?status=draft" },
    { count: d.quotes_awaiting, label: "Quotations awaiting reply", note: d.quotes_awaiting ? `${wholeRupees(d.quotes_awaiting_value)} quoted` : "Nothing out", href: "/sales/quotations?status=sent" },
    { count: d.orders_to_deliver, label: "Sales orders to deliver", note: "Confirmed, goods still to send", href: "/sales/orders?status=finalized" },
    { count: d.pos_to_receive, label: "Purchase orders to receive", note: "Sent to suppliers, goods still due", href: "/purchase/orders?status=finalized" },
  ];
  return (
    <ul className={c.list}>
      {items.map((it) => (
        <li key={it.label} className={c.row}>
          <span className={c.count} data-busy={it.count > 0 || undefined} aria-hidden>
            {it.count}
          </span>
          <span className={c.text}>
            <Link href={it.href} className={c.link} aria-label={`${it.label}: ${it.count}`}>
              {it.label}
            </Link>
            <span className={c.note}>{it.note}</span>
          </span>
          <ChevronRightIcon className={c.chevron} aria-hidden />
        </li>
      ))}
    </ul>
  );
}
