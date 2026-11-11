import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { PAGE_SIZE } from "../../components/ListUrl.tsx";

const row = (id: number, number: string, party_name: string, status: string, extra = {}) => ({ id, number, date: "2026-11-11", status, party_id: 1, party_name, due_date: null as string | null, grand_total: 0, ...extra });
const ROWS = [row(2, "QTN/26-27/0002", "Sharma Traders", "sent", { due_date: "2026-11-25", grand_total: 14_750_00 }), row(1, "QTN/26-27/0001", "Gupta Engg", "draft")];

async function open(role = ME.role as string) {
  const queries: Record<string, string>[] = [];
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /quotations": (req: Request) => {
      queries.push(Object.fromEntries(new URL(req.url).searchParams));
      return { total: ROWS.length, quotations: ROWS, page: 1, page_size: PAGE_SIZE };
    },
  });
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("row", { name: /Sharma/ });
  return { user: userEvent.setup(), queries };
}

describe("Sales → Quotations", () => {
  test("rows show number, date, party, validity, status and total; the FY comes from the header", async () => {
    const { queries } = await open();
    expect(screen.getByRole("row", { name: /Sharma/ })).toHaveTextContent(/QTN\/26-27\/0002.*11 Nov 2026.*Sharma Traders.*25 Nov 2026.*Sent.*14,750\.00/);
    expect(screen.getByRole("row", { name: /Gupta/ })).toHaveTextContent(/QTN\/26-27\/0001.*Gupta Engg.*Draft/);
    expect(queries).toEqual([{ fy: "2026", page: "1", page_size: String(PAGE_SIZE) }]);
    expect(screen.getByRole("link", { name: "Quotations" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New quotation" })).toHaveAttribute("href", "/sales/quotations/new");
  });

  test("the status filter goes to the API and back to page 1", async () => {
    const { user, queries } = await open();
    await user.click(screen.getByRole("button", { name: /Status$/ }));
    await user.click(await screen.findByRole("option", { name: "Accepted" }));
    await act(() => Bun.sleep(10));
    expect(queries.at(-1)).toEqual({ fy: "2026", status: "accepted", page: "1", page_size: String(PAGE_SIZE) });
  });

  test("operators and viewers get no New button", async () => {
    for (const role of ["operator", "viewer"]) {
      cleanup();
      await open(role);
      expect(screen.queryByRole("link", { name: "New quotation" })).not.toBeInTheDocument();
      expect(within(screen.getByRole("grid", { name: "Quotations" })).getAllByRole("row").length).toBe(3);
    }
  });
});
