# Sales

The selling chain, in the order the factory works:

**Quotation → Sales order → Delivery challan → Tax invoice → Credit note**

Every step can start fresh or from the step before it, taking whatever is still **pending**: an order from a
quotation takes what hasn't been ordered yet, a challan takes what hasn't been delivered, and so on. All five use the
[shared list and document form](./patterns.md).

## Quotations

**Sales → Quotations.** Draft → Sent → Accepted / Rejected / Expired. A sent or accepted quotation can become a
sales order.

*Desktop · 1280 px · light*

[![quotations, desktop, light](./img/quotations-desktop-light.webp)](./img/quotations-desktop-light.webp)

*Desktop · 1280 px · dark*

[![quotations, desktop, dark](./img/quotations-desktop-dark.webp)](./img/quotations-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![quotations, phone, light](./img/quotations-phone-light.webp)](./img/quotations-phone-light.webp) | [![quotations, phone, dark](./img/quotations-phone-dark.webp)](./img/quotations-phone-dark.webp) |

### New quotation

Customer, date, **Valid until**, the lines, live totals, terms (prefilled from the company's) and notes.

*Desktop · 1280 px · light*

[![quotation new, desktop, light](./img/quotation-new-desktop-light.webp)](./img/quotation-new-desktop-light.webp)

*Desktop · 1280 px · dark*

[![quotation new, desktop, dark](./img/quotation-new-desktop-dark.webp)](./img/quotation-new-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![quotation new, phone, light](./img/quotation-new-phone-light.webp)](./img/quotation-new-phone-light.webp) | [![quotation new, phone, dark](./img/quotation-new-phone-dark.webp)](./img/quotation-new-phone-dark.webp) |

Saving an empty one shows each problem on its field: the customer, and each line's item and quantity:

*Desktop · 1280 px · light*

[![quotation errors, desktop, light](./img/quotation-errors-desktop-light.webp)](./img/quotation-errors-desktop-light.webp)

*Desktop · 1280 px · dark*

[![quotation errors, desktop, dark](./img/quotation-errors-desktop-dark.webp)](./img/quotation-errors-desktop-dark.webp)

### A draft quotation

Editable. The buttons: Save, **Mark as sent**, Print, Cancel. A 5% discount on line 2 shows in Disc %.

*Desktop · 1280 px · light*

[![quotation draft, desktop, light](./img/quotation-draft-desktop-light.webp)](./img/quotation-draft-desktop-light.webp)

*Desktop · 1280 px · dark*

[![quotation draft, desktop, dark](./img/quotation-draft-desktop-dark.webp)](./img/quotation-draft-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![quotation draft, phone, light](./img/quotation-draft-phone-light.webp)](./img/quotation-draft-phone-light.webp) | [![quotation draft, phone, dark](./img/quotation-draft-phone-dark.webp)](./img/quotation-draft-phone-dark.webp) |

### A sent quotation

Read-only ("This quotation is sent, so it can't be edited."). It offers **Create sales order**, and the
moves **Accepted**, **Rejected** and **Expired**.

*Desktop · 1280 px · light*

[![quotation sent, desktop, light](./img/quotation-sent-desktop-light.webp)](./img/quotation-sent-desktop-light.webp)

*Desktop · 1280 px · dark*

[![quotation sent, desktop, dark](./img/quotation-sent-desktop-dark.webp)](./img/quotation-sent-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![quotation sent, phone, light](./img/quotation-sent-phone-light.webp)](./img/quotation-sent-phone-light.webp) | [![quotation sent, phone, dark](./img/quotation-sent-phone-dark.webp)](./img/quotation-sent-phone-dark.webp) |

## Sales orders

**Sales → Orders.** Each row shows the **customer's PO no.** and a **Delivery** column (how much has gone out:
none, partly or fully). Draft → Confirmed (**Confirm order**) → Cancelled. **From quotations** makes one order from several of a customer's quotations.

*Desktop · 1280 px · light*

[![orders, desktop, light](./img/orders-desktop-light.webp)](./img/orders-desktop-light.webp)

*Desktop · 1280 px · dark*

