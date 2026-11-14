import { formatRupees } from "../../../shared/money.ts";
import { type StatusInfo, formatDate } from "../../components/DocumentList.tsx";
import { CardList } from "../../components/CardList.tsx";
import { GRN_STATUS } from "../purchase/GrnList.tsx";
import { PO_STATUS } from "../purchase/PoList.tsx";
import { CHALLAN_STATUS } from "../sales/ChallanList.tsx";
import { INVOICE_STATUS } from "../sales/InvoiceList.tsx";
import { ORDER_STATUS } from "../sales/OrderList.tsx";
import { QUOTATION_STATUS } from "../sales/QuotationList.tsx";
import type { Dashboard as DashboardData } from "../../../server/dashboard/routes.ts";
import { empty } from "./format.ts";

/** Where each document type lives in the app, and how its statuses read. */
const DOC_TYPES: Record<string, { label: string; path: string; statuses: StatusInfo }> = {
  quotation: { label: "Quotation", path: "/sales/quotations", statuses: QUOTATION_STATUS },
  sales_order: { label: "Sales order", path: "/sales/orders", statuses: ORDER_STATUS },
  challan: { label: "Challan", path: "/sales/challans", statuses: CHALLAN_STATUS },
  invoice: { label: "Invoice", path: "/sales/invoices", statuses: INVOICE_STATUS },
  credit_note: { label: "Credit note", path: "/sales/credit-notes", statuses: INVOICE_STATUS },
  purchase_order: { label: "Purchase order", path: "/purchase/orders", statuses: PO_STATUS },
  grn: { label: "GRN", path: "/purchase/grns", statuses: GRN_STATUS },
};

/** The latest documents: number and amount on top; party, type, date and status under. */
export function RecentDocuments({ rows }: { rows: DashboardData["recent"] }) {
  return (
    <CardList
      label="Recent documents"
      empty="No documents in this financial year yet."
      rows={rows.map((r) => {
        const t = DOC_TYPES[r.type];
        const s = t?.statuses[r.status];
        return {
          id: r.id,
          title: r.number ?? `${t?.label ?? r.type} (draft)`,
          href: t && `${t.path}/${r.id}`,
          amount: formatRupees(r.grand_total, { symbol: true }),
          meta: `${r.party_name} · ${t?.label ?? r.type} · ${formatDate(r.date)}`,
          badge: { label: s?.label ?? r.status, variant: s?.badge ?? "neutral" },
        };
      })}
    />
  );
}
