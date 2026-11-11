import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { PAGE_SIZE, SEARCH_DELAY_MS } from "./ItemList.tsx";

const row = (id: number, code: string, name: string, extra = {}) => ({ id, code, name, type: "finished", hsn: null, unit: "NOS", gst_rate: 18, sale_price: 0, active: true, ...extra });
const BOLT = row(1, "FG-101", "Hex Bolt M10 x 50", { hsn: "73181500", sale_price: 12_50 });
const ROD = row(2, "RM-1", "MS Rod 12mm", { type: "raw", unit: "KGS", gst_rate: 5, sale_price: 1_25_000_00 });

async function open(url = "/masters/items", items = [BOLT, ROD], total?: number) {
  const queries: Record<string, string>[] = [];
  fakeApi({
    "GET /auth/me": ME,
    "GET /company": COMPANY,
    "GET /items": (req: Request) => {
      const query = Object.fromEntries(new URL(req.url).searchParams);
      queries.push(query);
      return { total: total ?? items.length, items, page: Number(query.page), page_size: Number(query.page_size) };
    },
    "GET /units": [],
    "GET /gst-rates": [],
    "GET /items/2": { ...ROD, description: "", unit_id: 3, unit_decimals: 3, gst_rate_id: 4, purchase_price: 0, opening_qty: 0, opening_value: 0, reorder_level: null, updated_at: "" },
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Items" });
  return { user: userEvent.setup(), queries };
}
const table = () => screen.getByRole("grid", { name: "Items" });

describe("Masters → Items", () => {
  test("rows show code, name, type, HSN, unit, GST and price; the Masters nav marks Items", async () => {
    const { queries } = await open();
    const bolt = await screen.findByRole("row", { name: /Hex Bolt/ });
    expect(bolt).toHaveTextContent(/FG-101.*Hex Bolt M10 x 50.*Finished good.*73181500.*NOS.*18%.*12\.50/);
    expect(screen.getByRole("row", { name: /MS Rod/ })).toHaveTextContent(/Raw material.*KGS.*5%.*1,25,000\.00/);
    expect(queries).toEqual([{ page: "1", page_size: String(PAGE_SIZE) }]);
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page"); // the Masters sub-nav
    expect(screen.getByRole("link", { name: "Parties" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "New item" })).toHaveAttribute("href", "/masters/items/new");
  });

  test("clicking a row opens the item; the nav still marks Items there", async () => {
    const { user } = await open();
    await user.click(await screen.findByRole("rowheader", { name: /MS Rod/ }));
    expect(await screen.findByRole("heading", { name: "MS Rod 12mm" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
  });

  test("empty states, with and without a filter", async () => {
    await open("/masters/items", []);
    expect(await within(table()).findByText("No items yet. Add what you buy, make and sell.")).toBeInTheDocument();
  });

  test("empty with a filter suggests changing it", async () => {
    await open("/masters/items?type=service", []);
    expect(await within(table()).findByText("No items match. Try another search or filter.")).toBeInTheDocument();
  });

  test("search is debounced into one request", async () => {
    const { user, queries } = await open();
    await waitFor(() => expect(queries).toHaveLength(1));
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "bolt");
    expect(queries).toHaveLength(1);
    await waitFor(() => expect(queries).toHaveLength(2), { timeout: SEARCH_DELAY_MS * 4 });
    await act(() => new Promise((r) => setTimeout(r, SEARCH_DELAY_MS * 2)));
    expect(queries).toHaveLength(2);
    expect(queries[1]).toMatchObject({ q: "bolt", page: "1" });
  });

  test("type and inactive filters reach the server and reset to page 1; pages move", async () => {
    const { user, queries } = await open("/masters/items?page=2", [BOLT], 120);
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "2" }));
    await user.click(screen.getByRole("button", { name: /Type$/ }));
    await user.click(await screen.findByRole("option", { name: "Raw material" }));
    await waitFor(() => expect(queries.at(-1)).toEqual({ type: "raw", page: "1", page_size: String(PAGE_SIZE) }));
    await user.click(screen.getByRole("checkbox", { name: "Show inactive" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ type: "raw", include_inactive: "true", page: "1" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "2" }));
  });

  test("inactive items carry a badge", async () => {
    await open("/masters/items?inactive=1", [row(9, "OLD", "Old Washer", { active: false })]);
    expect(await screen.findByRole("row", { name: /Old Washer/ })).toHaveTextContent(/Old Washer.*Inactive/);
  });
});
