// Dashboard: the first screen after sign-in. For the header's FY: net sales and output GST, sales by
// month, the work waiting on someone (drafts, quotes, orders to deliver or receive), top customers
// and the latest documents. One request (/api/dashboard); every tile links to the list behind it.
import { PlusIcon } from "@primer/octicons-react";
import { Link, LinkButton } from "@primer/react";
import { SkeletonBox } from "@primer/react/experimental";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { fyLabel, parseFyLabel, todayInIndia } from "../../shared/fy.ts";
import { call, client } from "../api.ts";
import { useUser } from "../auth.tsx";
import { formatDate } from "../components/DocumentList.tsx";
import { companyAtom, financialYearAtom } from "../state.ts";
import type { Dashboard as DashboardData } from "../../server/dashboard/routes.ts";
import { Attention } from "./dashboard/Attention.tsx";
import { Kpi } from "./dashboard/Kpi.tsx";
import { MONTH, wholeRupees } from "./dashboard/format.ts";
import { RecentDocuments } from "./dashboard/RecentDocuments.tsx";
import { SalesChart } from "./dashboard/SalesChart.tsx";
import { TopCustomers } from "./dashboard/TopCustomers.tsx";
import c from "./Dashboard.module.css";

export type { Dashboard as DashboardData } from "../../server/dashboard/routes.ts";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// ── page ────────────────────────────────────────────────────────────────────────────────────────
export function Dashboard({ now = new Date() }: { now?: Date }) {
  const fyText = useAtomValue(financialYearAtom);
  const fy = parseFyLabel(fyText);
  const company = useAtomValue(companyAtom);
  const { name, role } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let current = true; // switching FY quickly: a slow older answer must not land last
    setData(null);
    call(client.api.dashboard.$get({ query: { fy: String(fy) } })).then(
      (d) => current && setData(d),
      () => {}, // failures toast
    );
    return () => {
      current = false;
    };
  }, [fy]);

  const today = todayInIndia(now);
  const thisMonth = today.slice(0, 7);
  const idx = data?.monthly.findIndex((m) => m.month === thisMonth) ?? -1;
  const [cur, prev] = idx >= 0 && data ? [data.monthly[idx]!.net_sales, idx > 0 ? data.monthly[idx - 1]!.net_sales : null] : [null, null];
  const change = cur !== null && prev ? Math.round(((cur - prev) / prev) * 100) : null;
  const office = role === "admin" || role === "accountant";
  const floor = office || role === "operator";

  return (
    <div className={c.page}>
      <div className={c.hero}>
        <div>
          <h1 className={c.heroTitle}>
            {greeting(Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now)))}, {name.split(" ")[0]}
          </h1>
          <p className={c.heroSub}>
            {company?.trade_name || company?.legal_name || "Your company"} · FY {fyLabel(fy)} · {formatDate(today)}
          </p>
        </div>
        {floor && (
          <div className={c.quick}>
            {office && (
              <LinkButton href="/sales/invoices/new" variant="primary" size="small" leadingVisual={PlusIcon}>
                New invoice
              </LinkButton>
            )}
            {office && (
              <LinkButton href="/sales/quotations/new" size="small">
                New quotation
              </LinkButton>
            )}
            <LinkButton href="/sales/challans/new" size="small">
              New challan
            </LinkButton>
            <LinkButton href="/purchase/grns/new" size="small">
              Receive goods
            </LinkButton>
          </div>
        )}
      </div>

      <div className={c.kpis}>
        <Kpi tone="accent" label="Net sales" value={data && wholeRupees(data.net_sales)} note="Finalized invoices less credit notes, before GST" />
        <Kpi
          tone="positive"
          label={cur !== null ? `${MONTH.format(now)} so far` : "This month"}
          value={data && (cur !== null ? wholeRupees(cur) : "—")}
          note={change === null ? (cur === null && data ? `Outside FY ${fyLabel(fy)}` : undefined) : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs last month`}
        />
        <Kpi tone="notice" label="Output GST" value={data && wholeRupees(data.output_gst)} note="CGST + SGST + IGST charged" />
        <Kpi tone="neutral" label="Invoices finalized" value={data && String(data.invoice_count)} note={data ? `${data.draft_invoices} draft${data.draft_invoices === 1 ? "" : "s"} waiting` : undefined} />
      </div>

      <div className={c.twoUp}>
        <section className={c.panel} aria-labelledby="dash-sales">
          <div className={c.panelHead}>
            <h2 id="dash-sales" className={c.panelTitle}>
              Net sales by month
            </h2>
            <Link href="/sales/invoices">Invoices</Link>
          </div>
          <div className={c.panelBody}>{data ? <SalesChart monthly={data.monthly} currentMonth={thisMonth} /> : <SkeletonBox height="260px" />}</div>
        </section>
        <section className={c.panel} aria-labelledby="dash-todo">
          <div className={c.panelHead}>
            <h2 id="dash-todo" className={c.panelTitle}>
              Needs attention
            </h2>
          </div>
          <div className={c.panelBody}>{data ? <Attention d={data} /> : <SkeletonBox height="240px" />}</div>
        </section>
      </div>

      <div className={c.twoUp}>
        <section className={c.panel} aria-labelledby="dash-recent">
          <div className={c.panelHead}>
            <h2 id="dash-recent" className={c.panelTitle}>
              Recent documents
            </h2>
          </div>
          <div className={c.panelBody}>{data ? <RecentDocuments rows={data.recent} /> : <SkeletonBox height="320px" />}</div>
        </section>
        <section className={c.panel} aria-labelledby="dash-top">
          <div className={c.panelHead}>
            <h2 id="dash-top" className={c.panelTitle}>
              Top customers
            </h2>
          </div>
          <div className={c.panelBody}>{data ? <TopCustomers rows={data.top_customers} total={data.net_sales} /> : <SkeletonBox height="240px" />}</div>
        </section>
      </div>
    </div>
  );
}
