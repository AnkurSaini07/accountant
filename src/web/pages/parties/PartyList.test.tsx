import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { balanceText, PAGE_SIZE, SEARCH_DELAY_MS } from "./PartyList.tsx";

type Party = { id: number; name: string; kind: string; registration_type: string; gstin: string | null; state_code: string; phone: string | null; city: string | null; active: boolean; opening_balance: number };
const party = (id: number, name: string, extra: Partial<Party> = {}): Party => ({
  id, name, kind: "customer", registration_type: "unregistered", gstin: null, state_code: "06", phone: null, city: null, active: true, opening_balance: 0, ...extra,
});
const SHARMA = party(1, "Sharma Steels Pvt Ltd", { registration_type: "regular", gstin: "07AABCS1234A1ZQ", city: "New Delhi", phone: "9811000001", opening_balance: -1_23_456_78 });
const GUPTA = party(2, "Gupta Traders", { kind: "supplier", city: "Palwal", opening_balance: 50_000_00 });
const MEHTA = party(3, "Mehta Brothers", { registration_type: "consumer", active: false });

/** Renders the app at `url`; the fake API answers from `parties` and records each list query. */
async function open(url = "/masters/parties", parties: Party[] = [SHARMA, GUPTA], total?: number) {
  const queries: Record<string, string>[] = [];
  fakeApi({
    "GET /auth/me": ME,
    "GET /company": COMPANY,
    "GET /parties": (req: Request) => {
      const query = Object.fromEntries(new URL(req.url).searchParams);
      queries.push(query);
      return { total: total ?? parties.length, parties, page: Number(query.page), page_size: Number(query.page_size) };
    },
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Parties" });
  return { user: userEvent.setup(), queries };
}
const table = () => screen.getByRole("grid", { name: "Parties" });
const names = () => within(table()).queryAllByRole("rowheader").map((c) => c.textContent);

describe("Masters → Parties", () => {
  test("/masters opens the party list; rows show name, GSTIN, city, phone, balance and open the party", async () => {
    const { queries } = await open("/masters");
    await waitFor(() => expect(names()).toEqual(["Sharma Steels Pvt Ltd", "Gupta Traders"]));
    const [sharma, gupta] = within(table()).getAllByRole("row").slice(1);
    expect(sharma).toHaveTextContent(/07AABCS1234A1ZQ.*New Delhi.*9811000001.*1,23,456\.78 Cr/);
    expect(gupta).toHaveTextContent(/Unregistered.*Palwal.*50,000\.00 Dr/);
    expect(queries).toEqual([{ page: "1", page_size: String(PAGE_SIZE) }]);
    expect(screen.getByRole("link", { name: "New party" })).toHaveAttribute("href", "/masters/parties/new");
  });

  test("clicking a row opens that party", async () => {
    const { user } = await open();
    await user.click(await screen.findByRole("rowheader", { name: /Gupta Traders/ }));
    // The party form is #29; until then /masters/parties/:id lands on the Masters placeholder.
    expect(await screen.findByRole("heading", { name: "Masters" })).toBeInTheDocument();
  });

  test("inactive parties carry a badge; consumers say so instead of a GSTIN", async () => {
    await open("/masters/parties?inactive=1", [MEHTA]);
    const row = await screen.findByRole("row", { name: /Mehta Brothers/ });
    expect(row).toHaveTextContent(/Mehta Brothers.*Inactive.*Consumer/);
    expect(screen.getByRole("checkbox", { name: "Show inactive" })).toBeChecked();
  });

  test("loading, then the empty state: different words with and without a filter", async () => {
    await open("/masters/parties", []);
    expect(await within(table()).findByText("No parties yet. Add your first customer or supplier.")).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  test("empty with a filter suggests changing it", async () => {
    await open("/masters/parties?kind=supplier", []);
    expect(await within(table()).findByText("No parties match. Try another search or filter.")).toBeInTheDocument();
  });

  test("search is debounced: one request after the user pauses, from the URL on reload", async () => {
    const { user, queries } = await open();
    await waitFor(() => expect(queries).toHaveLength(1));
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "shar");
    expect(queries).toHaveLength(1); // nothing yet: still typing
    await waitFor(() => expect(queries).toHaveLength(2), { timeout: SEARCH_DELAY_MS * 4 });
    await act(() => new Promise((r) => setTimeout(r, SEARCH_DELAY_MS * 2)));
    expect(queries).toHaveLength(2); // one request for the whole word
    expect(queries[1]).toMatchObject({ q: "shar", page: "1" });
  });

  test("a search in the URL fills the box and the request", async () => {
    const { queries } = await open("/masters/parties?q=gupta&page=2");
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("gupta");
    await waitFor(() => expect(queries[0]).toMatchObject({ q: "gupta", page: "2" }));
  });

  test("kind and inactive filters go to the server and reset to page 1", async () => {
    const { user, queries } = await open("/masters/parties?page=3", [SHARMA], 200);
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "3" }));
    await user.click(screen.getByRole("radio", { name: "Suppliers" }));
    await waitFor(() => expect(queries.at(-1)).toEqual({ kind: "supplier", page: "1", page_size: String(PAGE_SIZE) }));
    await user.click(screen.getByRole("checkbox", { name: "Show inactive" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ kind: "supplier", include_inactive: "true", page: "1" }));
    await user.click(screen.getByRole("radio", { name: "All" }));
    await waitFor(() => expect(queries.at(-1)).not.toHaveProperty("kind"));
  });

  test("pages: range, Next and Previous", async () => {
    const { user, queries } = await open("/masters/parties", [SHARMA, GUPTA], 120);
    expect(await screen.findByText("1–2 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "2" }));
    expect(await screen.findByText(`${PAGE_SIZE + 1}–${PAGE_SIZE + 2} of 120`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "3" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(); // 120 / 50 → 3 pages
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: "2" }));
  });
});

test("balanceText: Dr for receivable, Cr for payable, blank for nil", () => {
  expect([balanceText(12_345_00), balanceText(-5), balanceText(0)]).toEqual(["12,345.00 Dr", "0.05 Cr", ""]);
});
