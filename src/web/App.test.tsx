// Component test pattern for every screen: render, find elements by role/label (never CSS classes,
// which React Spectrum generates), interact with userEvent, assert on what the user sees.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, spyOn, test } from "bun:test";
import { MemoryRouter, useLocation } from "react-router";
import { call, client } from "./api.ts";
import { COMPANY, calls, fakeApi, ME, unauthorized } from "./test/fake-api.ts";
import { Shell } from "./App.tsx";
import { NAV, sectionOf } from "./routes.tsx";

/** Renders the app at `path` as a signed-in user and waits for the layout. */
async function renderAt(path: string) {
  fakeApi({ "GET /auth/me": ME, "GET /company": COMPANY });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell />
    </MemoryRouter>,
  );
  const nav = within(await screen.findByRole("treegrid", { name: "Sections" }));
  return { user: userEvent.setup(), nav };
}

const heading = () => screen.getByRole("heading", { level: 1 });

/** Expected FY labels, newest first (Indian FY starts 1 April), computed independently of App.tsx. */
function recentYears(count = 2): [string, string, ...string[]] {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => `${start - i}-${String((start - i + 1) % 100).padStart(2, "0")}`) as [string, string, ...string[]];
}

describe("app layout", () => {
  test("lists every section and marks the current one", async () => {
    const { nav } = await renderAt("/");
    for (const { label } of NAV) expect(nav.getByRole("link", { name: label })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "Dashboard" }).closest("[aria-current]")).not.toBeNull();
    expect(heading()).toHaveTextContent("Dashboard");
  });

  test("navigates between sections without leaving the app", async () => {
    const { user, nav } = await renderAt("/");
    await user.click(nav.getByRole("link", { name: "Purchase" }));
    expect(heading()).toHaveTextContent("Purchase");
    expect(nav.getByRole("link", { name: "Purchase" }).closest("[aria-current]")).not.toBeNull();
    expect(nav.getByRole("link", { name: "Dashboard" }).closest("[aria-current]")).toBeNull();
  });

  test("is keyboard navigable", async () => {
    const { user } = await renderAt("/");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Dashboard");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(heading()).toHaveTextContent("Purchase");
  });

  test("deep links highlight their section", async () => {
    const { nav } = await renderAt("/sales/invoices/42");
    expect(heading()).toHaveTextContent("Sales");
    expect(nav.getByRole("link", { name: "Sales" }).closest("[aria-current]")).not.toBeNull();
  });

  test("unknown paths show a not-found page", async () => {
    await renderAt("/no-such-page");
    expect(heading()).toHaveTextContent("Page not found");
  });

  test("header shows the company and lets the user switch financial year", async () => {
    const { user } = await renderAt("/");
    expect(await screen.findByText("Saini Engineering Works")).toBeInTheDocument();
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
    const { user } = await renderAt("/");
    fakeApi({ "GET /company": Response.json({ error: { code: "CONFLICT", message: "Invoice number INV-1 already exists" } }, { status: 409 }) });
    await act(() => call(client.api.company.$get()).catch(() => {}));
    const toast = await screen.findByRole("alertdialog");
    expect(toast).toHaveTextContent("Invoice number INV-1 already exists");
    await user.click(within(toast).getByRole("button", { name: /close|dismiss/i }));
    expect(screen.queryByText("Invoice number INV-1 already exists")).not.toBeInTheDocument();
  });
});

/** Shows the current URL so tests can assert on redirects. */
function Url() {
  const l = useLocation();
  return <output aria-label="url">{l.pathname + l.search}</output>;
}
function renderSignedOut(path: string, routes: Record<string, unknown> = {}) {
  fakeApi({ "GET /auth/me": unauthorized(), ...routes });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell />
      <Url />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
const url = () => screen.getByRole("status", { name: "url" }).textContent;

describe("sign-in", () => {
  test("signed out: any page redirects to sign-in, remembering where you were", async () => {
    renderSignedOut("/sales/invoices?fy=2026-27");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(url()).toBe("/sign-in?returnTo=%2Fsales%2Finvoices%3Ffy%3D2026-27");
    expect(screen.queryByRole("treegrid")).not.toBeInTheDocument();
  });

  test("the button starts the Pocket ID login with returnTo", async () => {
    const assign = spyOn(window.location, "assign").mockImplementation(() => {});
    try {
      const user = renderSignedOut("/purchase");
      await user.click(await screen.findByRole("button", { name: "Sign in with Pocket ID" }));
      expect(assign).toHaveBeenCalledWith("/api/auth/login?returnTo=%2Fpurchase");
    } finally {
      assign.mockRestore();
    }
  });

  test("returnTo can't point off-site", async () => {
    const assign = spyOn(window.location, "assign").mockImplementation(() => {});
    try {
      const user = renderSignedOut("/sign-in?returnTo=%2F%2Fevil.com");
      await user.click(await screen.findByRole("button", { name: "Sign in with Pocket ID" }));
      expect(assign).toHaveBeenCalledWith("/api/auth/login?returnTo=%2F");
    } finally {
      assign.mockRestore();
    }
  });

  test("already signed in: /sign-in goes on to returnTo", async () => {
    fakeApi({ "GET /auth/me": ME, "GET /company": COMPANY });
    render(
      <MemoryRouter initialEntries={["/sign-in?returnTo=%2Freports"]}>
        <Shell />
        <Url />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
    expect(url()).toBe("/reports");
  });

  test("no-access page is reachable signed out and links back to sign in", async () => {
    renderSignedOut("/no-access");
    expect(await screen.findByRole("heading", { name: "No access yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  test("a 401 mid-session (expired session) sends you to sign in", async () => {
    await renderAt("/sales");
    fakeApi({ "GET /company": unauthorized() });
    await act(() => call(client.api.company.$get()).catch(() => {}));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  test("header shows who's signed in; Sign out ends both sessions", async () => {
    const assign = spyOn(window.location, "assign").mockImplementation(() => {});
    try {
      const { user } = await renderAt("/");
      expect(screen.getByText("Asha Verma")).toBeInTheDocument();
      fakeApi({ "POST /auth/logout": { endSessionUrl: "https://id.example/logout?id_token_hint=x" } });
      await user.click(screen.getByRole("button", { name: "Sign out" }));
      expect(calls).toEqual(["POST /auth/logout"]);
      expect(assign).toHaveBeenCalledWith("https://id.example/logout?id_token_hint=x");
    } finally {
      assign.mockRestore();
    }
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
