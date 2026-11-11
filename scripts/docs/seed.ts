// Fictional data for the screen docs (scripts/docs/shots.ts): a fasteners maker in Faridabad with a
// few customers, suppliers, items and ledgers, and documents in every state. Run against a freshly
// reset e2e server (PORT=3100 bun scripts/e2e-server.ts); every name, GSTIN and number is made up.
import { gstinCheckChar } from "../../src/shared/gstin.ts";

export async function seed(base: string) {
  const login = await fetch(`${base}/api/test/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "admin" }) });
  if (!login.ok) throw new Error(`login: ${login.status} (is the e2e server running?)`);
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(`${method} ${path}: ${JSON.stringify(j)}`);
    return j;
  };
  const gstin = (first14: string) => first14 + gstinCheckChar(first14);
  if ((await api("GET", "/parties?q=Northwind")).total || (await api("GET", "/ledgers?q=Factory%20Rent")).total)
    throw new Error("Already seeded: restart the e2e server (it resets its database) and run this again.");
  const status = (path: string, id: number, s: string) => api("POST", `${path}/${id}/status`, { status: s });

  // Company profile: on the header and every print.
  await api("PUT", "/company", {
    legal_name: "Northwind Fasteners Pvt Ltd", trade_name: "Northwind Fasteners", gstin: gstin("06AAECN4321K1Z"), phone: "0129 400 1234", email: "accounts@northwind.example",
    terms: "Goods once sold are not taken back. Interest at 18% p.a. after the due date. Subject to Faridabad jurisdiction.",
    addresses: [{ label: "Works", address: "Plot 12, Sector 24", city: "Faridabad", pincode: "121005", is_primary: true }],
    bank_accounts: [{ bank_name: "HDFC Bank", account_name: "Northwind Fasteners Pvt Ltd", account_number: "50200012345678", ifsc: "HDFC0001234", branch: "Sector 16, Faridabad", is_default: true }],
  });

  // Ledgers.
  type G = { id: number; name: string; children: G[] };
  const flat = (g: G): G[] => [g, ...g.children.flatMap(flat)];
  const groups = Object.fromEntries((await api("GET", "/ledger-groups")).groups.flatMap(flat).map((g: G) => [g.name, g.id]));
  for (const [name, group] of [["HDFC Current A/c 5010", "Bank Accounts"], ["SBI Cash Credit A/c", "Bank Accounts"], ["Factory Rent", "Indirect Expenses"], ["Electricity – Plant", "Indirect Expenses"], ["Freight Inward", "Direct Expenses"]]) {
    await api("POST", "/ledgers", { name, group_id: groups[group!] });
  }
  const old = await api("POST", "/ledgers", { name: "Old Axis A/c", group_id: groups["Bank Accounts"] });
  await api("POST", `/ledgers/${old.id}/deactivate`);

  // Parties.
  const party = (name: string, kind: string, gst14: string, address: string, city: string, state: string, pin: string, extra = {}) =>
    api("POST", "/parties", { name, kind, registration_type: "regular", gstin: gstin(gst14), addresses: [{ kind: "billing", address, city, pincode: pin, state_code: state }], ...extra });
  const acme = await party("Acme Castings Pvt Ltd", "customer", "06AAACA1234B1Z", "Plot 4, Sector 24", "Faridabad", "06", "121004", { contact_person: "R. Mehta", phone: "98110 00001", credit_days: 30 });
  await party("Acme Engineering Works", "customer", "06AAACE5678C1Z", "Udyog Vihar Phase 4", "Gurugram", "06", "122015");
  const delta = await party("Delta Auto Components", "both", "07AAACD9012D1Z", "B-12, Okhla Phase 2", "New Delhi", "07", "110020");
  const steel = await party("Haryana Steel Traders", "supplier", "06AABCH1234A1Z", "Plot 77, Sector 25", "Faridabad", "06", "121004");
  const okhla = await party("Okhla Wire Mills", "supplier", "07AABCO9999A1Z", "C-41, Okhla Phase 1", "New Delhi", "07", "110020");
  await api("POST", "/parties", { name: "Ramesh Hardware Store", kind: "customer", registration_type: "unregistered", state_code: "06", phone: "98990 00002" });
  // Acme's second plant, for Ship to.
  const a = await api("GET", `/parties/${acme.id}`);
  await api("PUT", `/parties/${acme.id}`, { ...a, addresses: [...a.addresses.map(({ id: _, ...rest }: Record<string, unknown>) => rest), { kind: "shipping", label: "Plant 2", address: "Plot 88, IMT", city: "Faridabad", pincode: "121003", state_code: "06" }] });

  // Items.
  const units = await api("GET", "/units");
  const rates = await api("GET", "/gst-rates");
  const unit = (code: string) => (units.units ?? units).find((u: { code: string }) => u.code === code).id;
  const r18 = (rates.rates ?? rates).find((r: { rate: number | string }) => Number(r.rate) === 18).id;
  const item = (code: string, name: string, type: string, hsn: string, u: string, sale: number, purchase = 0) =>
    api("POST", "/items", { code, name, type, hsn, unit_id: unit(u), gst_rate_id: r18, sale_price: sale, purchase_price: purchase });
  const bolt = (await item("FG-101", "Hex Bolt M10 x 50", "finished", "73181500", "NOS", 12_50)).id;
  const flange = (await item("FG-220", "Flange Plate 6 inch", "finished", "73079990", "NOS", 845_00)).id;
  const rod = (await item("RM-12", "MS Bright Rod 12mm", "raw", "72155090", "KGS", 0, 72_50)).id;
  await item("RM-14", "MS Wire Rod 5.5mm", "raw", "72139190", "KGS", 0, 68_00);

  // Quotations: a draft, a sent one, an accepted one.
  const terms = "Prices ex-works Faridabad. Freight extra. 50% advance, balance before dispatch.";
  const quote = (party_id: number, lines: unknown[], extra = {}) => api("POST", "/quotations", { party_id, date: "2026-11-10", due_date: "2026-11-24", terms, lines, ...extra });
  const q1 = await quote(acme.id, [{ item_id: bolt, description: "Zinc plated", qty: 5000, rate: 12_50, gst_rate: 18 }, { item_id: flange, qty: 40, rate: 845_00, discount_bp: 500, gst_rate: 18 }]);
  const q2 = await quote(delta.id, [{ item_id: bolt, qty: 20000, rate: 12_25, gst_rate: 18 }]);
  await status("/quotations", q2.id, "sent");
  const q3 = await quote(acme.id, [{ item_id: flange, qty: 100, rate: 830_00, gst_rate: 18 }], { date: "2026-11-03" });
  await status("/quotations", q3.id, "sent");
  await status("/quotations", q3.id, "accepted");

  // Sales orders: Delta's from its quotation (confirmed); Acme's fresh one (confirmed, part delivered); a draft.
  const fromQ = await api("GET", `/sales-orders/new?from=${q2.id}`);
  const so1 = await api("POST", "/sales-orders", { ...fromQ, party_ref: "DAC/PO/2291", party_ref_date: "2026-11-09", due_date: "2026-11-30", lines: [{ ...fromQ.lines[0], qty: 15000 }] });
  await status("/sales-orders", so1.id, "finalized");
  const so2 = await api("POST", "/sales-orders", { date: "2026-11-10", party_id: acme.id, party_ref: "ACME/PO/4471", party_ref_date: "2026-11-08", due_date: "2026-11-20",
    lines: [{ item_id: bolt, qty: 8000, rate: 12_50, gst_rate: 18 }, { item_id: flange, qty: 60, rate: 845_00, gst_rate: 18 }] });
  await status("/sales-orders", so2.id, "finalized");
  await api("POST", "/sales-orders", { date: "2026-11-11", party_id: acme.id, lines: [{ item_id: bolt, qty: 2000, rate: 12_50, gst_rate: 18 }] });

  // Challans: Acme's part delivery and Delta's by road to Delhi (issued); a job-work draft.
  const dcA = await api("GET", `/challans/new?from=${so2.id}`);
  const ch1 = await api("POST", "/challans", { ...dcA, vehicle_no: "HR 38 C 7788", lines: [{ ...dcA.lines[0], qty: 5000 }, dcA.lines[1]] });
  await status("/challans", ch1.id, "finalized");
  const dcD = await api("GET", `/challans/new?from=${so1.id}`);
  const ch2 = await api("POST", "/challans", { ...dcD, vehicle_no: "HR 51 AB 1234", transporter: "Faridabad Roadways", eway_bill_no: "331000123456", lines: [{ ...dcD.lines[0], qty: 10000 }] });
  await status("/challans", ch2.id, "finalized");
  await api("POST", "/challans", { challan_type: "job_work", date: "2026-11-11", party_id: acme.id, vehicle_no: "HR 38 C 7788", notes: "For zinc plating; return within 15 days.", lines: [{ item_id: bolt, qty: 3000, rate: 12_50, gst_rate: 18 }] });

  // Invoices: Acme's (finalized), Delta's IGST draft, one cancelled.
  const inv1 = await api("POST", "/invoices", { ...(await api("GET", `/invoices/new?from=${ch1.id}`)), due_date: "2026-12-11" });
  await status("/invoices", inv1.id, "finalized");
  const inv2 = await api("POST", "/invoices", { ...(await api("GET", `/invoices/new?from=${ch2.id}`)), vehicle_no: "HR 51 AB 1234", eway_bill_no: "331000123456" });
  const inv3 = await api("POST", "/invoices", { date: "2026-11-11", party_id: acme.id, lines: [{ item_id: flange, qty: 10, rate: 845_00, gst_rate: 18 }] });
  await status("/invoices", inv3.id, "finalized");
  await api("POST", `/invoices/${inv3.id}/cancel`, { reason: "Raised twice by mistake" });

  // Credit notes against Acme's invoice: 300 bolts returned (finalized); a rate difference (draft).
  const cn = await api("GET", `/credit-notes/new?from=${inv1.id}`);
  const cn1 = await api("POST", "/credit-notes", { ...cn, lines: [{ ...cn.lines[0], qty: 300 }], notes: "Thread damage on 300 pcs; returned by Acme stores." });
  await status("/credit-notes", cn1.id, "finalized");
  const cn2 = await api("POST", "/credit-notes", { ...cn, note_reason: "rate_difference", lines: [{ ...cn.lines[1], rate: 25_00 }], notes: "Agreed rate ₹820 per plate, not ₹845." });

  // Purchase orders: two sent, one draft.
  const poTerms = "Delivery at our works, Plot 12, Sector 24, Faridabad. Mill test certificate with each lot. Payment 30 days from receipt.";
  const po = (party_id: number, lines: unknown[], extra = {}) => api("POST", "/purchase-orders", { party_id, date: "2026-11-11", due_date: "2026-11-25", terms: poTerms, lines, ...extra });
  const po1 = await po(steel.id, [{ item_id: rod, qty: 2_000_000, rate: 72_50, gst_rate: 18, description: "Bright bar, h9 tolerance" }], { party_ref: "HST/Q/118", party_ref_date: "2026-11-05" });
  await status("/purchase-orders", po1.id, "finalized");
  const po2 = await po(okhla.id, [{ item_id: rod, qty: 500_000, rate: 71_00, gst_rate: 18 }], { due_date: "2026-12-02" });
  await status("/purchase-orders", po2.id, "finalized");
  await po(steel.id, [{ item_id: rod, qty: 750_000, rate: 72_50, gst_rate: 18 }], { due_date: "2026-12-10" });

  // GRNs: 1500 kg in against PO 1, 120 kg rejected (received); Okhla's lot (draft).
  const g1d = await api("GET", `/grns/new?from=${po1.id}`);
  const g1 = await api("POST", "/grns", { ...g1d, party_ref: "HST/DC/2231", party_ref_date: "2026-11-18", vehicle_no: "HR 38 X 4410", lines: [{ ...g1d.lines[0], qty: 1_380_000, rejected_qty: 120_000 }], notes: "120 kg rejected: surface rust; returned on the same truck." });
  await status("/grns", g1.id, "finalized");
  const g2 = await api("POST", "/grns", { ...(await api("GET", `/grns/new?from=${po2.id}`)), party_ref: "OWM/DC/77" });

  return { acme: acme.id, delta: delta.id, steel: steel.id, bolt, q1: q1.id, q2: q2.id, q3: q3.id, so1: so1.id, so2: so2.id, ch1: ch1.id, ch2: ch2.id,
    inv1: inv1.id, inv2: inv2.id, inv3: inv3.id, cn1: cn1.id, cn2: cn2.id, po1: po1.id, po2: po2.id, g1: g1.id, g2: g2.id };
}
