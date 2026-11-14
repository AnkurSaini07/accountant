// Every document status badge in one place, to judge the colours side by side.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StatusInfo } from "../web/components/DocumentList.tsx";
import { StatusBadge } from "../web/components/StatusBadge.tsx";
import { GRN_STATUS } from "../web/pages/purchase/GrnList.tsx";
import { PO_STATUS } from "../web/pages/purchase/PoList.tsx";
import { CHALLAN_STATUS } from "../web/pages/sales/ChallanList.tsx";
import { INVOICE_STATUS } from "../web/pages/sales/InvoiceList.tsx";
import { ORDER_STATUS } from "../web/pages/sales/OrderList.tsx";
import { QUOTATION_STATUS } from "../web/pages/sales/QuotationList.tsx";

const ALL: [string, StatusInfo][] = [
  ["Quotation", QUOTATION_STATUS],
  ["Sales order", ORDER_STATUS],
  ["Challan", CHALLAN_STATUS],
  ["Invoice / credit note", INVOICE_STATUS],
  ["Purchase order", PO_STATUS],
  ["GRN", GRN_STATUS],
];
const grid = { display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "center" } as const;
const row = { display: "flex", gap: 8, flexWrap: "wrap" } as const;

function AllStatuses() {
  return (
    <div style={grid}>
      {ALL.map(([name, statuses]) => (
        <div key={name} style={{ display: "contents" }}>
          <span>{name}</span>
          <span style={row}>
            {Object.keys(statuses).map((s) => <StatusBadge key={s} statuses={statuses} status={s} />)}
          </span>
        </div>
      ))}
    </div>
  );
}

const meta = { title: "Components/Status badges", component: AllStatuses } satisfies Meta<typeof AllStatuses>;
export default meta;
export const All: StoryObj<typeof meta> = {};
