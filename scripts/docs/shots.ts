// Screenshots for the screen docs (docs/screens/): resets nothing itself, so start a fresh e2e
// server first (PORT=3100 bun scripts/e2e-server.ts), then `bun run docs:shots`. Seeds fictional
// data, opens every screen and its key states as the right role, and saves WebP files to
// docs/screens/img/<name>-<desktop|phone>-<light|dark>.webp (print sheets: light desktop only).
import { join } from "node:path";
import { seed } from "./seed.ts";

const BASE = process.env.DOCS_BASE ?? "http://localhost:3100";
const OUT = join(import.meta.dir, "../../docs/screens/img");
const ids = await seed(BASE);
const view = new Bun.WebView({ backend: { type: "chrome", url: false } as never, width: 1280, height: 900 });

const js = (fn: string) => view.evaluate(fn);
const wait = async (cond: string, what = cond) => {
  for (let i = 0; i < 300; i++) {
    if (await js(cond)) return;
    await Bun.sleep(100);
  }
  throw new Error(`timed out waiting for ${what} on ${await js("location.pathname")}`);
};
// Text on the page or in a field (a form's values live in inputs, which innerText leaves out).
const waitText = (t: string) =>
  wait(`[document.body.innerText, ...[...document.querySelectorAll('input,textarea')].map(e => e.value)].some(v => v.includes(${JSON.stringify(t)}))`, JSON.stringify(t));
const settle = async () => {
  await js("document.fonts.ready.then(() => 1)");
  await Bun.sleep(900);
};
const as = async (role: string) => {
  await view.navigate(`${BASE}/`);
  await js(`fetch('/api/test/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: '${role}' }) }).then(r => r.status)`);
};
const center = async (sel: string) =>
  (await js(`(() => { const el = ${sel}; if (!el) return null; el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`)) as [number, number] | null;
const clickButton = async (text: string) => {
  const at = await center(`[...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)})`);
  if (!at) throw new Error(`no button "${text}"`);
  await view.click(...at);
};
/** Pick the first match in an S2 combobox inside `scope` (e.g. a dialog) after typing `text`. */
const pickCombo = async (scope: string, text: string) => {
  await wait(`!!document.querySelector('${scope} input[role=combobox]')`);
  await js(`document.querySelector('${scope} input[role=combobox]').focus()`);
  await view.type(text);
  await wait(`!!document.querySelector('[role=option]')`);
  await Bun.sleep(400);
  await view.press("ArrowDown");
  await view.press("Enter");
};

type Device = "desktop" | "phone";
const DEVICES: Record<Device, { width: number; height: number; scale: number; mobile: boolean }> = {
  desktop: { width: 1280, height: 860, scale: 1, mobile: false },
  phone: { width: 390, height: 844, scale: 2, mobile: true },
};
type Shot = {
  name: string;
  url: string;
  role?: string; // default admin
  ready: string; // text on the page once it has loaded
  act?: () => Promise<void>; // open a dialog, type, press Save…
  devices?: Device[]; // default both
  schemes?: ("light" | "dark")[]; // default both
  full?: boolean; // default true: grow the viewport to the whole page (not for dialogs)
};

