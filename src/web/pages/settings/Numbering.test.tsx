import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { DEFAULT_PREFIX, DOC_LABELS, DOC_TYPES } from "../../../shared/numbering.ts";
import { Shell } from "../../Shell.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

// Current Indian FY start year, computed independently of the app (FY starts 1 April).
const now = new Date();
const FY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
const short = (y: number) => `${String(y).slice(2)}-${String((y + 1) % 100).padStart(2, "0")}`;
const defaults = (fy: number) => ({
  fy,
  series: DOC_TYPES.map((doc_type) => ({ doc_type, prefix: DEFAULT_PREFIX[doc_type], padding: 4, next_number: doc_type === "invoice" ? 42 : 1 })),
});

async function open(role = "admin", put?: (body: { fy: number; series: unknown[] }) => Response | unknown) {
  const gets: number[] = [];
  const puts: { fy: number; series: { doc_type: string; prefix: string; padding: number; next_number: number }[] }[] = [];
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /series": (req: Request) => {
      const fy = Number(new URL(req.url).searchParams.get("fy"));
      gets.push(fy);
      return defaults(fy);
    },
    "PUT /series": async (req: Request) => {
      const body = (await req.json()) as (typeof puts)[number];
      puts.push(body);
      return put ? put(body) : body;
    },
  });
  render(
    <MemoryRouter initialEntries={["/settings/numbering"]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("region", { name: "Tax invoice" });
  return { user: userEvent.setup(), gets, puts };
}
const rowOf = (label: string) => screen.getByRole("region", { name: label });
const previewOf = (label: string) => within(rowOf(label)).getByLabelText(`${label} next number`);

describe("Settings → Numbering", () => {
  test("lists every document type with the next number for the header's FY", async () => {
    const { gets } = await open();
    expect(gets).toEqual([FY]);
    for (const t of DOC_TYPES) expect(rowOf(DOC_LABELS[t])).toBeInTheDocument();
    expect(previewOf("Tax invoice")).toHaveTextContent(`INV/${short(FY)}/0042`);
    expect(previewOf("Delivery challan")).toHaveTextContent(`DC/${short(FY)}/0001`);
  });

  test("preview updates as you type, and warns past 16 characters", async () => {
    const { user } = await open();
    const invoice = rowOf("Tax invoice");
    const prefix = within(invoice).getByRole("textbox", { name: "Prefix" });
    await user.clear(prefix);
    await user.type(prefix, "SEW-");
    expect(previewOf("Tax invoice")).toHaveTextContent("SEW-0042");
    await user.type(prefix, "TAXINVOICE/");
    expect(within(invoice).getByText(/SEW-TAXINVOICE\/0042 is 19 characters; GST allows 16\./)).toBeInTheDocument();
  });

  test("admin changes prefix, digits and next number, and saves", async () => {
    const { user, puts } = await open();
    const invoice = rowOf("Tax invoice");
    await user.clear(within(invoice).getByRole("textbox", { name: "Prefix" }));
    await user.type(within(invoice).getByRole("textbox", { name: "Prefix" }), "SEW/{{FY}/"); // "{{" types a literal "{"
    const digits = within(invoice).getByRole("textbox", { name: "Digits" });
    await user.clear(digits);
    await user.type(digits, "3");
    const next = within(invoice).getByRole("textbox", { name: "Next number" });
    await user.clear(next);
    await user.type(next, "143");
    await user.tab();
    expect(previewOf("Tax invoice")).toHaveTextContent(`SEW/${short(FY)}/143`);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Numbering saved.")).toBeInTheDocument();
    expect(puts[0]!.fy).toBe(FY);
    expect(puts[0]!.series).toHaveLength(DOC_TYPES.length);
    expect(puts[0]!.series.find((s) => s.doc_type === "invoice")).toEqual({ doc_type: "invoice", prefix: "SEW/{FY}/", padding: 3, next_number: 143 });
  });

  test("next number can't go below the saved one", async () => {
    const { user } = await open();
    const next = within(rowOf("Tax invoice")).getByRole("textbox", { name: "Next number" });
    await user.clear(next);
    await user.type(next, "5");
    await user.tab();
    expect(next).toHaveValue("42");
  });

  test("server errors show on the row's field", async () => {
    const i = DOC_TYPES.indexOf("challan");
    const { user } = await open("admin", () =>
      Response.json(
        { error: { code: "VALIDATION", message: "Some numbers can't go back.", details: { fields: { [`series.${i}.next_number`]: ["Lower than a number already used. Numbers can only move forward."] } } } },
        { status: 400 },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(rowOf("Delivery challan")).findByText("Lower than a number already used. Numbers can only move forward.")).toBeInTheDocument();
  });

  test("switching the FY in the header loads that year", async () => {
    const { user, gets } = await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Financial year" }), `${FY - 1}-${String(FY % 100).padStart(2, "0")}`);
    expect(await screen.findByText(new RegExp(`INV/${short(FY - 1)}/0042`))).toBeInTheDocument();
    expect(gets).toEqual([FY, FY - 1]);
  });

  test("non-admins see it read-only; the settings nav links both pages", async () => {
    await open("accountant");
    expect(screen.getByText("Only an admin can change numbering.")).toBeInTheDocument();
    expect(within(rowOf("Tax invoice")).getByRole("textbox", { name: "Prefix" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getByRole("link", { name: "Numbering" }).closest("[aria-current]")).not.toBeNull();
    expect(within(nav).getByRole("link", { name: "Company" })).toHaveAttribute("href", "/settings/company");
  });
});
