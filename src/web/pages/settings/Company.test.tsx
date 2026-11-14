import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { gstinCheckChar } from "../../../shared/gstin.ts";
import { Shell } from "../../Shell.tsx";
import { COMPANY, calls, fakeApi, ME } from "../../test/fake-api.ts";

const HR = "06AAPFU0939F1Z" + gstinCheckChar("06AAPFU0939F1Z");

/** Renders Settings → Company as `role`; PUT /company echoes the body back (as the server would, with ids). */
async function open(role: string = "admin", company = COMPANY) {
  const puts: Record<string, unknown>[] = [];
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": company,
    "PUT /company": async (req: Request) => {
      const body = (await req.json()) as Record<string, unknown>;
      puts.push(body);
      return { id: 1, ...body };
    },
  });
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "Company" });
  return { user: userEvent.setup(), puts };
}

const field = (name: string, scope: HTMLElement = document.body) => within(scope).getByRole("textbox", { name: new RegExp(`^${name}`) });
const header = () => screen.getByRole("banner");

describe("Settings → Company", () => {
  test("/settings opens the company form, filled in; the header shows the company", async () => {
    await open();
    expect(field("Legal name")).toHaveValue("Saini Engineering Works");
    const office = screen.getByRole("region", { name: "Address 1" });
    expect(field("Name", office)).toHaveValue("Registered office");
    expect(field("PIN code", office)).toHaveValue("121005");
    expect(within(office).getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("No bank accounts yet.")).toBeInTheDocument();
    expect(within(header()).getByText("Saini Engineering Works")).toBeInTheDocument();
  });

  test("admin edits everything, adds a godown and two bank accounts, and saves", async () => {
    const { user, puts } = await open();
    await user.clear(field("Legal name"));
    await user.type(field("Legal name"), "Saini Engg. Works Pvt Ltd");
    await user.type(field("Trade name"), "SEW");
    await user.type(field("Phone"), "9810000000");
    await user.type(screen.getByRole("textbox", { name: /^Terms/ }), "Goods once sold will not be taken back.");

    await user.click(screen.getByRole("button", { name: "Add address" }));
    const godown = screen.getByRole("region", { name: "Address 2" });
    await user.type(field("Name", godown), "Godown");
    await user.type(field("City", godown), "Faridabad");
    await user.click(within(godown).getByRole("button", { name: "Set as primary" }));

    await user.click(screen.getByRole("button", { name: "Add bank account" }));
    await user.click(screen.getByRole("button", { name: "Add bank account" }));
    for (const [i, bank, number, ifsc] of [[1, "HDFC Bank", "50100012345678", "HDFC0001234"], [2, "SBI", "30000000001", "SBIN0001234"]] as const) {
      const acct = screen.getByRole("region", { name: `Bank account ${i}` });
      await user.type(field("Bank", acct), bank);
      await user.type(field("Account number", acct), number);
      await user.type(field("IFSC", acct), ifsc);
    }
    expect(within(screen.getByRole("region", { name: "Bank account 1" })).getByText("Default")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Company details saved.")).toBeInTheDocument();
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      legal_name: "Saini Engg. Works Pvt Ltd",
      trade_name: "SEW",
      phone: "9810000000",
      terms: "Goods once sold will not be taken back.",
      addresses: [
        { label: "Registered office", is_primary: false },
        { label: "Godown", city: "Faridabad", is_primary: true },
      ],
      bank_accounts: [
        { bank_name: "HDFC Bank", account_number: "50100012345678", ifsc: "HDFC0001234", is_default: true },
        { bank_name: "SBI", account_number: "30000000001", ifsc: "SBIN0001234", is_default: false },
      ],
    });
    expect(puts[0]).not.toHaveProperty("id");
    // Saved data reloads into the form, and the header switches to the trade name.
    expect(field("Trade name")).toHaveValue("SEW");
    expect(within(header()).getByText("SEW")).toBeInTheDocument();
  });

  test("removing the primary address makes the next one primary", async () => {
    const { user } = await open("admin", {
      ...COMPANY,
      addresses: [COMPANY.addresses[0]!, { id: 2, label: "Factory", address: "", city: "", pincode: null, is_primary: false }],
    });
    await user.click(within(screen.getByRole("region", { name: "Address 1" })).getByRole("button", { name: "Remove address" }));
    const only = screen.getByRole("region", { name: "Address 1" });
    expect(field("Name", only)).toHaveValue("Factory");
    expect(within(only).getByText("Primary")).toBeInTheDocument();
    expect(within(only).queryByRole("button", { name: "Remove address" })).not.toBeInTheDocument(); // keep at least one
  });

  test("a valid GSTIN fills the state and hides PAN", async () => {
    const { user } = await open();
    expect(field("PAN")).toBeInTheDocument();
    await user.type(field("GSTIN"), HR);
    expect(screen.getByText(/Haryana \(06\)\. State and PAN come from the GSTIN/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^PAN/ })).not.toBeInTheDocument();
  });

  test("server validation errors show next to the fields", async () => {
    const { user } = await open();
    fakeApi({
      "GET /auth/me": ME,
      "PUT /company": Response.json(
        {
          error: {
            code: "VALIDATION",
            message: "Some fields are invalid.",
            details: { fields: { gstin: ["GSTIN check digit doesn't match. Please check for a typo."], "addresses.0.pincode": ["PIN code is 6 digits."] } },
          },
        },
        { status: 400 },
      ),
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("GSTIN check digit doesn't match. Please check for a typo.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Address 1" })).getByText("PIN code is 6 digits.")).toBeInTheDocument();
    expect(field("Legal name")).toHaveValue("Saini Engineering Works"); // form keeps the user's input
  });

  test("logo upload: an image is previewed and sent; an oversized one is refused", async () => {
    const { user, puts } = await open();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File([new Uint8Array(400_000)], "big.png", { type: "image/png" }));
    expect(screen.getByText("That image is over 300 KB. Use a smaller one.")).toBeInTheDocument();

    await user.upload(input, new File([new Uint8Array(100_000).fill(137)], "logo.png", { type: "image/png" }));
    expect(await screen.findByRole("img", { name: "Logo" })).toHaveAttribute("src", expect.stringMatching(/^data:image\/png;base64,/));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(() => Bun.sleep(0));
    expect(puts[0]!.logo).toBe(`data:image/png;base64,${Buffer.alloc(100_000, 137).toString("base64")}`); // exact bytes, past one chunk
  });

  test("non-admins see the details read-only, with no Save", async () => {
    for (const role of ["accountant", "viewer"]) {
      await open(role);
      expect(screen.getByText("Only an admin can change these details.")).toBeInTheDocument();
      expect(field("Legal name")).toHaveAttribute("readonly");
      for (const name of ["Save", "Add address", "Add bank account", "Upload logo"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      expect(calls.filter((c) => c.startsWith("PUT"))).toEqual([]);
      cleanup();
    }
  });
});
