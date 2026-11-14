# Screens

This section documents every screen built so far in **Accountant**, a GST-ready replacement for Tally for a
fasteners factory in Faridabad. It is written for anyone reviewing the UI, including a design reviewer who has
never seen the app. Each page describes what the screen is for, who uses it, what's on it, how it behaves, and
then shows it in light and dark, desktop and phone.

All data in the screenshots is **fictional** (Northwind Fasteners, Acme Castings, made-up GSTINs and numbers).

| Page | Screens |
|---|---|
| [App shell](./shell.md) | Sign-in, header, side navigation, dashboard, page not found |
| [Masters](./masters.md) | Parties, items, ledgers |
| [Settings](./settings.md) | Company profile, document numbering |
| [Sales](./sales.md) | Quotations, sales orders, delivery challans, tax invoices, credit notes |
| [Purchase](./purchase.md) | Purchase orders, goods receipts (GRNs) |
| [Print sheets](./print.md) | A4 quotation, challan, invoice, credit note and purchase order |
| [Shared patterns](./patterns.md) | The list, document form, line items, statuses and dialogs every module reuses |
| [Screen catalogue](./screen-catalogue.md) | Every screen to design, built and planned, with its content and states |
| [Design review brief](./design-brief.md) | Constraints, known problems and the questions we want answered |

## Who uses it

| Role | Who | Can |
|---|---|---|
| Admin | The owner | Everything, including cancelling finalized invoices and editing company settings |
| Accountant | Office staff | Create and edit all documents and masters |
| Operator | Floor / stores staff | Record delivery challans and goods receipts; view the rest |
| Viewer | Auditor, CA | Read everything, change nothing |

Most work happens on **desktop PCs in the factory office** (1280–1920 px wide, often older monitors). The
owner also checks things on a **phone**. Users know Tally well: they expect dense screens, keyboard entry and
Indian number formats (₹1,33,576.00, dd/mm/yyyy).

## How the screenshots are made

`scripts/docs/shots.ts` seeds the fictional data into a fresh test server, opens every screen as the right role,
and saves WebP files in `docs/screens/img/` named `<screen>-<desktop|phone>-<light|dark>.webp`. Desktop is
1280 px wide at 1×; phone is 390 px at 2×. Full-page captures grow the window to the whole page, so long forms
appear in one image. To refresh them after a UI change:

```sh
PORT=3100 bun scripts/e2e-server.ts   # in one terminal: a fresh database
bun run docs:shots                     # in another
```
