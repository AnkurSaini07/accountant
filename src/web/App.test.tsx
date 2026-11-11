// Component test pattern for every screen: render, find elements by role/label (never CSS classes,
// which React Spectrum generates), interact with userEvent, assert on what the user sees.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { api } from "./api.ts";
import { Shell } from "./App.tsx";
import { NAV, sectionOf } from "./routes.tsx";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell />
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), nav: within(screen.getByRole("treegrid", { name: "Sections" })) };
}

const heading = () => screen.getByRole("heading", { level: 1 });

/** Expected FY labels, newest first (Indian FY starts 1 April), computed independently of App.tsx. */
function recentYears(count = 2): [string, string, ...string[]] {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => `${start - i}-${String((start - i + 1) % 100).padStart(2, "0")}`) as [string, string, ...string[]];
}

describe("app layout", () => {
  test("lists every section and marks the current one", () => {
    const { nav } = renderAt("/");
    for (const { label } of NAV) expect(nav.getByRole("link", { name: label })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "Dashboard" }).closest("[aria-current]")).not.toBeNull();
    expect(heading()).toHaveTextContent("Dashboard");
  });

  test("navigates between sections without leaving the app", async () => {
    const { user, nav } = renderAt("/");
    await user.click(nav.getByRole("link", { name: "Purchase" }));
    expect(heading()).toHaveTextContent("Purchase");
    expect(nav.getByRole("link", { name: "Purchase" }).closest("[aria-current]")).not.toBeNull();
    expect(nav.getByRole("link", { name: "Dashboard" }).closest("[aria-current]")).toBeNull();
  });

  test("is keyboard navigable", async () => {
    const { user } = renderAt("/");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Dashboard");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(heading()).toHaveTextContent("Purchase");
  });

  test("deep links highlight their section", () => {
    const { nav } = renderAt("/sales/invoices/42");
    expect(heading()).toHaveTextContent("Sales");
    expect(nav.getByRole("link", { name: "Sales" }).closest("[aria-current]")).not.toBeNull();
  });

  test("unknown paths show a not-found page", () => {
    renderAt("/no-such-page");
    expect(heading()).toHaveTextContent("Page not found");
  });

  test("header shows the company and lets the user switch financial year", async () => {
    const { user } = renderAt("/");
    expect(screen.getByText("My Company")).toBeInTheDocument();
    const picker = () => screen.getByRole("button", { name: /Financial year/ });

    const [current, previous] = recentYears();
    expect(picker()).toHaveTextContent(current);

    await user.click(picker());
    const listbox = within(screen.getByRole("listbox"));
    expect(listbox.getAllByRole("option").map((o) => o.textContent)).toEqual(recentYears(3));
    await user.click(listbox.getByRole("option", { name: previous }));

    expect(picker()).toHaveTextContent(previous);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("api failures", () => {
  test("show a toast the user can read and dismiss", async () => {
    const { user } = renderAt("/");
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ error: { code: "CONFLICT", message: "Invoice number INV-1 already exists" } }, { status: 409 })) as unknown as typeof fetch;
    try {
      await act(() => api.post("/invoices", {}).catch(() => {}));
    } finally {
      globalThis.fetch = realFetch;
    }
    const toast = await screen.findByRole("alertdialog");
    expect(toast).toHaveTextContent("Invoice number INV-1 already exists");
    await user.click(within(toast).getByRole("button", { name: /close|dismiss/i }));
    expect(screen.queryByText("Invoice number INV-1 already exists")).not.toBeInTheDocument();
  });
});

describe("sectionOf", () => {
  test("maps any path to its top-level section", () => {
    expect(sectionOf("/")).toBe("/");
    expect(sectionOf("/sales")).toBe("/sales");
    expect(sectionOf("/sales/invoices/42")).toBe("/sales");
    expect(sectionOf("/unknown/x")).toBe("/");
  });
});
