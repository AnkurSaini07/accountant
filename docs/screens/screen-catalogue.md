# Screen catalogue (design brief)

This lists **every screen Accountant needs**, both the ones built so far and the ones still to come. It is the
brief for designing them: one mockup set per screen, in the **Enterprise app style guide**. Development resumes
from these designs.

- **Built** screens exist today; the [Screens](./index.md) pages show them in screenshots. Redesign them freely,
  but keep their data and behaviour.
- **Planned** screens don't exist yet. Their content comes from the requirements (`docs/REQUIREMENTS.md`) and
  the open GitHub issues, given as `#61`.
- Screen IDs (e.g. `SAL-INV-2`) are stable. Name your files after them (`SAL-INV-2-desktop-dark.png`) so we can
  match designs to code.

## 1. How to use this brief

### The product in one paragraph

Accountant replaces **Tally** for a small fasteners factory in Faridabad, Haryana (India). It runs the sales chain
(quotation → sales order → delivery challan → tax invoice → credit note), the purchase chain (purchase order →
goods receipt → purchase bill → debit note), GST-compliant double-entry accounts, stock, GST reports for the CA
and a basic monthly payroll. The data, statuses and GST fields come from Indian GST law. Labels, grouping and
order can change; the data can't.

### Users and roles

| Role | Who | Sees |
|---|---|---|
| **Admin** | The owner | Everything, including company settings, cancelling finalized documents and payroll |
| **Accountant** | Office / CA staff | All documents, vouchers, reports and payroll; settings read-only |
| **Operator** | Dispatch and stores staff | Challans and GRNs (create), stock (view); no accounts, reports or payroll |
| **Viewer** | Auditor, CA | Documents and reports, read-only; no payroll |

