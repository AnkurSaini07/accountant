# Accountant — Requirements Document

**Status:** Draft v1 · **Date:** 2026-11-10 · **Owner:** Ankur Saini

## 1. Background

A small manufacturing factory in Faridabad, Haryana currently runs its billing, delivery challans,
purchase orders, quotations and accounting in **Tally**. The goal is a web-based, in-house
replacement that covers what a small Indian manufacturing business needs day to day, is easier
to use on the shop floor and office, and can be extended without Tally licensing limits.

### Goals
- Replace Tally for everyday documents: quotation → sales order → delivery challan → tax invoice, and purchase order → goods receipt → purchase bill.
- Keep GST-compliant books (CGST/SGST/IGST) with double-entry accounting underneath.
- Track stock of raw material and finished goods, including material sent out on job work.
- Produce the reports the CA needs (GSTR-1, GSTR-3B summaries, ledgers, trial balance, P&L, balance sheet).
- Move existing masters and opening balances from Tally.
- Make monthly salaries: employee records, salary calculation with PF/ESI/LWF, payslips, bank transfer sheet.
- Be ready for e-invoicing, assuming turnover will cross ₹5 crore.

### Non-goals (v1)
- Full HR/payroll: daily attendance, biometric integration, leave management, Form 16 / income-tax computation, gratuity and bonus calculation.
- Manufacturing BOM & production planning, multi-currency, multi-branch consolidation.
- Direct filing on the GST portal (we export data; the CA files).
- A mobile app (the web UI must work on a phone browser, though).

## 2. Users & roles

| Role | Who | Can do |
|---|---|---|
| **Admin** | Owner | Everything, including company settings, deleting/cancelling finalized documents, payroll |
| **Accountant** | Office / CA staff | All documents, vouchers, reports, payroll; cannot change company settings |
| **Operator** | Dispatch / store | Create challans, GRNs, view stock; no accounting or reports |
| **Viewer** | Read-only | View documents and reports |

Users and their roles live in **Pocket ID** (the OAuth/OIDC server, §4.2). A role is a Pocket ID
group: `accountant-admin`, `accountant-accountant`, `accountant-operator`, `accountant-viewer`.
Operators and viewers never see payroll or employee data.

## 3. Domain glossary

| Term | Meaning |
|---|---|
| **Quotation** | Price offer to a customer. No accounting or stock effect. |
| **Sales Order (SO)** | Customer's confirmed order. No accounting or stock effect. |
| **Delivery Challan (DC)** | Document that moves goods without (or before) a tax invoice, per CGST Rule 55. Reduces stock. Types: *Sale*, *Job work*, *Supply on approval*, *Returnable*. |
| **Tax Invoice** | GST sale invoice per CGST Rule 46. Posts to accounts; reduces stock if not already reduced by a challan. |
| **Credit Note / Debit Note** | Adjust a past invoice / purchase bill (returns, rate difference). |
| **Purchase Order (PO)** | Order placed on a supplier. No accounting effect. |
| **GRN** | Goods Receipt Note — material received against a PO. Increases stock. |
| **Purchase Bill** | Supplier's invoice entered into the books. Posts to accounts; ITC eligible. |
| **Voucher** | Accounting entry: Receipt, Payment, Journal, Contra. |
| **Ledger** | An account (party, bank, cash, sales, purchase, tax, expense…). Grouped like Tally (Sundry Debtors, Sundry Creditors, Duties & Taxes, …). |
| **FY** | Indian financial year, 1 April – 31 March, labelled e.g. `2026-27`. |
| **Place of supply** | Decides tax type: same state as company → CGST + SGST; other state → IGST. Company state = Haryana (06). |
| **E-invoice / IRN** | B2B invoices reported to the government's Invoice Registration Portal (IRP), which returns an Invoice Reference Number (IRN) and a signed QR code to print on the invoice. Mandatory above ₹5 crore aggregate turnover. |
| **Payroll run** | One month's salary calculation for all active employees, finalized (locked) before payment. |
| **PF / ESI / LWF** | Statutory deductions: Employees' Provident Fund, Employees' State Insurance, Haryana Labour Welfare Fund. Employer pays a matching/extra share. |
| **Paid days** | Days an employee is paid for in the month (present + paid holidays/weekly offs). Salary is prorated on paid days. |

