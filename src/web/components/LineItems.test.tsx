import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "@react-spectrum/s2/Form";
import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { documentTotals } from "../../shared/document-totals.ts";
import { formatRupees } from "../../shared/money.ts";
import { fakeApi } from "../test/fake-api.ts";
import { SEARCH_DELAY_MS } from "./ListUrl.tsx";
import { emptyLine, type LineDraft, LineItems, linesBody, type TotalsContext } from "./LineItems.tsx";

const item = (id: number, code: string, name: string, extra = {}) => ({
  id, code, name, type: "finished", hsn: "73181500", unit: "NOS", unit_decimals: 0, gst_rate: 18, sale_price: 12_50, purchase_price: 9_00, active: true, ...extra,
});
const BOLT = item(1, "FG-101", "Hex Bolt M10 x 50");
const ROD = item(2, "RM-12", "MS Rod 12mm", { hsn: "72142090", unit: "KGS", unit_decimals: 3, sale_price: 62_40, purchase_price: 58_00 });
const NOHSN = item(3, "X-1", "Unclassified part", { hsn: null });
const ALL = [BOLT, ROD, NOHSN];

const LOCAL: TotalsContext = { type: "invoice", companyState: "06", partyState: "06", placeOfSupply: "06" };
let latest: LineDraft[] = [];
function Harness({ ctx = LOCAL, side = "sale", errors = {}, isReadOnly = false }: { ctx?: TotalsContext; side?: "sale" | "purchase"; errors?: Record<string, string[]>; isReadOnly?: boolean }) {
  const [lines, setLines] = useState([emptyLine()]);
  latest = lines;
  return (
    <Form validationErrors={errors}>
      <LineItems lines={lines} onChange={setLines} side={side} totals={ctx} isReadOnly={isReadOnly} />
    </Form>
  );
}
function open(props: Parameters<typeof Harness>[0] = {}) {
  fakeApi({ "GET /items": (req: Request) => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
    const items = ALL.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(q));
    return { total: items.length, items, page: 1, page_size: 20 };
  } });
  render(<Harness {...props} />);
  return userEvent.setup();
}
const box = (label: string) => screen.getByRole("textbox", { name: label });
const itemBox = (n: number) => screen.getByRole("combobox", { name: `Item, line ${n}` });
async function pick(user: ReturnType<typeof userEvent.setup>, n: number, typed: string, option: RegExp) {
  await user.type(itemBox(n), typed);
  await act(() => Bun.sleep(SEARCH_DELAY_MS + 50));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("LineItems", () => {
  test("picking an item fills HSN, unit, rate and GST; amounts and totals match the server's", async () => {
    const user = open();
    await pick(user, 1, "bolt", /Hex Bolt/);
    expect(box("Rate, line 1")).toHaveValue("12.50");
    const row = itemBox(1).closest("tr")!;
    expect(row).toHaveTextContent(/73181500.*NOS.*18%/);
    await user.type(box("Qty, line 1"), "5000");
    expect(screen.getByLabelText("Amount, line 1")).toHaveTextContent("62,500.00");

    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(screen.getByLabelText("Totals")).toHaveTextContent("Taxable value62,500.00"); // an unfinished line is left out
    await pick(user, 2, "rod", /MS Rod/);
    await user.type(box("Qty, line 2"), "1250.5");
    await user.type(box("Discount %, line 2"), "2.5");
    expect(screen.getByLabelText("Amount, line 2")).toHaveTextContent("76,080.42");

    // The same input through the server's function: what the screen shows is what will be saved.
    const server = documentTotals({ type: "invoice", companyState: "06", partyState: "06", placeOfSupply: "06", lines: [
      { hsn: BOLT.hsn, qty: 5000, unit_decimals: 0, rate: 12_50, discount_bp: 0, gst_rate: 18 },
      { hsn: ROD.hsn, qty: 1_250_500, unit_decimals: 3, rate: 62_40, discount_bp: 250, gst_rate: 18 },
    ] });
    const summary = screen.getByLabelText("Totals");
    expect(summary).toHaveTextContent(`Taxable value${formatRupees(server.taxable_total)}`);
    expect(summary).toHaveTextContent(`CGST${formatRupees(server.cgst_total)}SGST${formatRupees(server.sgst_total)}`);
    expect(summary).toHaveTextContent(`Round off${formatRupees(server.round_off)}Total${formatRupees(server.grand_total, { symbol: true })}`);
    expect(server.grand_total).toBe(1_63_525_00);
    expect(linesBody(latest)).toEqual({ errors: {}, lines: [
      { item_id: 1, description: "", qty: 5000, rate: 12_50, discount_bp: 0, gst_rate: 18 },
      { item_id: 2, description: "", qty: 1_250_500, rate: 62_40, discount_bp: 250, gst_rate: 18 },
    ] });
  });

  test("out of state: IGST; a purchase fills the purchase price", async () => {
    const user = open({ ctx: { type: "purchase_bill", companyState: "06", partyState: "07", placeOfSupply: "06" }, side: "purchase" });
    await pick(user, 1, "rod", /MS Rod/);
    expect(box("Rate, line 1")).toHaveValue("58.00");
    await user.type(box("Qty, line 1"), "2000");
    const summary = screen.getByLabelText("Totals");
    expect(summary).toHaveTextContent("IGST20,880.00");
    expect(summary).not.toHaveTextContent("CGST");
  });

  test("Enter moves through the cells; Enter or Tab in the last cell adds a line and goes to it", async () => {
    const user = open();
    await pick(user, 1, "bolt", /Hex Bolt/);
    await user.click(box("Description, line 1"));
    await user.keyboard("{Enter}");
    expect(box("Qty, line 1")).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    expect(box("Discount %, line 1")).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(itemBox(2)).toHaveFocus());
    await user.click(box("Discount %, line 2"));
    await user.tab();
    await waitFor(() => expect(itemBox(3)).toHaveFocus());
    await user.tab({ shift: true }); // Shift+Tab goes back as usual
    expect(screen.getByRole("button", { name: "Remove line 2" })).toHaveFocus();
  });

  test("Enter that picks an item in the list picks it and stays there", async () => {
    const user = open();
    await user.type(itemBox(1), "rod");
    await act(() => Bun.sleep(SEARCH_DELAY_MS + 50));
    await screen.findByRole("option", { name: /MS Rod/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(itemBox(1)).toHaveValue("RM-12 – MS Rod 12mm");
    expect(box("Rate, line 1")).toHaveValue("62.40");
    expect(itemBox(1)).toHaveFocus();
  });

  test("remove a line from the keyboard; removing the only line leaves an empty one", async () => {
    const user = open();
    await pick(user, 1, "bolt", /Hex Bolt/);
    await user.click(screen.getByRole("button", { name: "Add line" }));
    await pick(user, 2, "rod", /MS Rod/);
    screen.getByRole("button", { name: "Remove line 1" }).focus();
    await user.keyboard("{Enter}");
    expect(itemBox(1)).toHaveValue("RM-12 – MS Rod 12mm");
    expect(screen.queryByRole("combobox", { name: "Item, line 2" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove line 1" }));
    expect(itemBox(1)).toHaveValue("");
  });

  test("errors: unfinished lines name their fields; server errors show on the cell; no HSN explains itself", async () => {
    let user = open();
    await pick(user, 1, "bolt", /Hex Bolt/);
    await user.type(box("Qty, line 1"), "1.5"); // NOS has no decimals
    await user.click(screen.getByRole("button", { name: "Add line" }));
    await user.type(box("Rate, line 2"), "abc");
    expect(linesBody(latest).errors).toEqual({
      "lines.0.qty": ["Enter a whole number."],
      "lines.1.item_id": ["Choose an item."],
      "lines.1.qty": ["Enter a quantity."],
      "lines.1.rate": ["Enter an amount like 250 or 1,250.50."],
    });
    cleanup();
    user = open({ errors: { "lines.0.qty": ["Quantity must be more than 0."] } });
    expect(await screen.findByText("Quantity must be more than 0.")).toBeInTheDocument();
    await pick(user, 1, "unclass", /Unclassified/);
    await user.type(box("Qty, line 1"), "1");
    expect(await screen.findByText(/Totals can't be worked out yet: Line 1: HSN\/SAC must be/)).toBeInTheDocument();
  });

  test("read-only: no add, remove or editing", () => {
    open({ isReadOnly: true });
    expect(screen.queryByRole("button", { name: "Add line" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove line/ })).not.toBeInTheDocument();
    expect(box("Qty, line 1")).toHaveAttribute("readonly");
  });
});
