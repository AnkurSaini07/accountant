import { useState } from "react";
import { formatRupees } from "../../../shared/money.ts";
import type { Dashboard as DashboardData } from "../../../server/dashboard/routes.ts";
import { MONTH, niceCeiling } from "./format.ts";
import c from "./SalesChart.module.css";

const monthLabel = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00`));

const COMPACT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** 1_22_50_000_00 paise → "₹1.2Cr"; for axis ticks, where the exact figure is noise. */
const compactRupees = (p: number) => `₹${COMPACT.format(p / 100)}`;

/** Net sales by month, April → March: one series, so no legend; hover or focus a bar for its figure. */
export function SalesChart({ monthly, currentMonth }: { monthly: DashboardData["monthly"]; currentMonth: string }) {
  const [active, setActive] = useState<string | null>(null);
  const top = niceCeiling(Math.max(...monthly.map((m) => m.net_sales)));
  return (
    <div className={c.chart}>
      <div className={c.axis} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i}>{top ? compactRupees((top / 4) * i) : i === 0 ? "₹0" : ""}</span>
        ))}
      </div>
      <div className={c.plotArea}>
        {[0, 25, 50, 75, 100].map((p) => (
          <div key={p} className={c.gridline} style={{ bottom: `${p}%` }} aria-hidden />
        ))}
      <ul className={c.plot} aria-label="Net sales by month">
        {monthly.map((m) => {
          const pct = top ? Math.max(0, (m.net_sales / top) * 100) : 0;
          const label = `${monthLabel(m.month)}: ${formatRupees(m.net_sales, { symbol: true })}`;
          return (
            <li
              key={m.month}
              className={c.barCol}
              tabIndex={0}
              aria-label={label}
              onMouseEnter={() => setActive(m.month)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(m.month)}
              onBlur={() => setActive(null)}>
              {active === m.month && <span className={c.tip}>{label}</span>}
              {/* Height is data, known only at runtime. A non-zero month gets at least 2px so it shows. */}
              <div className={c.bar} data-current={m.month === currentMonth || undefined} data-active={active === m.month || undefined} style={{ height: m.net_sales > 0 ? `max(2px, ${pct}%)` : 0 }} />
            </li>
          );
        })}
      </ul>
      </div>
      <div className={c.months} aria-hidden>
        {monthly.map((m) => (
          <span key={m.month}>
            <span className={c.monthLong}>{monthLabel(m.month)}</span>
            <span className={c.monthShort}>{monthLabel(m.month)[0]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