[![orders, desktop, dark](./img/orders-desktop-dark.webp)](./img/orders-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![orders, phone, light](./img/orders-phone-light.webp)](./img/orders-phone-light.webp) | [![orders, phone, dark](./img/orders-phone-dark.webp)](./img/orders-phone-dark.webp) |

### From quotations

Pick the customer; their sent or accepted quotations with something left to order appear as checkboxes; tick any
and **Create order**.

*Desktop · 1280 px · light*

[![order from quotations, desktop, light](./img/order-from-quotations-desktop-light.webp)](./img/order-from-quotations-desktop-light.webp)

*Desktop · 1280 px · dark*

[![order from quotations, desktop, dark](./img/order-from-quotations-desktop-dark.webp)](./img/order-from-quotations-desktop-dark.webp)

### A confirmed order

Read-only, with **Delivered so far**: ordered, delivered and pending per item. Here 5000 of 8000 bolts have gone.
It offers **Create challan** and **Create invoice**.

*Desktop · 1280 px · light*

[![order confirmed, desktop, light](./img/order-confirmed-desktop-light.webp)](./img/order-confirmed-desktop-light.webp)

*Desktop · 1280 px · dark*

[![order confirmed, desktop, dark](./img/order-confirmed-desktop-dark.webp)](./img/order-confirmed-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![order confirmed, phone, light](./img/order-confirmed-phone-light.webp)](./img/order-confirmed-phone-light.webp) | [![order confirmed, phone, dark](./img/order-confirmed-phone-dark.webp)](./img/order-confirmed-phone-dark.webp) |

## Delivery challans

**Sales → Challans.** Goods leaving the factory. Four types: **Sale**, **Job work** (sent out, e.g. for
plating, to come back), **Supply on approval** and **Returnable**. The list shows the type and vehicle no. Operators can make challans. Draft → Issued → Cancelled.

*Desktop · 1280 px · light*

[![challans, desktop, light](./img/challans-desktop-light.webp)](./img/challans-desktop-light.webp)

*Desktop · 1280 px · dark*

[![challans, desktop, dark](./img/challans-desktop-dark.webp)](./img/challans-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![challans, phone, light](./img/challans-phone-light.webp)](./img/challans-phone-light.webp) | [![challans, phone, dark](./img/challans-phone-dark.webp)](./img/challans-phone-dark.webp) |

### An issued challan

Delta's 10,000 bolts going to New Delhi by road: vehicle no., transporter and e-way bill no. Because the place of
supply (Delhi, 07) differs from the factory's state (Haryana, 06), the tax is **IGST**.

*Desktop · 1280 px · light*

[![challan issued, desktop, light](./img/challan-issued-desktop-light.webp)](./img/challan-issued-desktop-light.webp)

*Desktop · 1280 px · dark*

[![challan issued, desktop, dark](./img/challan-issued-desktop-dark.webp)](./img/challan-issued-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![challan issued, phone, light](./img/challan-issued-phone-light.webp)](./img/challan-issued-phone-light.webp) | [![challan issued, phone, dark](./img/challan-issued-phone-dark.webp)](./img/challan-issued-phone-dark.webp) |

## Tax invoices

**Sales → Invoices.** Status, party search and date-range filters. The list shows the customer PO and **Payment due**.

*Desktop · 1280 px · light*

[![invoices, desktop, light](./img/invoices-desktop-light.webp)](./img/invoices-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoices, desktop, dark](./img/invoices-desktop-dark.webp)](./img/invoices-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![invoices, phone, light](./img/invoices-phone-light.webp)](./img/invoices-phone-light.webp) | [![invoices, phone, dark](./img/invoices-phone-dark.webp)](./img/invoices-phone-dark.webp) |

### A draft invoice

Made from Delta's challan. **Ship to** decides the tax: switching it between a Haryana and a Delhi address flips
the totals between CGST + SGST and IGST as you watch. Also: reverse charge, transport and e-way bill.

*Desktop · 1280 px · light*

[![invoice draft, desktop, light](./img/invoice-draft-desktop-light.webp)](./img/invoice-draft-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoice draft, desktop, dark](./img/invoice-draft-desktop-dark.webp)](./img/invoice-draft-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![invoice draft, phone, light](./img/invoice-draft-phone-light.webp)](./img/invoice-draft-phone-light.webp) | [![invoice draft, phone, dark](./img/invoice-draft-phone-dark.webp)](./img/invoice-draft-phone-dark.webp) |