## 4. Functional requirements

Priority: **P0** = needed to stop using Tally for daily billing, **P1** = needed to stop using Tally entirely, **P2** = later.

### 4.1 Company & settings (P0)
- FR-1.1 Company profile: legal name, trade name, address, state, GSTIN, PAN, phone, email, bank details (name, A/c, IFSC, branch), logo, signature image, default terms & conditions.
- FR-1.2 One company in v1, but every table carries `company_id` so a second firm can be added later without migrating data.
- FR-1.3 Financial year selector; documents and reports default to the current FY.
- FR-1.4 Document number series per document type per FY, with configurable prefix (e.g. `INV/26-27/0001`). Numbers are consecutive, unique within the FY, and at most 16 characters (GST rule).

### 4.2 Users & security (P0)
- FR-2.1 The app does **not** store passwords. Login goes through **[Pocket ID](https://pocket-id.org)**, a self-hosted OIDC provider that signs users in with passkeys. The app is a confidential OIDC client and uses the Authorization Code flow with PKCE, `state` and `nonce`.
- FR-2.2 After the callback, the server validates the ID token, upserts a local `users` row keyed by the OIDC `sub` (name, email, role), and issues its own session cookie (HttpOnly, SameSite=Lax, Secure in prod). The browser never sees OIDC tokens.
- FR-2.3 Role = the user's Pocket ID group (§2), read from the `groups` claim on every login. No group means no access. Users are added, removed and assigned groups in the Pocket ID admin UI, not in this app.
- FR-2.4 Role-based access per §2, enforced on the API (UI hiding is only a convenience).
- FR-2.5 Logout ends the app session and redirects to Pocket ID's end-session endpoint.
- FR-2.6 Audit log of create/update/cancel on documents and vouchers: who, when, what changed (P1).
- FR-2.7 *(P2)* An **MCP server** for the app, protected by the same Pocket ID instance as the OAuth authorization server. MCP clients register through **CIMD** (Client ID Metadata Documents). Pocket ID supports CIMD but has decided not to support DCR (Dynamic Client Registration), which the MCP spec now deprecates.

### 4.3 Masters (P0)
- FR-3.1 **Parties** (customers, suppliers, or both): name, GSTIN (validated with checksum; state auto-filled from the first two digits), PAN, registration type (Regular / Composition / Unregistered / Consumer), billing address, one or more shipping addresses, contact person, phone, email, credit days, credit limit, opening balance (Dr/Cr).
- FR-3.2 **Items**: name, code, description, type (Raw material / Finished good / Semi-finished / Service), HSN/SAC code, unit (NOS, PCS, KGS, MTR, SET, …), GST rate, sale price, purchase price, opening stock & value, reorder level.
- FR-3.3 **GST rates** are data, not code (rates change — e.g. the Sept 2025 GST rationalisation). Each rate has an effective-from date.
- FR-3.4 **Ledgers & groups**: Tally-like default chart of accounts seeded on setup; users can add ledgers (bank accounts, expense heads). Party ledgers are created automatically with a party.
- FR-3.5 Search, filter and deactivate (never hard-delete) masters that are used in documents.

### 4.4 Sales cycle (P0)
- FR-4.1 **Quotation**: party, date, validity, line items (item, description, qty, unit, rate, discount %, GST rate), terms, notes. Statuses: Draft → Sent → Accepted / Rejected / Expired. Convert to Sales Order or directly to Invoice.
- FR-4.2 **Sales Order**: from quotation or fresh; customer PO number & date; tracks pending quantity as challans/invoices are made against it.
- FR-4.3 **Delivery Challan**: from SO or fresh; challan type (§3); vehicle number, transporter, e-way bill number; ship-to address. Reduces stock. Job-work and returnable challans track quantity returned.
- FR-4.4 **Tax Invoice**: from challan(s), SO or fresh. Must carry everything CGST Rule 46 needs: supplier & recipient GSTIN, invoice number & date, place of supply, ship-to, HSN per line (6 digits on B2B invoices once turnover is above ₹5 crore, a company setting), taxable value, CGST/SGST or IGST rate & amount, reverse-charge flag, total in figures and words (Indian format: lakh/crore), signature. Round-off to nearest rupee posted to a Round Off ledger.
- FR-4.5 Invoices are **Draft** until **Finalized**. Finalized invoices cannot be edited — only cancelled (admin) or adjusted by credit note. Cancelled numbers stay used.
- FR-4.6 **Credit Note** against an invoice (sales return / rate difference); returned goods go back to stock.
- FR-4.7 TCS / TDS fields on invoice (P2).

### 4.5 Purchase cycle (P0 for PO, P1 for the rest)
- FR-5.1 **Purchase Order**: supplier, delivery date, line items, terms; tracks pending qty.
- FR-5.2 **GRN**: against PO or fresh; received / accepted / rejected qty; increases stock.
- FR-5.3 **Purchase Bill**: supplier invoice no. & date, from GRN(s) or fresh, GST split, ITC eligible flag; posts to accounts.
- FR-5.4 **Debit Note** against a purchase bill (purchase return).

### 4.6 Printing & sharing (P0)
- FR-6.1 Clean A4 print layout for every document, with company letterhead, logo, HSN-wise tax summary, bank details, terms and signature.
- FR-6.2 Invoice prints in *Original for Recipient / Duplicate for Transporter / Triplicate for Supplier* copies.
- FR-6.3 Save as PDF via the browser's print dialog in v1; server-side PDF for email/WhatsApp sharing in P2.

### 4.7 Accounting (P1)
- FR-7.1 Double-entry: every posting is a voucher whose debits equal its credits; enforced in code and checked by tests.
- FR-7.2 Invoices, credit notes, purchase bills and debit notes auto-post (party Dr/Cr, sales/purchase, output/input CGST/SGST/IGST, round off).
- FR-7.3 **Receipt** and **Payment** vouchers with bill-wise allocation against invoices / purchase bills (on-account allowed).
- FR-7.4 **Journal** and **Contra** (cash ↔ bank) vouchers.
- FR-7.5 Opening balances per ledger per FY.

### 4.8 Inventory (P1)
- FR-8.1 Stock movements are recorded by challans, invoices (when not already challaned), GRNs, credit/debit notes and manual stock adjustments.
- FR-8.2 Stock summary by item (opening, in, out, closing) and item-wise stock ledger.
- FR-8.3 Low-stock list from reorder levels.
- FR-8.4 Job-work register: material out to job workers vs returned (basis for ITC-04) (P2).

### 4.9 Reports (P1 unless noted)
- FR-9.1 Sales register, purchase register (P0), with date/party filters and CSV export.
- FR-9.2 Ledger statement (P0), day book, outstanding receivables/payables with ageing (0-30, 31-60, 61-90, 90+).
- FR-9.3 Trial balance, profit & loss, balance sheet.
- FR-9.4 GSTR-1 data (B2B, B2C large/small, credit/debit notes, HSN summary) exportable for the CA / offline tool.
- FR-9.5 GSTR-3B summary (outward tax, ITC).
- FR-9.6 Dashboard: today's/month's sales, receivables due, payables due, low stock.

### 4.10 GST integrations
- FR-10.1 *(P2)* E-way bill JSON export for bulk upload (required for consignments above ₹50,000).
- FR-10.2 *(P1)* **E-invoicing.** We assume turnover will cross ₹5 crore, so the invoice flow is designed for it from the start and switched on by a company setting:
  - Build the e-invoice JSON (government INV-01 schema) from a finalized B2B invoice, credit note or debit note, and validate it before sending.
  - Send it to the IRP through a GSP (GST Suvidha Provider) or direct API access. Credentials are config, not code.
  - Store the IRN, acknowledgement number and date, and the signed QR code on the invoice. Print the IRN and QR on the invoice.
  - Cancel the IRN within the IRP's 24-hour window when an invoice is cancelled. After that, only a credit note can correct it.
  - If the IRP is down, the invoice stays *Finalized — IRN pending*, with a retry action. It must not be printed as final without its IRN.
  - Report within 30 days of the invoice date (the IRP rejects late reporting once turnover is ₹10 crore or more). The app warns about pending IRNs.
- FR-10.3 *(P2)* E-way bill generation through the e-invoice API (Part B from the IRN).

### 4.11 Migration from Tally (P1)
- FR-11.1 Import ledgers/parties and stock items from a Tally XML export.
- FR-11.2 Import opening balances (ledger and stock) as of the cut-over date.
- FR-11.3 Run both systems in parallel for one month before switching off Tally.

### 4.12 Salary / basic payroll (P1)
Scope is "make the monthly salary correctly", not HR. Access is limited to Admin and Accountant.
- FR-12.1 **Employee master**:
  - Identity: code, name, father's/spouse's name, gender, date of birth, date of joining, date of leaving.
  - Work: department, designation, phone, address.
  - IDs: PAN, Aadhaar (stored encrypted, always shown masked `XXXX-XXXX-1234`), UAN (PF), ESIC IP number.
  - Bank account number and IFSC.
  - Status: active / left. Employees are deactivated, never deleted.
- FR-12.2 **Pay type**: *Monthly* (fixed monthly salary, prorated by paid days) or *Daily wage* (rate × paid days), since both are common on a factory floor.
- FR-12.3 **Salary structure** per employee, with an effective-from date so increments keep history:
  - Earnings: Basic, DA, HRA, Conveyance, Other allowance, or a daily rate.
  - Flags: PF applicable, ESI applicable, LWF applicable.
  - Optional fixed monthly TDS.
- FR-12.4 **Statutory settings are data**, effective-dated like GST rates, because rates and ceilings change:
  - PF: employee 12% and employer 12% (split 3.67% EPF + 8.33% EPS) of PF wages (Basic + DA). Option to cap PF wages at the ₹15,000 ceiling.
  - ESI: employee 0.75% and employer 3.25% of gross, when gross is at or below the ₹21,000 threshold.
  - Haryana LWF: employee and employer amounts. Haryana has no professional tax.
  - Overtime multiplier: 2× the ordinary rate, per the Factories Act.
  - Minimum wage per skill category: the app warns when pay is below it, but doesn't block.
- FR-12.5 **Payroll run** per month:
  1. Create the run for all active employees.
  2. Enter paid days, OT hours, advance recovery and one-off additions or deductions per employee in one editable grid, typed or pasted from Excel.
  3. Calculate gross, PF, ESI, LWF, TDS and net pay. Rupee rounding happens on net pay.
  4. Review the totals, then **finalize**, which locks the run.
  5. Corrections after that are made in the next month's run as arrears or adjustments.
- FR-12.6 **Advances / loans**: record an advance paid to an employee with a monthly recovery amount. The recovery appears in each payroll run until it's cleared.
- FR-12.7 **Outputs**:
  - Payslip per employee (print / PDF).
  - Salary register for the month.
  - Bank transfer sheet (CSV of name, account, IFSC, amount) for bulk upload to net banking.
  - Cash-paid list for employees without a bank account.
- FR-12.8 **Accounting**:
  - Finalizing a run posts one journal: Salary & Wages Dr and Employer PF/ESI/LWF Dr, against Salary Payable, PF Payable, ESI Payable, LWF Payable, TDS Payable and Employee Advances Cr.
  - Paying salaries and depositing PF/ESI use normal payment vouchers.
- FR-12.9 *(P2)* PF ECR text file and ESI monthly contribution file for upload to the EPFO and ESIC portals.

## 5. Non-functional requirements

- **NFR-1 Correctness of money:** amounts stored as integer paise; quantities as integers in the smallest unit or fixed 3-decimal precision. No floating-point money anywhere.
- **NFR-2 Data safety:** daily automatic backup, kept 30 days, with a tested restore procedure. Finalized documents are immutable.
- **NFR-3 Performance:** pages load in < 1 s on the office LAN with 5 years of data (~50k invoices).
- **NFR-4 Usability:** keyboard-friendly data entry (Tally users are keyboard-heavy); works on a phone for viewing and challans. Accessible components (React Spectrum).
- **NFR-5 Localisation:** INR formatting `1,23,456.00`, amount in words in lakh/crore, dates `DD-MM-YYYY`. English UI in v1, Hindi labels P2.
- **NFR-6 Security:** no passwords in the app (Pocket ID passkeys), sessions server-side, role checks on every API route, input validated at the API boundary, HTTPS in production.
- **NFR-7 Testability:** every task ships with tests. CI runs typecheck and all tests on every push. There are three layers:
  - **Unit / API tests** (`bun test`): every backend and shared change.
  - **Component tests** (`bun test` with happy-dom and React Testing Library): every screen. Tests find elements by role and label, never by CSS class, because React Spectrum generates its own class names.
  - **End-to-end tests** (Playwright): a few critical flows per milestone, such as sales, purchase, receipts and payroll. Tests sign in through a test-only route, because passkeys can't be automated; the real login is covered by mocked tests. CI keeps a Playwright trace of every failure.

## 6. Technical decisions

| Area | Choice | Notes |
|---|---|---|
| Runtime | **Bun** | Also package manager, test runner, bundler. |
| Backend | **Hono** on `Bun.serve()` | JSON API under `/api/*`. |
| Frontend | **React** + **React Spectrum** (latest: `@react-spectrum/s2`) | S2 needs its style macro at build time; task #3 verifies it works with Bun's bundler, falling back to `@adobe/react-spectrum` v3 if not. |
| DB access | **Reylo** — typed `.sql` files run through `Bun.sql` | Queries are type-checked against the dev Postgres. Needs TypeScript 7.1 for type inference. |
| Database | **Postgres** in dev, CI and prod | Dev runs in OrbStack via `compose.yaml`, at `postgres.accountant.orb.local`. |
| Migrations | Plain numbered `.sql` files + a small runner | Reylo only runs queries; it does not manage schema. |
| Validation | **Zod** at the API boundary | Shared schemas between server and web. |
| Auth | **Pocket ID** (OIDC) + `oauth4webapi` client | Dev: `bun run services:up` runs Pocket ID at `https://pocket-id.accountant.orb.local`. That is real HTTPS on a real hostname, so passkeys behave as in production. |
| Printing | HTML/CSS print layouts + browser print-to-PDF | Server PDF later. |
| UI testing | happy-dom + Testing Library for components, **Playwright** for end-to-end | `Bun.WebView` was considered. It is experimental and has no role/label locators, no auto-waiting assertions or traces, and no cookie, network or upload control on WebKit. Revisit when it matures. |

### Proposed layout
```
src/
  server/        Hono app, routes, services, *.sql queries
  web/           React app (index.html entry, pages, components)
  shared/        code used by both: money, GST, FY, GSTIN, zod schemas
migrations/      0001_*.sql, 0002_*.sql …
docs/            this document, ADRs
```

### Data model (outline)
- `companies`, `users` (keyed by OIDC `sub`), `sessions`, `audit_log`
- `parties`, `party_addresses`, `items`, `units`, `gst_rates`, `ledger_groups`, `ledgers`
- `number_series`
- `documents` (one table, `type` = QUOTATION | SALES_ORDER | DELIVERY_CHALLAN | TAX_INVOICE | CREDIT_NOTE | PURCHASE_ORDER | GRN | PURCHASE_BILL | DEBIT_NOTE) + `document_lines` + `document_links` (which document was created from which, with quantities)
- `vouchers` + `voucher_entries` (double-entry; invoices post one voucher each)
- `stock_movements`
- `einvoices` (invoice id, IRN, ack no/date, signed QR, status, last error)
- `employees`, `salary_structures` (effective-dated), `statutory_rates` (effective-dated), `employee_advances`, `payroll_runs` + `payroll_lines`

## 7. Phases / milestones

| Milestone | Scope | Outcome |
|---|---|---|
| **M0 Foundation** | Skeleton, DB, migrations, CI, shared utils, auth, app shell | App runs, users can log in |
| **M1 Masters** | Company, number series, parties, items, GST rates, ledgers | Masters can be maintained |
| **M2 Sales** | Quotation, SO, challan, tax invoice, credit note, printing | **Daily billing can move off Tally** |
| **M3 Purchase** | PO, GRN, purchase bill, debit note | Purchase side covered |
| **M4 Accounting** | Vouchers, auto-posting, receipts/payments, financial reports | Books kept in the app |
| **M5 Inventory** | Stock ledger, stock summary, low stock | Stock tracked |
| **M6 GST reports** | Registers, GSTR-1, GSTR-3B, e-way bill export, e-invoicing | CA can file from app data; e-invoice ready |
| **M7 Production** | Backups, audit log, deployment, MCP server | Safe to run for real |
| **M8 Tally migration** | Import masters & opening balances | Tally switched off |
| **M9 Payroll** | Employees, statutory settings, payroll run, payslips, bank sheet, salary posting | Monthly salary made in the app |

## 8. Risks

- **R-1 ~~Two SQL dialects~~ — resolved.** Postgres is used everywhere (dev, CI, prod), so the queries Reylo type-checks are the ones production runs.
- **R-2 TypeScript 7.1 is in beta.** Reylo's types need it. Pin the version; runtime still works if type inference breaks.
- **R-3 React Spectrum S2 + Bun bundler.** S2 relies on build-time macros; verified in task #3 before any UI work.
- **R-4 GST rule changes.** Rates and thresholds are data (FR-3.3); invoice format is reviewed with the CA before go-live.
- **R-6 Passkeys need HTTPS.** WebAuthn works on `localhost` but needs HTTPS and a real hostname elsewhere, so an office-LAN deployment needs a domain + TLS (e.g. a reverse proxy with a certificate), not a bare IP. Staff need a device with passkey support. For people without one, Pocket ID's one-time login codes are the fallback.
- **R-7 Pocket ID is a second service** to run, back up and keep updated. It is small (one container with its own SQLite volume), but it is a dependency for every login.
- **R-5 Tally data quality.** Old masters may have duplicates or missing GSTINs; the import produces an exceptions report rather than failing.
- **R-8 E-invoice API access.** Calling the IRP needs credentials from a GSP (a paid service) or direct API access from the e-invoice portal. Without them we can only build and validate the JSON. Get sandbox credentials before starting #96.
- **R-9 Employee personal data.** Aadhaar, PAN and bank details are sensitive. Aadhaar is encrypted at rest and masked in the UI and API, payroll is role-restricted, and backups are protected like the rest of the database.
- **R-10 Statutory rates drift.** PF/ESI/LWF rates, ceilings and minimum wages change (Haryana revises minimum wages twice a year). They are effective-dated data, and the CA checks them each April and October.

## 9. Open questions (to confirm with the owner / CA)

1. ~~Annual turnover above ₹5 crore?~~ **Decided:** assume it will cross ₹5 crore. E-invoicing and 6-digit HSN are built in, behind a company setting.
2. Is there job work in or out (material sent to/received from other units)? How often?
3. Is TDS/TCS deducted on any sales or purchases? (If turnover crosses ₹10 crore, TDS under section 194Q applies to large purchases.)
8. Does the CA already use a GSP (e.g. ClearTax, Masters India, IRIS) for e-invoicing, or should we apply for direct IRP API access?
9. Payroll: how many employees, how many on monthly salary vs daily wage?
10. Payroll: is the factory registered for PF and ESI? Any contract labour paid through a contractor? (That stays out of scope.)
11. Payroll: how is salary paid (bank transfer, cash or both), and on which day? Is overtime paid?
4. How many people will use it at once, and from where (office LAN only, or remote)?
5. Where will production run — a PC in the office, or a cloud VM?
6. Which Tally version, and can we get an XML export of masters?
7. Any existing invoice/challan print format that customers expect to see unchanged?
