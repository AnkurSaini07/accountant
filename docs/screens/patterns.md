# Shared patterns

Five building blocks make up almost every screen. Changing one of them changes every module at once, so they
are the highest-leverage places for a redesign.

## 1. The list (register)

Used by every document type and every master. It has:

- **A title and actions** in one row: the main action ("New invoice") is the blue accent button on the right;
  secondary actions ("From quotations", "Receive against PO") sit beside it as grey buttons. People who can't
  write don't see them.
- **Filters**: a search box (number or party name), a status picker and, on document lists, a From–To date
  range. All of them live in the URL, so refresh, Back and shared links keep the view.
- **A table**: Number · Date · Party · (type-specific columns) · Status badge · Total. A whole row is a link to the
  document. Newest first.
- **A pager** under the table: "1–3 of 3", Previous, Next. 50 rows per page.
- **Empty states**: "No invoices in this financial year yet.", or "No invoices match. Try another search, status
  or dates." when filters are on.

## 2. The document form

One component draws every document type (quotation, order, challan, invoice, credit note, purchase order,
GRN). From top to bottom:

1. **Title** with the number and a status badge: "Tax invoice INV/26-27/0001 [Finalized]", or "New tax invoice".
2. **A note** when relevant: "Made from 1 pending line…", "This invoice is finalized, so it can't be edited.",
   "You can view invoices; ask an accountant or admin to change them.", or the cancellation reason.
3. **Party and dates**: the party picker (type part of a name, GSTIN or phone; each match shows its GSTIN and city),
   the document date, and a due date with a type-specific label (Valid until, Delivery by, Payment due).
4. **Type-specific fields**: Ship to (decides CGST + SGST or IGST), challan type, vehicle no., transporter,
   e-way bill no., reverse charge, the party's own reference no. and date (Customer PO, Supplier challan…), or the
   credit note's reason.
5. **Line items** (see 3).
6. **Totals** on the right under the lines: taxable value, CGST + SGST or IGST, round off, and the **Total** in bold.
7. **Terms** and **Notes** text areas. Terms are printed; notes are internal.
8. **Buttons**: Save (accent), then the status moves ("Mark as sent", "Finalize invoice", "Mark received"), the
   conversions ("Create sales order", "Create invoice", "Create credit note", "Receive goods"), Print, Cancel, and
   Back to the list.
9. **Progress** on confirmed orders and sent POs: a small table of ordered / delivered (or received) / pending per
   item.

Anything past draft, or opened by someone who can't write it, renders **read-only**: the same fields, greyed and
locked, rather than a separate "view" layout.

## 3. Line items

The densest part of the app, and where users spend most of their time. One row per line:

`#` · Item (searchable picker: code – name) · Description · HSN/SAC · Qty · Unit · Rate (₹) · Disc % · GST · Amount (₹) · remove

- Picking an item fills its HSN, unit, rate and GST rate.
- Typing qty, rate or discount updates the amount and the totals immediately, using the same code the server
  saves with.
- **Keyboard**: Enter moves to the next cell (as in Tally); Enter or Tab in the last cell adds a line.
- On a GRN the Qty column becomes **Accepted** and a **Rejected** column is added.
- On a phone the table scrolls sideways inside its box, and only Item and the start of Description are visible
  at first (see the design brief).

## 4. Statuses

Every document moves through statuses shown as coloured badges: Draft (grey), Sent / Issued / Confirmed / Finalized
(blue or green), Accepted / Received (green), Rejected / Cancelled (red), Expired (yellow). Moves that can't be
undone ask first in a confirmation dialog. Cancelling a finalized invoice needs an admin and a reason, and the
number stays used.

## 5. Dialogs

Used for confirmations ("Mark invoice INV/26-27/0002 as finalized?"), cancellation with a reason, the ledger
editor, and the "make one document from several" pickers (pick a party, tick their open documents, then
continue).
