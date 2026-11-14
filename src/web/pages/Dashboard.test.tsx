import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../Shell.tsx";
import { COMPANY, fakeApi, ME } from "../test/fake-api.ts";
import { niceCeiling } from "./dashboard/format.ts";

const months = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"].map((m, i) => ({ month: `${i < 9 ? 2026 : 2027}-${m}`, net_sales: 0 }));
const DATA = {
  net_sales: 1_13_200_00, output_gst: 20_376_00, invoice_count: 2, draft_invoices: 1,
  quotes_awaiting: 1, quotes_awaiting_value: 59_000_00, orders_to_deliver: 2, pos_to_receive: 0,
  monthly: months.map((m) => (m.month === "2026-11" ? { ...m, net_sales: 1_13_200_00 } : m)),
  top_customers: [{ party_id: 7, party_name: "Acme Castings Pvt Ltd", net_sales: 1_13_200_00 }],
  recent: [
    { id: 3, type: "invoice", number: null, date: "2026-11-11", status: "draft", party_name: "Delta Auto Components", grand_total: 1_44_550_00 },
    { id: 1, type: "invoice", number: "INV/26-27/0001", date: "2026-11-11", status: "finalized", party_name: "Acme Castings Pvt Ltd", grand_total: 1_33_576_00 },
  ],
};

async function open(role: string = ME.role) {
  const queries: string[] = [];
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /dashboard": (req: Request) => (queries.push(new URL(req.url).search), DATA),
  });
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("link", { name: "INV/26-27/0001" });
  return queries;
}

describe("Dashboard", () => {
  test("headline numbers, the work waiting, recent documents and top customers for the header's FY", async () => {
    expect(await open()).toEqual(["?fy=2026"]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/, Asha$/);
    expect(screen.getByRole("region", { name: "Net sales" })).toHaveTextContent("₹1,13,200");
    expect(screen.getByRole("region", { name: "Output GST" })).toHaveTextContent("₹20,376");
    expect(screen.getByRole("region", { name: "Invoices finalized" })).toHaveTextContent(/2.*1 draft waiting/);
    expect(screen.getByRole("link", { name: "Quotations awaiting reply: 1" })).toHaveAttribute("href", "/sales/quotations?status=sent");
    expect(screen.getByRole("link", { name: "Sales orders to deliver: 2" })).toHaveAttribute("href", "/sales/orders?status=finalized");
    const recent = within(screen.getByRole("list", { name: "Recent documents" })).getAllByRole("listitem");
    expect(recent[0]).toHaveTextContent(/Invoice \(draft\).*₹1,44,550\.00.*Delta Auto Components · Invoice · 11 Nov 2026.*Draft/);
    expect(within(recent[1]!).getByRole("link", { name: "INV/26-27/0001" })).toHaveAttribute("href", "/sales/invoices/1");
    expect(within(screen.getByRole("list", { name: "Net sales by month" })).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByRole("listitem", { name: "Nov: ₹1,13,200.00" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Acme Castings Pvt Ltd" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("link", { name: "New invoice" })).toHaveAttribute("href", "/sales/invoices/new");
    cleanup();
  });

  test("quick actions follow the role: operators get challans and GRNs, viewers none", async () => {
    await open("operator");
    expect(screen.queryByRole("link", { name: "New invoice" })).toBeNull();
    expect(screen.getByRole("link", { name: "Receive goods" })).toHaveAttribute("href", "/purchase/grns/new");
    cleanup();
    await open("viewer");
    expect(screen.queryByRole("link", { name: "New challan" })).toBeNull();
    cleanup();
  });
});

test("niceCeiling: a round top for 4 gridlines", () => {
  expect(niceCeiling(0)).toBe(0);
  expect(niceCeiling(1_13_200_00)).toBe(2_00_000_00);
  expect(niceCeiling(90)).toBe(100);
  expect(niceCeiling(400)).toBe(400);
});