const SHOTS: Shot[] = [
  // Shell
  { name: "dashboard", url: "/", ready: "Coming soon" },
  { name: "not-found", url: "/no-such-page", ready: "Page not found", devices: ["desktop"] },
  // Masters
  { name: "parties", url: "/masters/parties", ready: "Haryana Steel Traders" },
  { name: "party-new", url: "/masters/parties/new", ready: "Billing address" },
  { name: "party-errors", url: "/masters/parties/new", ready: "Billing address", devices: ["desktop"], act: async () => { await clickButton("Save"); await Bun.sleep(600); } },
  { name: "party-edit", url: `/masters/parties/${ids.acme}`, ready: "Plant 2" },
  { name: "items", url: "/masters/items", ready: "MS Wire Rod" },
  { name: "item-edit", url: "/masters/items/" + ids.bolt, ready: "Hex Bolt" },
  { name: "ledgers", url: "/masters/ledgers", ready: "Factory Rent" },
  { name: "ledger-dialog", url: "/masters/ledgers", ready: "Factory Rent", full: false, act: async () => { await clickButton("New ledger"); await wait("!!document.querySelector('[role=dialog]')"); } },
  // Settings
  { name: "company", url: "/settings/company", ready: "Northwind Fasteners Pvt Ltd" },
  { name: "numbering", url: "/settings/numbering", ready: "Prefix" },
  // Sales
  { name: "quotations", url: "/sales/quotations", ready: "Delta Auto Components" },
  { name: "quotation-new", url: "/sales/quotations/new", ready: "Add line" },
  { name: "quotation-errors", url: "/sales/quotations/new", ready: "Add line", devices: ["desktop"], act: async () => { await clickButton("Save"); await Bun.sleep(600); } },
  { name: "quotation-draft", url: `/sales/quotations/${ids.q1}`, ready: "Zinc plated" },
  { name: "quotation-sent", url: `/sales/quotations/${ids.q2}`, ready: "can't be edited" },
  { name: "orders", url: "/sales/orders", ready: "Delta Auto Components" },
  { name: "order-from-quotations", url: "/sales/orders", ready: "Delta Auto Components", devices: ["desktop"], full: false,
    act: async () => { await clickButton("From quotations"); await pickCombo("[role=dialog]", "Delta"); await wait("!!document.querySelector('[role=dialog] input[type=checkbox]')"); } },
  { name: "order-confirmed", url: `/sales/orders/${ids.so2}`, ready: "Delivered so far" },
  { name: "challans", url: "/sales/challans", ready: "Delta Auto Components" },
  { name: "challan-issued", url: `/sales/challans/${ids.ch2}`, ready: "Faridabad Roadways" },
  { name: "invoices", url: "/sales/invoices", ready: "Delta Auto Components" },
  { name: "invoice-draft", url: `/sales/invoices/${ids.inv2}`, ready: "IGST" },
  { name: "invoice-finalize-confirm", url: `/sales/invoices/${ids.inv2}`, ready: "IGST", devices: ["desktop"], full: false,
    act: async () => { await clickButton("Finalize invoice"); await wait("!!document.querySelector('[role=alertdialog]')"); } },
  { name: "invoice-finalized", url: `/sales/invoices/${ids.inv1}`, ready: "can't be edited" },
  { name: "invoice-cancel-dialog", url: `/sales/invoices/${ids.inv1}`, ready: "can't be edited", devices: ["desktop"], full: false,
    act: async () => { await clickButton("Cancel invoice"); await wait("!!document.querySelector('[role=dialog]')"); } },
  { name: "invoice-cancelled", url: `/sales/invoices/${ids.inv3}`, ready: "Raised twice by mistake", devices: ["desktop"] },
  { name: "invoice-viewer", url: `/sales/invoices/${ids.inv1}`, role: "viewer", ready: "You can view", devices: ["desktop"], schemes: ["light"] },
  { name: "credit-notes", url: "/sales/credit-notes", ready: "Rate difference", devices: ["desktop"] },
  { name: "credit-note-return", url: `/sales/credit-notes/${ids.cn1}`, ready: "Thread damage" },
  { name: "credit-note-rate", url: `/sales/credit-notes/${ids.cn2}`, ready: "Agreed rate", devices: ["desktop"] },
  // Purchase
  { name: "purchase-orders", url: "/purchase/orders", ready: "Okhla Wire Mills" },
  { name: "purchase-order-sent", url: `/purchase/orders/${ids.po1}`, ready: "Received so far" },
  { name: "grns", url: "/purchase/grns", role: "operator", ready: "Haryana Steel Traders" },
  { name: "grn-receive-dialog", url: "/purchase/grns", role: "operator", ready: "Haryana Steel Traders", devices: ["desktop"], full: false,
    act: async () => { await clickButton("Receive against PO"); await pickCombo("[role=dialog]", "Haryana"); await wait("!!document.querySelector('[role=dialog] input[type=checkbox]')"); } },
  { name: "grn-new", url: `/purchase/grns/new?from=${ids.po1}`, role: "operator", ready: "Rejected" },
  { name: "grn-received", url: `/purchase/grns/${ids.g1}`, role: "operator", ready: "surface rust" },
  // Print sheets (A4, black on white)
  ...([
    ["print-quotation", `/print/quotations/${ids.q1}`],
    ["print-challan", `/print/challans/${ids.ch2}`],
    ["print-invoice", `/print/invoices/${ids.inv1}`],
    ["print-credit-note", `/print/credit-notes/${ids.cn1}`],
    ["print-purchase-order", `/print/purchase-orders/${ids.po1}`],
  ] as const).map(([name, url]): Shot => ({ name, url, ready: "Northwind Fasteners", devices: ["desktop"], schemes: ["light"] })),
];

// Signed out first: the sign-in page.
const shoot = async (file: string, full: boolean, d: (typeof DEVICES)[Device]) => {
  if (full) {
    // The app scrolls inside its content pane, so grow the window to fit whatever scrolls most.
    const h = (await js("Math.max(...[...document.querySelectorAll('*')].map(e => e.scrollHeight - e.clientHeight + innerHeight))")) as number;
    await view.cdp("Emulation.setDeviceMetricsOverride", { width: d.width, height: Math.min(Math.max(d.height, Math.ceil(h)), 6000), deviceScaleFactor: d.scale, mobile: d.mobile });
    await settle();
  }
  const { data } = (await view.cdp("Page.captureScreenshot", { format: "webp", quality: 82 })) as { data: string };
  await Bun.write(join(OUT, file), Buffer.from(data, "base64"));
};

await view.navigate(`${BASE}/`); // CDP calls need a page
let role = "";
let count = 0;
const signIn: Shot = { name: "sign-in", url: "/", ready: "Sign in" };
for (const shot of [signIn, ...SHOTS]) {
  for (const scheme of shot.schemes ?? ["light", "dark"]) {
    for (const device of shot.devices ?? ["desktop", "phone"]) {
      const d = DEVICES[device];
      const want = shot === signIn ? "" : (shot.role ?? "admin");
      if (want !== role) {
        if (want) await as(want);
        role = want;
      }
      await view.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await view.cdp("Emulation.setDeviceMetricsOverride", { width: d.width, height: d.height, deviceScaleFactor: d.scale, mobile: d.mobile });
      await view.navigate(`${BASE}${shot.url}`);
      await waitText(shot.ready);
      await settle();
      if (shot.act) {
        await shot.act();
        await settle();
      }
      await shoot(`${shot.name}-${device}-${scheme}.webp`, shot.full ?? true, d);
      count++;
    }
  }
}
view.close();
console.log(`${count} screenshots in ${OUT}`);
