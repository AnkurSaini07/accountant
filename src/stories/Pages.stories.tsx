// Whole screens: the real app (<Shell />) at a route, with /api answered by fixtures. For seeing a
// component change in context; the parts have their own stories under Layout/ and Components/.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Shell } from "../web/Shell.tsx";

const months = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"].map((m, i) => `${i < 9 ? 2026 : 2027}-${m}`);
const SALES = [3_10_000_00, 4_25_000_00, 3_80_500_00, 5_12_000_00, 4_90_000_00, 6_05_000_00, 5_40_000_00, 1_13_200_00];
const DASHBOARD = {
  net_sales: SALES.reduce((a, b) => a + b, 0), output_gst: 6_43_000_00, invoice_count: 148, draft_invoices: 3,
  quotes_awaiting: 4, quotes_awaiting_value: 2_59_000_00, orders_to_deliver: 6, pos_to_receive: 2,
  monthly: months.map((month, i) => ({ month, net_sales: SALES[i] ?? 0 })),
  top_customers: [
    { party_id: 7, party_name: "Acme Castings Pvt Ltd", net_sales: 12_40_000_00 },
    { party_id: 8, party_name: "Delta Auto Components", net_sales: 9_80_000_00 },
    { party_id: 9, party_name: "Gupta Traders", net_sales: 6_10_000_00 },
    { party_id: 10, party_name: "Sharma Steels Pvt Ltd", net_sales: 3_25_000_00 },
  ],
  recent: [
    { id: 3, type: "invoice", number: null, date: "2026-11-11", status: "draft", party_name: "Delta Auto Components", grand_total: 1_44_550_00 },
    { id: 1, type: "invoice", number: "INV/26-27/0148", date: "2026-11-11", status: "finalized", party_name: "Acme Castings Pvt Ltd", grand_total: 1_33_576_00 },
    { id: 5, type: "quotation", number: "QT/26-27/0031", date: "2026-11-10", status: "sent", party_name: "Gupta Traders", grand_total: 59_000_00 },
    { id: 4, type: "challan", number: "DC/26-27/0077", date: "2026-11-09", status: "issued", party_name: "Acme Castings Pvt Ltd", grand_total: 0 },
    { id: 2, type: "grn", number: "GRN/26-27/0012", date: "2026-11-08", status: "received", party_name: "Haryana Steel Traders", grand_total: 2_10_000_00 },
  ],
};

const PARTY = {
  id: 7, name: "Sharma Steels Pvt Ltd", kind: "customer", registration_type: "regular", gstin: "07AABCS1234A1Z5", pan: "AABCS1234A", state_code: "07",
  contact_person: "R. Sharma", phone: "9811000001", email: null, credit_days: 30, credit_limit: 5_00_000_00, opening_balance: -1_23_456_78,
  active: true, updated_at: "2026-11-11T00:00:00Z",
  addresses: [
    { id: 1, kind: "billing", label: null, address: "12 Okhla Phase II", city: "New Delhi", pincode: "110020", state_code: "07" },
    { id: 2, kind: "shipping", label: "Plant 2", address: "Plot 88, IMT", city: "Faridabad", pincode: "121003", state_code: "06" },
  ],
};
const partyRow = (id: number, name: string, city: string, extra = {}) => ({
  id, name, kind: "customer", registration_type: "regular", gstin: null, city, phone: "98110 0000" + id, opening_balance: 0, active: true, ...extra,
});
const PARTIES = {
  total: 4, page: 1, page_size: 50,
  parties: [
    partyRow(7, "Acme Castings Pvt Ltd", "Faridabad", { gstin: "06AAACA1234B1ZM", opening_balance: 2_50_000_00 }),
    partyRow(8, "Delta Auto Components", "Gurugram", { gstin: "06AABCD5678E1Z2" }),
    partyRow(9, "Gupta Traders", "Delhi", { registration_type: "unregistered" }),
    partyRow(10, "Old Supplier & Co", "Palwal", { kind: "supplier", active: false }),
  ],
};

const meta = { title: "Pages", component: Shell, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Shell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = { parameters: { route: "/", api: { "GET /dashboard": DASHBOARD } } };
export const DashboardOperator: Story = {
  parameters: { route: "/", api: { "GET /auth/me": { id: 2, name: "Ravi Kumar", email: null, role: "operator" }, "GET /dashboard": DASHBOARD } },
};
export const Parties: Story = { parameters: { route: "/masters/parties", api: { "GET /parties": PARTIES } } };
export const PartyEdit: Story = { parameters: { route: "/masters/parties/7", api: { "GET /parties/7": PARTY } } };
export const PartyNew: Story = { parameters: { route: "/masters/parties/new" } };