Every screen below says who uses it. Design the **read-only variant** for anyone who can view but not edit: no
edit controls, plus a one-line note saying why ("You can view invoices; ask an accountant or admin to change
them."). Operators and viewers never see payroll, not even in the navigation.

### Context that shapes the design

- **Tally-trained office staff** judge a screen by how fast they can key in a 20-line invoice: dense layouts,
  keyboard first, little mouse. **Enter moves to the next cell** in line-item grids, as in Tally. This must stay.
- **Desktops** are 1280–1920 px wide, sometimes old monitors. Design desktop at **1280 px** first.
- **Phones** (390 px) are for the owner looking things up and approving, and for stores staff doing light
  entry (challans, GRNs). Wide tables become cards on a phone; line items may scroll sideways inside their box.
- **Light and dark** schemes, following the OS. Design both.
- **Indian formats**: money `₹1,23,456.00` (lakh/crore grouping), amounts in words in lakh/crore, dates
  `dd/mm/yyyy` in fields and `11 Nov 2026` in lists. The financial year (FY) runs 1 April to 31 March, labelled
  `2026-27`.
- **GST vocabulary** users know well: GSTIN, PAN, HSN/SAC, CGST/SGST/IGST, place of supply, e-way bill,
  reverse charge, IRN, ITC.
- **Accessibility must stay**: every control has a visible or programmatic label, works by keyboard and has
  visible focus. Colour is never the only signal; status badges carry text.

### States every screen needs

Unless a screen says otherwise, design these:

| State | What it looks like |
|---|---|
| Default | Realistic data (see §13 for sample data) |
| Loading | First load of the page, or of a table inside it |
| Empty | No records yet, and "no matches" when filters are on (different words; the second suggests changing the filters) |
| Validation errors | Each problem on its field, focus on the first; server errors (e.g. duplicate GSTIN) on the field too |
| Read-only | For roles that can't edit, and for documents past Draft |
| Phone | 390 px |
| Dark | Both schemes |

Failures that aren't tied to a field (network, server) appear as a **toast**, red with a dismiss button;
successes ("Saved") as a short green toast.

### What we want back

1. **Shared patterns first** (§2), since every module reuses them.
2. Then each screen in §3–§11: desktop light and dark, phone light; plus the states listed for it.
3. Print sheets (§12) are A4, black on white, light only.

---

## 2. Shared patterns (design these first)

### P-1 App frame

- **Side navigation**, 240 px, collapsible to icons:
  - Sections: Dashboard, Sales, Purchase, Accounts, Inventory, Reports, Payroll, Masters, Settings. Each has
    an icon.
  - A section with pages expands to show them. The current page is highlighted, and its section opens
    automatically.
  - On a phone the nav is a drawer opened from a menu button.
- **Top bar**, slim (about 48–56 px):
  - The app mark and the company's trade name.
  - The **Financial year** picker. Every list, number series, report and the dashboard follows it.
  - The user's avatar (initials), opening a menu with name, role, email and **Sign out**.
- The full navigation tree, once everything below exists:

| Section | Pages |
|---|---|
| Dashboard | (one page) |
| Sales | Quotations · Orders · Challans · Invoices · Credit notes |
| Purchase | Orders · GRNs · Bills · Debit notes |
| Accounts | Receipts · Payments · Journals · Contra · Opening balances |
| Inventory | Stock summary · Stock adjustments · Low stock · Job work |
| Reports | Ledger statement · Day book · Outstanding · Trial balance · Profit & loss · Balance sheet · Sales register · Purchase register · GSTR-1 · GSTR-3B · E-way bills |
| Payroll | Runs · Employees · Advances |
| Masters | Parties · Items · Ledgers |
| Settings | Company · Numbering · GST & e-invoicing · GST rates · Payroll rates · Import from Tally · Audit log |

### P-2 List (register)

Used by every document type and every master.

- **Title row**: title on the left. On the right, one primary action ("New invoice") and any secondary ones
  ("From quotations", "Receive against PO"). Users who can't create don't see them.
- **Filter row**: search (number or party name), status, and a From–To date range on document lists. Some
  lists add a type or kind filter. On a phone only search shows; the rest sit behind a **Filters** button with
  a count. Filters live in the URL.
- **Compact table**: Number · Date · Party · type-specific columns · Status badge · Total (right-aligned).
  - The whole row opens the record, newest first.
  - Drafts show "Draft" in place of a number.
  - On a phone, rows become two-line cards: number and amount, then party, date and status.
- **Pager**: "1–50 of 312", Previous / Next. 50 rows per page.
- **States**: loading, empty ("No invoices in this financial year yet."), no matches ("No invoices match. Try
  another search, status or dates.").

### P-3 Document form

One layout for every trading document: quotation, sales order, challan, invoice, credit note, purchase order,
GRN, purchase bill and debit note. From top to bottom:

1. **Sticky header**:
   - A back arrow to the list.
   - A small type label above the number ("Invoice", "INV/26-27/0001").
   - The status badge.
   - Actions on the right: one primary button (the next status move, else Save), then Print and the
     conversions ("Create invoice") as secondary buttons. Cancelling lives in a **⋯ More actions** menu.
2. **A notice line** when relevant:
   - "Made from 2 pending lines of SO/26-27/0004."
   - "This invoice is finalized, so it can't be edited."
   - A cancellation note: "Cancelled on 11 Nov 2026: Raised twice by mistake. Its number stays used."
   - The viewer note.
3. **Header fields** on a dense grid, up to six across at 1280 px and one column on a phone:
   - The party picker and Ship to take two columns each.
   - Then the date, a due date (labelled per type: Valid until, Delivery by, Payment due), the party's own
     reference and date (Customer PO, Supplier challan, Supplier invoice), and the type-specific fields.
4. **Line items** (P-4).
5. **Totals**, right-aligned under the lines: Taxable value, CGST + SGST *or* IGST, Round off, **Total**
   (bold). Place of supply decides the tax: same state as the company (Haryana, 06) means CGST + SGST; another
   state means IGST. It is shown live while editing.
6. **Terms** (printed) and **Notes** (internal) side by side.
7. **Progress** on confirmed orders and sent POs: ordered / delivered (or received) / pending per item.

**Read-only documents** (past Draft, or for viewers) render as a **document, not a disabled form**:
- A party panel (name, GSTIN, city, address) beside the facts (date, due, references, ship to, transport).
- The lines as text, then totals, terms and notes.

### P-4 Line items grid

The densest part of the app, where users spend most of their time. The columns:

`#` · Item (searchable: code – name) · Description · HSN/SAC · Qty · Unit · Rate (₹) · Disc % · GST % · Amount (₹) · remove

- Picking an item fills HSN, unit, rate and GST rate. Qty, rate and discount update the amount and totals live.
- **Enter** moves to the next cell; Enter or Tab in the last cell adds a line; there is also an "Add line" button.
- Quantity decimals follow the unit (NOS: 0, KGS: 3).
- Variants:
  - **GRN**: Qty becomes **Accepted**, and a **Rejected** column is added.
  - **Credit note**: each line shows the invoiced qty and the qty left to credit.
- Errors show on the cell: "Pick an item", "Enter a quantity", "More than the 200 left on the invoice".
- Read-only: plain text rows.

### P-5 Pickers

- **Party picker**: type part of a name, GSTIN or phone. Each match shows the name, GSTIN and city.
  - It is limited to customers on sales documents and suppliers on purchase documents.
  - Its states: loading, no match, and inactive parties hidden.
- **Item picker**: code – name, with unit and HSN as secondary text.
- **Ship to**: "Same as billing address" or one of the party's shipping addresses.
- **Ledger picker** (vouchers): searchable, grouped by ledger group.
- **Select**: a native-feel drop-down for short fixed lists (status, type, unit, GST rate, copy).

### P-6 Status badges

One colour per *meaning*, the same on every document type:

| Meaning | Badges |
|---|---|
| Not yet issued | Draft |
| Issued, waiting on something | Sent, Issued, Confirmed |
| Done | Accepted, Finalized, Received, Paid, Posted |
| Ended badly | Rejected, Cancelled |
| Lapsed | Expired, Overdue |
| Needs attention | IRN pending, Below minimum wage |

Per type:
- Quotation: Draft → Sent → Accepted / Rejected / Expired
- Sales order: Draft → Confirmed → Cancelled
- Challan: Draft → Issued → Cancelled
- Invoice: Draft → Finalized → Cancelled, plus the e-invoice states in SAL-INV-6
- Credit note: Draft → Finalized → Cancelled
- Purchase order: Draft → Sent → Cancelled
- GRN: Draft → Received → Cancelled
- Purchase bill and debit note: Draft → Posted → Cancelled
- Vouchers: Draft → Posted → Cancelled
- Payroll run: Draft → Calculated → Finalized

Progress badges are separate from status: Not delivered / Partly delivered / Delivered (and the same with
"received", or "paid" for bills).

### P-7 Dialogs

- **Confirm**: for moves that can't be undone. "Mark invoice INV/26-27/0009 as finalized? It can't be
  edited afterwards." It has a safe button ("Keep it") and the action button.
- **Cancel with a reason**: an admin cancelling a finalized document. A required reason field; the action
  button stays disabled until there's a reason.
- **Make one from several**:
  1. Pick the party.
  2. Their open documents appear as checkboxes, each showing number · date · amount.
  3. Tick some, then **Create order** / **Receive goods** / **Create invoice**.
- **Small record editor**: the ledger editor (name and group); the same shape for small masters.

### P-8 Report page

A shared layout for every report in §9 (and the inventory reports in §8):

- **Title row** with **Export CSV** and **Print** (secondary buttons).
- **Filter row**: date range (defaults to the FY), party or ledger where relevant, and options such as
  "Show zero balances".
- **A dense table**:
  - Numbers right-aligned, group subtotals and a bold grand total.
  - Debit / Credit columns where it's an accounts report.
  - Clickable rows that drill down: a balance opens the ledger statement; an entry opens its document.
- **States**: loading, no data in the range, and a print version on A4.

### P-9 Editable grid

For the payroll run inputs and Tally import previews. Like a spreadsheet:

- Keyboard navigation between cells, and **paste from Excel** into a block of cells.
- Errors marked per cell, with a summary above the grid.
- Frozen first columns (code, name) while the rest scrolls sideways.
- A sticky totals row.

### P-10 Wizard

For **Import from Tally**: numbered steps (Upload → Review → Fix exceptions → Import), with Back and Next and the
current step's summary.

### P-11 Feedback

- Toasts (success and error), inline field errors, and a page-level error panel for a record that couldn't
  load ("This invoice couldn't be loaded. Go back to the list and try again.").
- A **Not found** page, and a **Coming soon** blank state for sections not built yet.

---

## 3. Access and home

### SHELL-1 Sign in — Built
- **Route**: `/sign-in`. Outside the app frame.
- **Who**: anyone signed out.
- **Purpose**: sign in through Pocket ID, the company's passkey login. There's no password form in this app.
- **Content**: product mark and name, one line of explanation ("Use your Pocket ID account (passkey) to
  continue."), one button **Sign in with Pocket ID**.
- **States**: default; an error after a failed or cancelled sign-in ("Sign-in didn't finish. Try again.").

### SHELL-2 No access — Built
- **Route**: `/no-access`. Same shape as sign-in.
- **Who**: someone Pocket ID knows but who has no role in this app.
- **Content**: "You're signed in as Asha Verma, but you don't have access to Accountant yet. Ask the owner to add
  you." Then a **Sign out** button.

### SHELL-3 Dashboard — Built (receivables, payables and low stock planned with M4/M5)
- **Route**: `/`.
- **Who**: everyone; the content varies by role.
- **Purpose**: what happened this FY and what needs attention.
- **Content**:
  - A greeting with the company, FY and date. Quick actions by role:
    - Accountant and admin: New invoice, New quotation.
    - Operator: New challan, Receive goods.
    - Viewer: none.
  - **Four KPI tiles**: Net sales (FY), This month so far (with the change on last month), Output GST,
    Invoices finalized (with drafts waiting).
  - **Net sales by month**: a bar chart from April to March, with hover/focus values.
  - **Needs attention**: draft invoices, quotations awaiting reply, orders still to deliver, POs still to
    receive. Each has a count and links to its filtered list.
  - **Recent documents** (any type) and **Top customers** (bar meters by net sales).
  - *Planned*: Receivables due and Payables due (with overdue amounts), Low stock (count and top items), and
    IRNs pending (when e-invoicing is on).
- **States**: an empty FY (a new company), loading, and the operator's dashboard (no money figures; shows challans
  to issue, POs to receive and low stock instead).

### SHELL-4 Not found — Built
- A blank state with an h1 "Page not found" and a link to the dashboard.

### SHELL-5 Coming soon — Built (temporary)
- A blank state for sections not yet built. It goes away as the sections below ship.

---

## 4. Masters

### MAS-PTY-1 Parties list — Built
- **Route**: `/masters/parties`.
- **Who**: admin and accountant edit; others view.
- **Columns**: Name (+ Inactive badge) · GSTIN (or "Unregistered" / "Consumer") · City · Phone · Balance
  (`1,23,456.78 Cr` / `Dr`).
- **Filters**: search (name, GSTIN, phone); kind (All / Customers / Suppliers) as a segmented control; **Show
  inactive** checkbox.
- **Actions**: New party.

### MAS-PTY-2 Party form (new / edit / read-only) — Built
- **Route**: `/masters/parties/new`, `/masters/parties/:id`.
- **Sections**:
  - **Party**: name\*; kind (Customer / Supplier / Both); GST registration (Regular / Composition / Unregistered /
    Consumer / Overseas / SEZ); GSTIN.
    - A valid GSTIN fills in state and PAN, with a line saying so: "Haryana. State and PAN come from the GSTIN."
    - State and PAN are typed by hand when there's no GSTIN.
  - **Contact**: contact person, phone, email.
  - **Credit**: credit days, credit limit (₹; blank means no limit), opening balance (₹) with **Dr: they owe
    us / Cr: we owe them**.
  - **Billing address**: address, city, state, PIN.
  - **Shipping addresses**: any number, each with a label (e.g. "Plant 2"), address, city, state, PIN and a
    remove button. An "Add shipping address" button adds one. A shipping address's state decides the place of
    supply.
- **Actions**: Save (primary); **Deactivate** / **Reactivate** (secondary).
- **States**: new (autofocus on Name), errors (missing name, bad GSTIN checksum, duplicate GSTIN, bad PIN on
  shipping address 2), edit, inactive, read-only, and "This party couldn't be loaded".

### MAS-ITM-1 Items list — Built
- **Route**: `/masters/items`.
- **Columns**: Code · Name (+ Inactive) · Type · HSN/SAC · Unit · GST % · Sale price.
- **Filters**: search (code, name, HSN); type (Raw material / Semi-finished / Finished good / Service); Show
  inactive.
- **Actions**: New item.

### MAS-ITM-2 Item form — Built
- **Route**: `/masters/items/new`, `/masters/items/:id`.
- **Fields**:
  - Code\* (e.g. FG-101), name\*, description (printed under the name), type\*.
  - **HSN** or **SAC** for a service (4, 6 or 8 digits).
  - Unit\* (NOS, PCS, KGS, MTR, SET…), GST rate\* (only rates in effect today).
  - **Prices**: sale price and purchase price, per unit.
  - **Stock** (hidden for services): opening quantity (in the unit, e.g. 1.250 KGS), opening value (₹),
    reorder level.
- **Actions**: Save; Deactivate / Reactivate.
- **States**: new, a service (no stock section, "SAC" label), errors (too many decimals for the unit, duplicate
  code), read-only.

### MAS-LED-1 Ledgers list — Built
- **Route**: `/masters/ledgers`.
- **Columns**: Group · Name · badges **System** (Cash, Sales, Output CGST… can't be renamed) and **Party**
  (follows its party, edited there).
- **Filters**: search; group; Show inactive.
- **Actions**: New ledger. A row opens the ledger dialog.

### MAS-LED-2 Ledger dialog — Built
- **Fields**: name\*, group\*. The group is a picker showing the chart of accounts as a tree, with a section per
  primary group (Capital Account, Current Assets → Bank Accounts, Cash-in-Hand…).
- **Actions**: Save; Deactivate.
- **Variants**: new; edit; **system ledger** (locked, with a note); **party ledger** (locked, with a link to the
  party); read-only; a server error on the name ("A ledger named Cash already exists.").

---

## 5. Sales

All of these use P-2 (list), P-3 (document form) and P-4 (line items). Each document can be created fresh or
**from the previous step**, which takes only what is still pending.

### SAL-QTN-1 Quotations list — Built
- **Route**: `/sales/quotations`. **Who**: admin and accountant create; others view.
- **Columns**: Number · Date · Party · **Valid until** · Status · Total.
- **Actions**: New quotation.

### SAL-QTN-2 Quotation form — Built
- **Header fields**: customer\*, date\*, **Valid until**, Ship to.
- **Terms** are prefilled from the company's default terms.
- **States**:
  - **New** and **errors** (no customer; a line with no item or qty).
  - **Draft**: Save, **Mark as sent** (primary), Print.
  - **Sent**: read-only, with **Accepted** (primary), **Rejected** (asks first) and **Expired**, plus
    **Create sales order** and Print.
  - **Accepted, Rejected, Expired**.
  - **Viewer**.

### SAL-SO-1 Sales orders list — Built
- **Route**: `/sales/orders`.
- **Columns**: Number · Date · Party · **Customer PO** · **Delivery** (Not / Partly / Delivered) · Status ·
  Total.
- **Actions**: New order; **From quotations** (P-7, make one from several).

### SAL-SO-2 Sales order form — Built
- **Header fields**: customer\*, date\*, **Delivery by**, **Customer PO no.** and date, Ship to.
- **States**:
  - **New from a quotation**, with the "Made from" note.
  - **Draft**: Save, **Confirm order**.
  - **Confirmed**: read-only, with **Delivered so far** progress (ordered / delivered / pending per item),
    **Create challan**, **Create invoice** and Print. Cancel order is in ⋯ and asks first.
  - **Cancelled**.

### SAL-DC-1 Delivery challans list — Built
- **Route**: `/sales/challans`. **Who**: operators can create challans too.
- **Columns**: Number · Date · Party · **Type** · **Vehicle** · Status · Total.
- **Actions**: New challan.

### SAL-DC-2 Delivery challan form — Built (return tracking planned)
- **Header fields**: customer\*, date\*, **challan type\*** (Sale / Job work / Supply on approval / Returnable),
  Ship to, **vehicle no.**, **transporter**, **e-way bill no.**
- **States**:
  - **New from a confirmed order**.
  - **Draft**: Save, **Issue challan**.
  - **Issued**: read-only, with Create invoice (Sale type), Print, and Cancel challan in ⋯.
  - **Cancelled**.
  - **A fresh challan missing its type** (an error).
  - **Changing the customer resets Ship to**.
- *Planned*: job-work and returnable challans track **quantity returned**. Design a **Record return** action and
  dialog: per line, the qty returned now and the date, plus a progress row (sent / returned / pending).

### SAL-INV-1 Tax invoices list — Built
- **Route**: `/sales/invoices`.
- **Columns**: Number · Date · Party · **Customer PO** · **Payment due** · Status · Total.
- *Planned*: a **Paid** progress badge (Unpaid / Part paid / Paid, plus **Overdue** past the due date) once receipts
  exist; an **IRN** column when e-invoicing is on.
- **Filters**: search, status, From–To. A range that runs backwards shows "Pick a date on or after From." on To
  and isn't sent.
- **Actions**: New invoice.

### SAL-INV-2 Invoice form, draft — Built
- **Header fields**: customer\*, date\*, **Payment due**, Customer PO no. and date, Ship to (decides the place
  of supply), **Reverse charge** checkbox, vehicle no., transporter, e-way bill no.
- **Behaviour**: switching Ship to between a Haryana and a Delhi address flips the totals between
  CGST + SGST and IGST live.
- **States**: new fresh; new **from a challan** or **from an order**, with the "Made from" note; draft with Save
  and **Finalize invoice** (asks first: "It can't be edited afterwards"); errors.

### SAL-INV-3 Invoice, finalized — Built
- Read-only document view (P-3). Actions: **Create credit note**, **Print**; admin only: **Cancel invoice…** in
  ⋯ (P-7 cancel with a reason).
- *Planned*: a **Payments** panel listing receipts allocated to it, the balance due, and **Record receipt**
  (opens ACC-RCT-2 prefilled).

### SAL-INV-4 Invoice, cancelled — Built
- A red badge and the note: "Cancelled on 11 Nov 2026: Raised twice by mistake. Its number stays used."

### SAL-INV-5 Invoice, viewer — Built
- Read-only, with the viewer note and no actions except Print.

### SAL-INV-6 Invoice e-invoicing states — Planned (#97, #98)
When e-invoicing is on in Settings, a finalized B2B invoice, credit note or debit note goes to the government
portal (IRP) for an **IRN**. Design:

- **IRN generated**: an e-invoice panel with the IRN (64 characters, monospace, copyable), Ack no. and date, and
  the **signed QR code**.
- **IRN pending**: a yellow badge "IRN pending", a warning that the invoice must not be sent to the customer yet,
  and a **Retry** button showing the last error ("IRP didn't answer. Last tried 11:42.").
  - **Print is blocked** in this state.
  - Also show the deadline: "Report by 10 Dec 2026 (30 days)".
- **IRN cancelled**: cancelled within the 24-hour window. After 24 hours the Cancel action explains that only a
  credit note can correct it.
- **Validation failed**: the e-invoice JSON failed the schema. A list of problems, each linking to its field
  (e.g. "HSN must be 6 digits on B2B invoices").
- **Dashboard and list**: a "3 IRNs pending" warning.

### SAL-CN-1 Credit notes list — Built
- **Route**: `/sales/credit-notes`. **There's no New button**: a credit note is only made from a finalized
  invoice.
- **Columns**: Number · Date · Party · **Reason** · **Against invoice** · Status · Total.

### SAL-CN-2 Credit note form — Built
- **Header fields**: the invoice it's against (read-only, linked), date, **reason\*** (Sales return / Rate
  difference / Other), Ship to.
- **Lines**: taken from the invoice. Each shows the qty left to credit.
  - **Sales return**: enter the returned qty; returned goods go back to stock.
  - **Rate difference**: the same qty at the difference in rate (billed ₹845, agreed ₹820, so credit ₹25 each).
- **States**: return, rate difference, error "More than the invoice has left to credit", finalized, cancelled.

---

## 6. Purchase

The place of supply for purchases is the factory's own state.

### PUR-PO-1 Purchase orders list — Built
- **Route**: `/purchase/orders`.
- **Columns**: Number · Date · Supplier · **Delivery by** · **Received** (Not / Partly / Received) · Status ·
  Total.
- **Actions**: New purchase order.

### PUR-PO-2 Purchase order form — Built
- **Header fields**: supplier\* (suppliers only), date\*, **Delivery by**, supplier's quotation no. and date.
- **Lines**: the item's purchase price fills the rate.
- **States**:
  - **Draft**: Save, **Mark as sent**.
  - **Sent**: read-only, with **Received so far** (ordered / accepted / rejected / pending per item),
    **Receive goods** and Print.
  - **Cancelled**.
  - **A supplier in another state**: the totals show IGST.

### PUR-GRN-1 GRNs list — Built
- **Route**: `/purchase/grns`. **Who**: operators (stores) record them.
- **Columns**: Number · Date · Supplier · **Supplier challan** · Status · Total.
- **Actions**: New GRN; **Receive against PO** (P-7, make one from several).

### PUR-GRN-2 GRN form — Built
- **Header fields**: supplier\*, date\*, **supplier's challan no.** and date, vehicle no., transporter, e-way bill no.
- **Lines**: **Accepted** (goes into stock and off the PO) and **Rejected** (sent back) per line, P-4's GRN
  variant.
- **States**:
  - **New from a PO**: its pending lines.
  - **Draft**: Save, **Mark received**.
  - **Received**: locked; the notes say why goods were rejected.
  - **Error**: a bad rejected qty, shown on its cell.

### PUR-BILL-1 Purchase bills list — Planned (#60, #61)
- **Route**: `/purchase/bills`. **Who**: admin and accountant.
- **Columns**: Number (ours) · **Supplier invoice no.** · Date · Supplier · **Due** · **ITC** (Eligible /
  Ineligible / Partly) · **Paid** progress · Status · Total.
- **Actions**: New bill; **From GRNs** (P-7: pick the supplier, tick their received GRNs not yet billed).

### PUR-BILL-2 Purchase bill form — Planned
- **Header fields**: supplier\*, **supplier invoice no.\*** and **date\***, our date, due date (from credit
  days), place of supply, reverse charge, **ITC eligible** (per line, defaulting to the whole bill).
- **Lines**: from the GRNs' accepted qty, or fresh. The **GST split** totals (CGST/SGST or IGST) must match the
  supplier's invoice. Show a "Difference from supplier invoice total" check when the user types the total printed
  on the supplier's invoice.
- **States**:
  - **Draft**: Save, **Post bill** (asks first; posts to the accounts).
  - **Posted**: read-only, with a **Payments** panel, **Record payment** and **Create debit note**.
  - **Cancelled**.
  - **Duplicate supplier invoice no.** for the same supplier (an error).

### PUR-DN-1 Debit notes list — Planned (#62)
- **Route**: `/purchase/debit-notes`. Made only from a posted bill.
- **Columns**: Number · Date · Supplier · Reason · Against bill · Status · Total.

### PUR-DN-2 Debit note form — Planned
- The mirror of SAL-CN-2 for purchases.
  - **Reasons**: Purchase return (goods go out of stock) and Rate difference.
  - **Lines**: taken from the bill, each showing the qty left to debit.
- **States**: draft, posted, cancelled, and an over-return error.

---

## 7. Accounts (M4)

Everything here is double-entry: a voucher's debits equal its credits. Invoices, credit notes, bills and debit
notes **post themselves**. These screens are for the vouchers people make by hand.

### ACC-RCT-1 Receipts list — Planned (#66, #67)
- **Route**: `/accounts/receipts`. **Who**: admin and accountant.
- **Columns**: Number · Date · Party · Mode (Bank / Cash / Cheque / UPI) · Reference (cheque/UTR no.) ·
  Status · Amount.
- **Actions**: New receipt.

### ACC-RCT-2 Receipt form (with bill-wise allocation) — Planned
- **Header fields**: date\*, party\* (customers), **received into\*** (a bank or cash ledger), amount\*, mode,
  reference no. and date, narration.
- **Allocation table**: the party's **open invoices**, oldest first, with columns
  `Invoice no. · Date · Due · Overdue days · Invoice total · Balance due · Allocate now`.
  - An **Auto-allocate oldest first** button.
  - Typing an amount in a row allocates to it; the amount can't exceed the balance due.
  - A footer shows **Allocated**, **On account** (the remainder, allowed) and the receipt amount.
- **Actions**: Save draft; **Post receipt** (primary, asks first).
- **States**: new from an invoice (SAL-INV-3 → Record receipt, with that invoice preselected); a party with no
  open invoices (the whole amount goes on account); errors (over-allocation, no bank ledger); posted (read-only);
  cancelled.
- A **receipt print** (PRT-8) for the customer.

### ACC-PAY-1 Payments list — Planned
- **Route**: `/accounts/payments`. The same as receipts, for suppliers.

### ACC-PAY-2 Payment form (with bill-wise allocation) — Planned
- The mirror of ACC-RCT-2: **paid from** a bank or cash ledger, allocated against the supplier's open
  **purchase bills**.
- **Also used for non-party payments** (salary, PF/ESI deposits, expenses). In that case the "To" side is any
  ledger (Salary Payable, PF Payable, Electricity…) and there's no allocation table.
  - Design both: a supplier payment, and an expense payment.

### ACC-JV-1 Journals list — Planned (#68)
- **Route**: `/accounts/journals`.
- **Columns**: Number · Date · Narration · Status · Amount.

### ACC-JV-2 Journal form — Planned
- **Header fields**: date\*, narration\*.
- **Entries grid**: `Ledger (picker) · Debit (₹) · Credit (₹) · Line narration`. Each line has either a debit or
  a credit.
  - Enter moves between cells; a new line is added automatically.
  - **Totals row**: Total Dr, Total Cr and the **Difference**, which shows red until it's zero.
  - **Post** is disabled while the voucher doesn't balance.
- **States**: balanced, unbalanced, posted, an auto-posted voucher opened from a document (read-only, with a link
  "Posted by INV/26-27/0009"), and cancelled.

### ACC-CON-1 Contra — Planned (#68)
- **Route**: `/accounts/contra`. A list plus a small form: date, **from** (cash or bank), **to** (cash or bank),
  amount, reference, narration. Examples: cash deposited in the bank, or cash withdrawn.

### ACC-OB-1 Opening balances — Planned (#69)
- **Route**: `/accounts/opening-balances`. **Who**: admin and accountant.
- **Purpose**: each ledger's balance on 1 April of the FY chosen in the header, mainly for the first year
  (cut-over from Tally).
- **Layout**: a grid of every ledger grouped by group: `Group · Ledger · Debit (₹) · Credit (₹)`.
  - Party ledgers show the party's opening balance.
  - **Totals** must balance. Show the difference, and **Opening balance difference** as a suspense line.
- **States**: an empty first year, balanced, unbalanced, and locked (a later FY, carried forward from closing
  balances, read-only).

---

## 8. Inventory (M5)

### INV-STK-1 Stock summary — Planned (#78)
- **Route**: `/inventory/stock`. **Who**: everyone except viewers without stock rights; operators included.
- **Columns**: Item code · Name · Type · Unit · **Opening** · **In** · **Out** · **Closing** · Closing value (₹)
  · Reorder level, with a **Low** badge when closing ≤ reorder level.
- **Filters**: date range (closing as on the To date), type, search, "Only items with stock".
- **Drill down**: a row opens INV-STK-2.

### INV-STK-2 Item stock ledger — Planned (#78)
- **Route**: `/inventory/stock/:itemId`.
- **Header**: item code, name, unit, and opening, closing and reorder level as facts.
- **Table**: `Date · Document (type + number, linked) · Party · In · Out · Balance`, with a running balance. It
  covers challans, invoices (only when not already challaned), GRNs, credit and debit notes, and adjustments.
- **Filters**: date range.

### INV-ADJ-1 Stock adjustments list and form — Planned (#77)
- **Route**: `/inventory/adjustments`, `/inventory/adjustments/new`.
- **Form**: date\*, reason\* (Physical count / Damage / Scrap / Correction / Other), narration, and lines of
  `Item · Current stock · Adjust by (+/–) or New quantity · Unit · Value (₹)`.
- **Actions**: Save, **Post** (asks first).
- **States**: draft, posted (read-only), and an error when stock would go below zero.

### INV-LOW-1 Low stock — Planned (#79)
- **Route**: `/inventory/low-stock`.
- **Columns**: Item · Closing · Reorder level · Short by · Last purchase (date, supplier, rate) · open PO qty.
- **Actions**: select rows, then **Create purchase order** (prefilled with those items).
- **States**: "Nothing is below its reorder level."

### INV-JW-1 Job-work register — Planned (P2)
- **Route**: `/inventory/job-work`.
- **Purpose**: material sent to job workers on job-work challans versus what came back. This is the basis for
  the ITC-04 return.
- **Columns**: Challan no. · Date · Job worker · Item · Sent · Returned · Pending · Days out, with an **Overdue**
  badge after 1 year for inputs or 3 years for capital goods, per GST.
- **Filters**: job worker, period (quarter), and pending only.

---

## 9. Reports and GST (M4, M6)

All use P-8 (report page), with CSV export and print.

### REP-LS-1 Ledger statement — Planned (#70)
- **Route**: `/reports/ledger`. **Filters**: ledger\* (or party), date range.
- **Table**: opening balance row; then `Date · Voucher type · Number (linked) · Narration / party · Debit · Credit ·
  Running balance (Dr/Cr)`; then the closing balance row.
- **Also opened from**: a party's form ("View statement") and any balance in another report.

### REP-DB-1 Day book — Planned (#72)
- **Route**: `/reports/day-book`. Every voucher and document posted on a day or in a range, in order:
  `Date · Type · Number · Party / narration · Debit · Credit`. It can be filtered by voucher type.

### REP-OUT-1 Outstanding receivables / payables with ageing — Planned (#71)
- **Route**: `/reports/outstanding`, with a **Receivables / Payables** switch.
- **Summary**: one row per party with `Party · Total due · 0–30 · 31–60 · 61–90 · 90+ days`, and a totals row.
  Amounts over the party's credit limit are marked.
- **Detail**: expanding a party shows its open bills: `Bill no. · Date · Due · Days overdue · Amount · Balance`.
- **Actions**: per party, Record receipt / payment and View statement.
- **As on** a date (defaults to today).

### REP-TB-1 Trial balance — Planned (#73)
- **Route**: `/reports/trial-balance`. Groups with their ledgers, which can be expanded and collapsed:
  `Particulars · Opening · Debit · Credit · Closing`.
- Totals must match. A difference, if any, is shown prominently as an error.

### REP-PL-1 Profit & loss — Planned (#74)
- **Route**: `/reports/profit-loss`. Shown either as the classic Tally two-column layout (expenses left, income
  right) or as a single vertical statement. Design the one you recommend.
- **Lines**: Sales, less returns, Purchases, Direct and Indirect expenses and incomes, then Gross profit and
  **Net profit**.
- Group lines expand to their ledgers. There's an optional "compare with previous FY" column.

### REP-BS-1 Balance sheet — Planned (#74)
- **Route**: `/reports/balance-sheet`. Liabilities and Capital against Assets, as on a date. Net profit carries
  into Capital.
- The same expand and compare options as the P&L.

### REP-SR-1 Sales register / REP-PR-1 Purchase register — Planned (#80)
- **Route**: `/reports/sales-register`, `/reports/purchase-register`.
- **Columns**: one row per invoice (or bill): `Date · Number · Party · GSTIN · Place of supply · Taxable · CGST
  · SGST · IGST · Total`, with totals.
- **Filters**: date range, party, and "Include credit / debit notes" (shown as negative rows).

### REP-GSTR1-1 GSTR-1 data — Planned (#81)
- **Route**: `/reports/gstr-1`. **Filters**: return period (a month, or a quarter for QRMP).
- **Tabs or sections**, with a count and taxable / tax totals for each:
  - **B2B**: by recipient GSTIN, then invoices.
  - **B2C Large**: inter-state invoices above ₹2.5 lakh to unregistered buyers.
  - **B2C Small**: rate- and state-wise summary.
  - **Credit / Debit notes (registered and unregistered)**.
  - **HSN summary**.
  - **Documents issued**: number series ranges and cancelled counts.
- **Warnings panel**: invoices missing a GSTIN or HSN, wrong HSN length, drafts in the period.
- **Actions**: **Export JSON** (for the GST offline tool) and Export CSV per section.

### REP-GSTR3B-1 GSTR-3B summary — Planned (#82)
- **Route**: `/reports/gstr-3b`. **Filters**: month.
- **Sections**:
  - **3.1** Outward supplies: taxable, IGST, CGST, SGST, cess.
  - **4** Eligible ITC: from purchase bills, with ineligible ITC reversed.
  - **Net tax payable** per head.
- Each figure drills down to the documents behind it. Export CSV.

### REP-EWB-1 E-way bill export — Planned (#83, P2)
- **Route**: `/reports/e-way-bills`.
- **Purpose**: a list of invoices and challans **above ₹50,000** in a date range, with their transport details.
- **Columns**: Number · Date · Party · Value · Distance · Vehicle · Transporter · e-way bill no. (if already
  entered).
- **Errors**: rows missing vehicle or transporter are flagged.
- **Actions**: tick rows, then **Export JSON** for bulk upload to the e-way bill portal.

---

## 10. Payroll (M9) — admin and accountant only

### PAY-EMP-1 Employees list — Planned (#101)
- **Route**: `/payroll/employees`.
- **Columns**: Code · Name · Department · Designation · Pay type (Monthly / Daily wage) · Monthly salary or daily
  rate · PF / ESI flags · Status (Active / Left).
- **Filters**: search, department, pay type, Show left.
- **Actions**: New employee.

### PAY-EMP-2 Employee form — Planned (#101, #102)
- **Sections**:
  - **Identity**: code\*, name\*, father's/spouse's name, gender, date of birth, date of joining\*, date of
    leaving.
  - **Work**: department, designation, skill category (unskilled / semi-skilled / skilled / highly skilled,
    for minimum wage), phone, address.
  - **IDs**: PAN, **Aadhaar** (always shown masked `XXXX-XXXX-1234`, with a "Change" action and never shown in
    full), UAN (PF), ESIC IP number.
  - **Bank**: account number and IFSC, or "Paid in cash".
  - **Salary structure**, effective-dated:
    - The current structure: pay type; **Monthly** (Basic, DA, HRA, Conveyance, Other allowance, with a gross
      total) or **Daily wage** (a daily rate).
    - Flags: PF applicable, ESI applicable, LWF applicable. Optional fixed monthly TDS.
    - A **history** table of past structures (effective from, gross) and **Revise salary** (a new structure from
      a date; the old one stays as history).
    - A warning, not a block, when pay is below the minimum wage for the skill category.
- **Actions**: Save; **Mark as left** (asks for the date of leaving).
- **States**: new, edit, left, errors (bad IFSC, bad UAN length), and the below-minimum-wage warning.

### PAY-ADV-1 Advances — Planned (#107)
- **Route**: `/payroll/advances`.
- **List columns**: Employee · Date · Amount · Monthly recovery · Recovered · Balance · Status (Open / Cleared).
- **Form** (dialog or page): employee\*, date\*, amount\*, monthly recovery\*, paid from (bank or cash ledger),
  note.
- **Detail**: the recovery schedule and history, one line per payroll run.

### PAY-RUN-1 Payroll runs list — Planned (#105)
- **Route**: `/payroll/runs`.
- **Columns**: Month (Nov 2026) · Employees · Gross · Deductions · Net pay · Status (Draft / Calculated /
  Finalized).
- **Actions**: **New run** (picks the month; there's one run per month).

### PAY-RUN-2 Payroll run grid — Planned (#106)
- **Route**: `/payroll/runs/:month`. This is the editable grid, P-9.
- **Header**: the month, its status, a working-days count, and actions: **Calculate**, then **Finalize**
  (asks first; locks the run and posts the salary journal). There are also Print register, Bank sheet and
  Payslips.
- **Input columns**, one row per active employee, typed or **pasted from Excel**: `Code · Name · Paid days ·
  OT hours · Advance recovery (prefilled) · Other addition · Other deduction · Remarks`.
- **Calculated columns**, read-only:
  - `Gross · PF (employee) · ESI (employee) · LWF · TDS · Advance · Net pay`.
  - Employer PF / ESI / LWF can be shown or hidden.
- **Totals row**, sticky. A **summary panel** shows total gross, deductions, employer contributions, net pay,
  bank vs cash split, and the count of employees below minimum wage.
- **States**:
  - **Draft** (inputs being entered), with errors such as paid days more than the days in the month.
  - **Calculated**, ready to review.
  - **Finalized**: locked. Corrections go into next month's run as arrears or adjustments, and the screen says so.
  - **Pasted data with errors**: highlighted cells and a summary.
  - **An employee who joined or left mid-month**.

### PAY-OUT-1 Payslip — Planned (#108)
- An A4 print sheet per employee: company letterhead and the month.
  - Employee details: code, name, designation, UAN, ESIC no., bank A/c (masked).
  - Paid days and OT hours.
  - Earnings and Deductions in two columns, then **Net pay** in figures and words.
  - Employer contributions as a footnote.
- **Print all** produces one payslip per page.

### PAY-OUT-2 Salary register, bank transfer sheet and cash list — Planned (#109)
- **Salary register**: a report page (P-8), one row per employee with every earning and deduction column and
  totals. Print in A4 landscape and export CSV.
- **Bank transfer sheet**: a preview table `Name · Account no. · IFSC · Amount` with a total, and **Download
  CSV** for upload to net banking.
- **Cash-paid list**: employees without a bank account, `Name · Amount · Signature` column, for printing.
- **Statutory exports** (P2, #111): **PF ECR** text file and **ESI** contribution file, each a preview table and
  a Download button.

---

## 11. Settings

### SET-CO-1 Company — Built
- **Route**: `/settings/company`. **Who**: admin edits; others view.
- **Content**:
  - Legal name\*, trade name, GSTIN (fills state and PAN), PAN, phone, email.
  - **Logo** and **signature** image uploads, each with a preview, Replace and Remove.
  - Default terms and conditions.
  - **Addresses**: several, one marked **primary** (the registered office).
  - **Bank accounts**: several, one marked **default** (printed on invoices): bank, A/c no., IFSC, branch.
- **Actions**: Save (in the sticky header).
- **States**: first setup (empty), errors, read-only.

### SET-NUM-1 Numbering — Built
- **Route**: `/settings/numbering`. Shows the FY chosen in the header.
- **Layout**: one row per document type (Quotation, Sales order, Challan, Invoice, Credit note, PO, GRN, plus the
  planned Purchase bill, Debit note, Receipt, Payment, Journal, Contra), with columns:
  - **Prefix** (`{FY}` becomes 26-27).
  - **Digits** (zero padding).
  - **Next number**: can only move forward, and can't go below what's used.
  - A **live preview** (`INV/26-27/0004`). The preview warns when it is over 16 characters, the GST limit.
- **States**: errors per row ("Lower than a number already used. Numbers can only move forward."), read-only.
  Design it as a compact table, with the column labels shown once, not repeated per row.

### SET-GST-1 GST & e-invoicing — Planned (#94, #96)
- **Route**: `/settings/gst`. **Who**: admin.
- **Turnover**: a range selector. Above ₹5 crore, **6-digit HSN on B2B invoices** is required and
  **e-invoicing** becomes mandatory; show what each choice switches on.
- **E-invoicing**:
  - An **on/off** switch, the provider (GSP name or direct IRP), credentials status ("Connected · tested
    12 Nov 2026" or "Not set up"), sandbox / production, and **Test connection**.
  - Credentials themselves are server config. Show only their status, never the secrets.
- **E-way bill**: the threshold (₹50,000), shown as information.

### SET-RATE-1 GST rates — Planned (FR-3.3)
- **Route**: `/settings/gst-rates`. **Who**: admin edits; accountants view.
- **Columns**: Rate (0, 5, 18, 40…) · Effective from · Effective to · Status (Current / Future / Ended).
  Rates are data because they change (e.g. the Sept 2025 rationalisation).
- **Actions**: **Add rate** (rate, effective from); **End rate** (effective to). Rates are never deleted.
- **Note**: which items use each rate, with a link to the filtered items list.

### SET-PAY-1 Payroll rates — Planned (#103)
- **Route**: `/settings/payroll-rates`. Effective-dated like GST rates. A **history** per setting, and **Add new
  rates from** a date.
- **Groups**:
  - **PF**: employee % (12), employer EPF % (3.67), EPS % (8.33), wage ceiling (₹15,000), and "Cap PF wages at the
    ceiling".
  - **ESI**: employee % (0.75), employer % (3.25), gross threshold (₹21,000).
  - **Haryana LWF**: employee and employer amounts.
  - **Overtime** multiplier (2×).
  - **Minimum wages** per skill category (revised twice a year).
- **Reminder banner**: "Check these with the CA each April and October."

### SET-IMP-1 Import from Tally — Planned (#90–#92, M8)
- **Route**: `/settings/import`. **Who**: admin. Uses P-10 (wizard).
  1. **Upload**: the Tally XML export of masters (drag and drop or browse), with instructions on how to export
     it from Tally.
  2. **Review**: counts found (parties, items, ledgers, opening balances), with a preview table per type.
  3. **Exceptions report**:
     - Rows that need attention: duplicates, missing or invalid GSTIN, unknown units, an HSN missing.
     - Each with Fix inline / Skip / Merge with an existing record.
     - The import never fails as a whole; it reports.
  4. **Import**: a progress indicator, then a summary ("312 parties, 148 items, 96 ledgers imported; 7 skipped")
     and a downloadable exceptions CSV.
- **Opening balances** as of the cut-over date: the same wizard, ending in ACC-OB-1 for review.

### SET-AUD-1 Audit log — Planned (#88)
- **Route**: `/settings/audit-log`. **Who**: admin (accountant read-only).
- **Columns**: When · Who · Action (Created / Updated / Status changed / Cancelled) · Record (type + number,
  linked) · Summary.
- **Filters**: date range, user, record type, action.
- **Detail**: expanding a row shows a **field-by-field diff** (field · before · after), including the line-item
  changes.
- **Also**: a compact **History** panel on every document (P-3), with the same entries for that record.

---

## 12. Print sheets (A4, black on white, light only)

Every print sheet opens on its own page, outside the app frame, with a small toolbar that doesn't print. The
toolbar has the **Copy** selector where the document has copies, **Print or save as PDF**, and Back.

Every sheet carries:
- The letterhead: logo, legal and trade name, address, GSTIN, PAN, phone and email.
- Bill to and Ship to, the document's facts block, and the lines.
- Totals with the **amount in words** (lakh/crore), the **HSN/SAC tax summary**, bank details (sales sheets),
  terms, and "For *Company* / Authorised Signatory" with the signature image.
- When lines run over several pages, the line-table header repeats and pages are numbered "Page 1 of 2".

| ID | Sheet | Status | Notes |
|---|---|---|---|
| PRT-1 | Quotation | Built | "Valid until". |
| PRT-2 | Sales order | Planned | Customer PO no. and date. |
| PRT-3 | Delivery challan | Built | Titled by type ("Delivery Challan", "Job Work Challan"). Copies: Original for Consignee, Duplicate for Transporter, Triplicate for Consigner. Transport details. |
| PRT-4 | Tax invoice | Built (IRN planned) | Copies: Original for Recipient, Duplicate for Transporter, Triplicate for Supplier. CGST Rule 46 fields. *Planned:* **IRN, Ack no. and date and the signed QR code** in the header area when e-invoiced. |
| PRT-5 | Credit note | Built | Names the invoice it's against, with its date. Copies: Original for Recipient, Duplicate for Supplier. |
| PRT-6 | Purchase order | Built | Deliver to is the factory's own address; no bank details. |
| PRT-7 | Debit note | Planned | Against the purchase bill, to the supplier. |
| PRT-8 | Receipt voucher | Planned | For the customer: received with thanks, mode and reference, and the invoices settled. |
| PRT-9 | Payslip | Planned | See PAY-OUT-1. |
| PRT-10 | Reports | Planned | Every report page prints a plain A4 version with the company name, report name, period and page numbers. |

Also design how a sheet fits a **phone screen**, scaled to width, for the owner checking an invoice (#184).

---

## 13. Sample data for mockups

Use fictional but realistic data so the screens look like the real thing:

- **Company**: Northwind Fasteners Pvt Ltd, Plot 42, Sector 24, Faridabad, Haryana 121005. GSTIN
  `06AABCN1234F1Z5`, FY 2026-27.
- **Customers**:
  - Acme Castings Pvt Ltd (Faridabad, Haryana 06, GSTIN `06AAACA1234B1ZM`, plus a shipping address
    "Plant 2, Plot 88, IMT, Faridabad").
  - Delta Auto Components (New Delhi, 07: IGST).
  - Sharma Steels Pvt Ltd (New Delhi).
  - Gupta Traders (Palwal, unregistered).
- **Suppliers**: Haryana Steel Traders, Bharat Wire Industries.
- **Items**:
  - FG-101 Hex Bolt M10 x 50 (NOS, 18%, ₹12.50).
  - FG-102 Hex Nut M10 (NOS, 18%, ₹3.20).
  - RM-12 MS Rod 12mm (KGS, 18%, ₹62.40).
  - FG-210 Flange Plate 150 (NOS, 18%, ₹845.00).
  - SV-01 Zinc plating (job work, SAC 998873).
- **Numbers**: `QTN/26-27/0001`, `SO/26-27/0004`, `DC/26-27/0009`, `INV/26-27/0012`, `CN/26-27/0002`,
  `PO/26-27/0003`, `GRN/26-27/0005`, `RCT/26-27/0007`.
- **Amounts** in lakh grouping: ₹1,33,576.00 · ₹14,750.00 · ₹1,23,456.78 Cr.
- **People**: Asha Verma (admin), Ravi Kumar (operator), R. Mehta (contact at Acme).

## 14. Priorities

If the work has to be phased, design in this order. It matches the build order.

1. Shared patterns P-1 to P-8.
2. Sales and purchase screens that exist (§5, §6 built), then purchase bills and debit notes.
3. Accounts (§7) and the accounts reports (ledger statement, outstanding, trial balance, P&L, balance sheet).
4. Inventory (§8).
5. GST reports and e-invoicing (§9 GST parts, SAL-INV-6, SET-GST-1, PRT-4 IRN).
6. Settings: GST rates, audit log, Tally import.
7. Payroll (§10, SET-PAY-1).
