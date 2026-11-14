// The FY's biggest customers by net sales, each with a bar for its share of the total.
import { ProgressBar } from "@primer/react";
import type { Dashboard as DashboardData } from "../../../server/dashboard/routes.ts";
import { empty, wholeRupees } from "./format.ts";
import c from "./TopCustomers.module.css";

export function TopCustomers({ rows, total }: { rows: DashboardData["top_customers"]; total: number }) {
  if (!rows.length) return <p className={empty}>No finalized invoices this year yet.</p>;
  return (
    <ul className={c.list}>
      {rows.map((cust) => {
        const share = total > 0 ? Math.round((cust.net_sales / total) * 100) : 0;
        return (
          // Share of the FY's net sales; the figure is written out, so the bar isn't colour-alone.
          <li key={cust.party_id} role="meter" aria-label={cust.party_name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-valuetext={wholeRupees(cust.net_sales)} className={c.row}>
            <span className={c.name}>{cust.party_name}</span>
            <span className={c.value}>{wholeRupees(cust.net_sales)}</span>
            <ProgressBar progress={share} barSize="small" className={c.bar} aria-hidden />
          </li>
        );
      })}
    </ul>
  );
}