**Finalize invoice** asks first, because it locks the invoice:

*Desktop · 1280 px · light*

[![invoice finalize confirm, desktop, light](./img/invoice-finalize-confirm-desktop-light.webp)](./img/invoice-finalize-confirm-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoice finalize confirm, desktop, dark](./img/invoice-finalize-confirm-desktop-dark.webp)](./img/invoice-finalize-confirm-desktop-dark.webp)

### A finalized invoice

Locked. It offers **Create credit note**, **Print**, and for admins **Cancel invoice**.

*Desktop · 1280 px · light*

[![invoice finalized, desktop, light](./img/invoice-finalized-desktop-light.webp)](./img/invoice-finalized-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoice finalized, desktop, dark](./img/invoice-finalized-desktop-dark.webp)](./img/invoice-finalized-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![invoice finalized, phone, light](./img/invoice-finalized-phone-light.webp)](./img/invoice-finalized-phone-light.webp) | [![invoice finalized, phone, dark](./img/invoice-finalized-phone-dark.webp)](./img/invoice-finalized-phone-dark.webp) |

Cancelling needs a reason, and the invoice number stays used:

*Desktop · 1280 px · light*

[![invoice cancel dialog, desktop, light](./img/invoice-cancel-dialog-desktop-light.webp)](./img/invoice-cancel-dialog-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoice cancel dialog, desktop, dark](./img/invoice-cancel-dialog-desktop-dark.webp)](./img/invoice-cancel-dialog-desktop-dark.webp)

### A cancelled invoice

The status badge turns red and a note says when and why: "Cancelled on 11 Nov 2026: Raised twice by mistake.
Its number stays used."

*Desktop · 1280 px · light*

[![invoice cancelled, desktop, light](./img/invoice-cancelled-desktop-light.webp)](./img/invoice-cancelled-desktop-light.webp)

*Desktop · 1280 px · dark*

[![invoice cancelled, desktop, dark](./img/invoice-cancelled-desktop-dark.webp)](./img/invoice-cancelled-desktop-dark.webp)

### What a viewer sees

The same screen, read-only, with "You can view invoices; ask an accountant or admin to change them." and no
action buttons.

*Desktop · 1280 px · light*

[![invoice viewer, desktop, light](./img/invoice-viewer-desktop-light.webp)](./img/invoice-viewer-desktop-light.webp)

## Credit notes

**Sales → Credit notes.** Made only from a finalized invoice (its **Create credit note** button), so this list has
no New button. Each shows its reason and the invoice it's against.

*Desktop · 1280 px · light*

[![credit notes, desktop, light](./img/credit-notes-desktop-light.webp)](./img/credit-notes-desktop-light.webp)

*Desktop · 1280 px · dark*

[![credit notes, desktop, dark](./img/credit-notes-desktop-dark.webp)](./img/credit-notes-desktop-dark.webp)

### Goods returned

300 of Acme's 5000 bolts came back with thread damage. The note takes the invoice's line and the returned qty;
the server refuses more than the invoice has left to credit.

*Desktop · 1280 px · light*

[![credit note return, desktop, light](./img/credit-note-return-desktop-light.webp)](./img/credit-note-return-desktop-light.webp)

*Desktop · 1280 px · dark*

[![credit note return, desktop, dark](./img/credit-note-return-desktop-dark.webp)](./img/credit-note-return-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![credit note return, phone, light](./img/credit-note-return-phone-light.webp)](./img/credit-note-return-phone-light.webp) | [![credit note return, phone, dark](./img/credit-note-return-phone-dark.webp)](./img/credit-note-return-phone-dark.webp) |

### A rate difference

The flanges were billed at ₹845 but the agreed rate was ₹820: the note credits ₹25 per plate on the same qty.

*Desktop · 1280 px · light*

[![credit note rate, desktop, light](./img/credit-note-rate-desktop-light.webp)](./img/credit-note-rate-desktop-light.webp)

*Desktop · 1280 px · dark*

[![credit note rate, desktop, dark](./img/credit-note-rate-desktop-dark.webp)](./img/credit-note-rate-desktop-dark.webp)
