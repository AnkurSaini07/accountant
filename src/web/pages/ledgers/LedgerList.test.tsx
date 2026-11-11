import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { PAGE_SIZE } from "../../components/ListUrl.tsx";

const group = (id: number, name: string, nature: string, children: object[] = [], parent_id: number | null = null) => ({ id, parent_id, name, nature, is_system: true, children });
const GROUPS = [
  group(1, "Capital Account", "liability"),
  group(2, "Current Assets", "asset", [group(3, "Bank Accounts", "asset", [], 2), group(4, "Cash-in-Hand", "asset", [], 2)]),
  group(5, "Indirect Expenses", "expense"),
];
const row = (id: number, name: string, group_id: number, group_name: string, extra = {}) => ({ id, name, group_id, group_name, nature: "asset", is_system: false, party_id: null as number | null, active: true, ...extra });
const HDFC = row(7, "HDFC Current A/c", 3, "Bank Accounts");
const CASH = row(1, "Cash", 4, "Cash-in-Hand", { is_system: true });
const ACME = row(9, "Acme Castings", 6, "Sundry Debtors", { party_id: 3 });

type Role = "admin" | "accountant" | "operator" | "viewer";
async function open(routes: Record<string, unknown> = {}, role: Role = "accountant") {
  const queries: Record<string, string>[] = [];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const record = (result: unknown) => async (req: Request) => {
    sent.push({ method: req.method, path: new URL(req.url).pathname, body: req.method === "PUT" || new URL(req.url).pathname === "/api/ledgers" ? await req.json() : null });
    return result;
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /ledgers": (req: Request) => {
      queries.push(Object.fromEntries(new URL(req.url).searchParams));
      return { total: 3, ledgers: [HDFC, CASH, ACME], page: 1, page_size: PAGE_SIZE };
    },
    "GET /ledger-groups": { groups: GROUPS },
    "POST /ledgers": record(row(8, "SBI A/c", 3, "Bank Accounts")),
    "PUT /ledgers/7": record(HDFC),
    "POST /ledgers/7/deactivate": record({ ...HDFC, active: false }),
    ...routes,
  });
  render(
    <MemoryRouter initialEntries={["/masters/ledgers"]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("row", { name: /HDFC/ });
  return { user: userEvent.setup(), queries, sent };
}
const picker = (label: string) => screen.getByRole("button", { name: new RegExp(`${label}( \\(required\\))?$`) });

describe("Masters → Ledgers", () => {
  test("rows show group and name, system ledgers marked; the Masters nav marks Ledgers", async () => {
    const { queries } = await open();
    expect(screen.getByRole("row", { name: /HDFC/ })).toHaveTextContent(/Bank Accounts.*HDFC Current A\/c/);
    expect(screen.getByRole("row", { name: /Cash/ })).toHaveTextContent(/Cash-in-Hand.*Cash.*System/);
    expect(screen.getByRole("row", { name: /HDFC/ })).not.toHaveTextContent("System");
    expect(queries).toEqual([{ page: "1", page_size: String(PAGE_SIZE) }]);
    expect(screen.getByRole("link", { name: "Ledgers" })).toHaveAttribute("aria-current", "page");
  });

  test("new ledger: the group picker shows the tree; saving posts and reloads the list", async () => {
    const { user, queries, sent } = await open();
    await user.click(screen.getByRole("button", { name: "New ledger" }));
    const dialog = await screen.findByRole("dialog", { name: "New ledger" });
    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "SBI A/c");
    await user.click(await within(dialog).findByRole("button", { name: /Group \(required\)$/ }));
    const sections = within(await screen.findByRole("listbox")).getAllByRole("group");
    const header = (s: HTMLElement) => document.getElementById(s.getAttribute("aria-labelledby") ?? "")?.textContent;
    expect(sections.map((s) => [header(s), within(s).getAllByRole("option").map((o) => o.textContent)])).toEqual([
      ["Capital Account", ["Capital Account"]],
      ["Current Assets", ["Current Assets", "Bank Accounts", "Cash-in-Hand"]],
      ["Indirect Expenses", ["Indirect Expenses"]],
    ]);
    await user.click(screen.getByRole("option", { name: "Bank Accounts" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([{ method: "POST", path: "/api/ledgers", body: { name: "SBI A/c", group_id: 3 } }]);
    await waitFor(() => expect(queries.length).toBe(2)); // the list fetched again
  });

  test("server field errors show in the dialog, which stays open", async () => {
    const conflict = Response.json({ error: { code: "CONFLICT", message: "x", details: { fields: { name: ["A ledger named Cash already exists."] } } } }, { status: 409 });
    const { user } = await open({ "PUT /ledgers/7": conflict });
    await user.click(screen.getByRole("rowheader", { name: /HDFC/ }));
    const dialog = await screen.findByRole("dialog", { name: "HDFC Current A/c" });
    await waitFor(() => expect(picker("Group")).toHaveTextContent("Bank Accounts"));
    const nameBox = within(dialog).getByRole("textbox", { name: /Name/ });
    await user.clear(nameBox);
    await user.type(nameBox, "Cash");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("A ledger named Cash already exists.")).toBeInTheDocument();
  });

  test("deactivate a user ledger from its dialog", async () => {
    const { user, sent } = await open();
    await user.click(screen.getByRole("rowheader", { name: /HDFC/ }));
    await user.click(await within(await screen.findByRole("dialog")).findByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([{ method: "POST", path: "/api/ledgers/7/deactivate", body: null }]);
  });

  test("a system ledger opens locked: read-only, no Save or Deactivate", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("rowheader", { name: /Cash/ }));
    const dialog = await screen.findByRole("dialog", { name: "Cash" });
    expect(await within(dialog).findByText(/A system ledger: invoices and vouchers post to it/)).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /Name/ })).toHaveAttribute("readonly");
    expect(within(dialog).getByRole("button", { name: /Group \(required\)$/ })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("a party's ledger opens locked, pointing to the party", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("rowheader", { name: /Acme/ }));
    const dialog = await screen.findByRole("dialog", { name: "Acme Castings" });
    expect(await within(dialog).findByText(/A party's ledger: it follows the party's name and kind/)).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /Name/ })).toHaveAttribute("readonly");
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  test("operators and viewers read only: no New button, dialogs locked", async () => {
    for (const role of ["operator", "viewer"] as const) {
      cleanup(); // one render per role
      const { user } = await open({}, role);
      expect(screen.queryByRole("button", { name: "New ledger" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("rowheader", { name: /HDFC/ }));
      const dialog = await screen.findByRole("dialog");
      expect(await within(dialog).findByText("You can view ledgers; ask an accountant or admin to change them.")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    }
  });
});
