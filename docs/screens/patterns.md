# Shared patterns

Five building blocks make up almost every screen. Changing one of them changes every module at once, so they
are the highest-leverage places for a redesign.

## 1. The list (register)

Used by every document type and every master. It has:

- **A title and actions** in one row: the main action ("New invoice") is the blue accent button on the right;
  secondary actions ("From quotations", "Receive against PO") sit beside it as grey buttons. People who can't
  write don't see them.
- **Filters** in one compact row: a search box (number or party name), a status picker and, on document lists, a
  From–To date range, with side labels. On a phone only the search shows; the rest sit behind a **Filters**
  button that counts the ones set. All of them live in the URL, so refresh, Back and shared links keep the view.
- **A compact table**: Number · Date · Party · (type-specific columns) · Status badge · Total. A whole row is a
  link to the document. Newest first. On a phone the rows become two-line cards: number and amount, then party,
  date and status, so nothing scrolls sideways.
- **A pager** under the table: "1–3 of 3", Previous, Next. 50 rows per page.
- **Empty states**: "No invoices in this financial year yet.", or "No invoices match. Try another search, status
  or dates." when filters are on.

## 2. The document form

One component draws every document type (quotation, order, challan, invoice, credit note, purchase order,
GRN). From top to bottom:

1. **A sticky header**: a back button to the list, the number under a small type label ("Invoice /
   INV/26-27/0001") with its status badge, and the actions on the right (see 8). It stays in view while the lines
   scroll.
2. **A note** when relevant: "Made from 1 pending line…", "This invoice is finalized, so it can't be edited.",
   "You can view invoices; ask an accountant or admin to change them.", or the cancellation reason.
3. **Header fields on a compact grid** (small fields; up to six across on a wide screen, one on a phone): the party
   picker (type part of a name, GSTIN or phone; each match shows its GSTIN and city) and Ship to take two columns;
   then the date, the due date with a type-specific label (Valid until, Delivery by, Payment due), the party's own
   reference no. and date (Customer PO, Supplier challan…), challan type or the credit note's reason, vehicle no.,
   transporter, e-way bill no. and reverse charge. An invoice's header fits in two rows.
5. **Line items** (see 3).
6. **Totals** on the right under the lines: taxable value, CGST + SGST or IGST, round off, and the **Total** in bold.
7. **Terms** and **Notes** side by side. Terms are printed; notes are internal.
8. **Actions** in the header, one accent button per screen: the next status move ("Mark as sent", "Finalize
   invoice", "Mark received") is the accent, else Save; then Print and the conversions ("Create sales order",
   "Create invoice", "Create credit note", "Receive goods") as grey buttons. Cancelling (a move to Cancelled, or an
   admin's "Cancel invoice…") lives in the **⋯ More actions** menu, away from the everyday buttons. There is no
   separate Cancel/Back button: the back arrow does that.
9. **Progress** on confirmed orders and sent POs: a small table of ordered / delivered (or received) / pending per
   item.

Anything past draft, or opened by someone who can't write it, renders as a **document**, not a locked form: a
panel with the party (name, GSTIN, city, address) beside the facts (date, due, references, ship to, transport),
the lines as plain text, the totals, and the terms and notes when there are any.

## 3. Line items

The densest part of the app, and where users spend most of their time. One row per line:

`#` · Item (searchable picker: code – name) · Description · HSN/SAC · Qty · Unit · Rate (₹) · Disc % · GST · Amount (₹) · remove

- Picking an item fills its HSN, unit, rate and GST rate.
- Typing qty, rate or discount updates the amount and the totals immediately, using the same code the server
  saves with.
- **Keyboard**: Enter moves to the next cell (as in Tally); Enter or Tab in the last cell adds a line.
- On a GRN the Qty column becomes **Accepted** and a **Rejected** column is added.
- Compact rows (small inputs); read-only documents show the lines as text.
- On a phone the table still scrolls sideways inside its box; phones are for looking things up and approving,
  with light entry (challans, GRNs).

## 4. Statuses

Every document moves through statuses shown as coloured badges: Draft (grey), Sent / Issued / Confirmed / Finalized
(blue or green), Accepted / Received (green), Rejected / Cancelled (red), Expired (yellow). Moves that can't be
undone ask first in a confirmation dialog. Cancelling a finalized invoice needs an admin and a reason, and the
number stays used.

## 5. Dialogs

Used for confirmations ("Mark invoice INV/26-27/0002 as finalized?"), cancellation with a reason, the ledger
editor, and the "make one document from several" pickers (pick a party, tick their open documents, then
continue).

## 6. Shape and depth

Rules for anything the app draws itself (panels, document sheets, dashboard tiles, cards). Primer's own
components keep their built-in look; we don't override their CSS.

- **Corners: 6 px** (`var(--borderRadius-medium)`) on every container, matching Primer's buttons and fields.
  Avatars stay round.
- **Depth comes from borders, not shadows.** Panels have a 1 px `--borderColor-default` border and a grey
  (`--bgColor-muted`) header row. A panel inside a panel drops the grey. Shadows are only for things that
  float (menus, dialogs), which Primer handles.
- **One primary button per screen**, usually Save or the next status move. Everything else is a default or
  invisible button, and rarer actions go in the "More actions" menu.
