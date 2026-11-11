# Masters

The records every document draws on: **parties** (customers and suppliers), **items** (what the factory buys and
sells) and **ledgers** (the chart of accounts). Admins and accountants edit them; operators and viewers see them
read-only. Nothing is ever deleted: a record is **deactivated** and disappears from pickers, but old documents
keep it.

## Parties

**Masters → Parties.** Customers and suppliers in one list, with GSTIN, city and phone. Search by name,
GSTIN or phone; filter to customers or suppliers; "Show inactive" brings deactivated ones back.

*Desktop · 1280 px · light*

[![parties, desktop, light](./img/parties-desktop-light.webp)](./img/parties-desktop-light.webp)

*Desktop · 1280 px · dark*

[![parties, desktop, dark](./img/parties-desktop-dark.webp)](./img/parties-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![parties, phone, light](./img/parties-phone-light.webp)](./img/parties-phone-light.webp) | [![parties, phone, dark](./img/parties-phone-dark.webp)](./img/parties-phone-dark.webp) |

### New party

One long form in sections:

- **Basics**: name, type, GST registration (regular, composition, unregistered, consumer, overseas, SEZ). A valid
  **GSTIN** fills in the state and PAN; the line under it confirms ("Haryana. State and PAN come from the GSTIN.").
- **Contact**: contact person, phone, email.
- **Credit and opening balance**: credit days, credit limit, opening balance with **Dr: they owe us** or **Cr: we owe them**.
- **Addresses**: one billing address (printed on invoices) and any number of shipping addresses. A shipping
  address's state decides the place of supply for goods sent there.

*Desktop · 1280 px · light*

[![party new, desktop, light](./img/party-new-desktop-light.webp)](./img/party-new-desktop-light.webp)

*Desktop · 1280 px · dark*

[![party new, desktop, dark](./img/party-new-desktop-dark.webp)](./img/party-new-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![party new, phone, light](./img/party-new-phone-light.webp)](./img/party-new-phone-light.webp) | [![party new, phone, dark](./img/party-new-phone-dark.webp)](./img/party-new-phone-dark.webp) |

Pressing **Save** with required fields missing marks each field in red with its message, and focus moves to the
first one:

*Desktop · 1280 px · light*

[![party errors, desktop, light](./img/party-errors-desktop-light.webp)](./img/party-errors-desktop-light.webp)

*Desktop · 1280 px · dark*

[![party errors, desktop, dark](./img/party-errors-desktop-dark.webp)](./img/party-errors-desktop-dark.webp)

### Editing a party

The same form, filled in, with **Deactivate** beside Save. Here Acme Castings has a second plant as a shipping address.

*Desktop · 1280 px · light*

[![party edit, desktop, light](./img/party-edit-desktop-light.webp)](./img/party-edit-desktop-light.webp)

*Desktop · 1280 px · dark*

[![party edit, desktop, dark](./img/party-edit-desktop-dark.webp)](./img/party-edit-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![party edit, phone, light](./img/party-edit-phone-light.webp)](./img/party-edit-phone-light.webp) | [![party edit, phone, dark](./img/party-edit-phone-dark.webp)](./img/party-edit-phone-dark.webp) |

## Items

**Masters → Items.** Code, name, type (Raw material, Semi-finished, Finished good, Service), HSN/SAC, unit,
GST and sale price. Search by code, name or HSN; filter by type.

*Desktop · 1280 px · light*

[![items, desktop, light](./img/items-desktop-light.webp)](./img/items-desktop-light.webp)

*Desktop · 1280 px · dark*

[![items, desktop, dark](./img/items-desktop-dark.webp)](./img/items-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![items, phone, light](./img/items-phone-light.webp)](./img/items-phone-light.webp) | [![items, phone, dark](./img/items-phone-dark.webp)](./img/items-phone-dark.webp) |

### Item form

Code (the factory's own, e.g. FG-101), name, description (printed under the name), type, HSN (4, 6 or 8 digits),
unit and GST rate; then **Prices** (sale and purchase, per unit); then **Stock** (opening quantity and value,
reorder level). Services have no stock section. Quantities are typed in the unit (1.250 KGS).

*Desktop · 1280 px · light*

[![item edit, desktop, light](./img/item-edit-desktop-light.webp)](./img/item-edit-desktop-light.webp)

*Desktop · 1280 px · dark*

[![item edit, desktop, dark](./img/item-edit-desktop-dark.webp)](./img/item-edit-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![item edit, phone, light](./img/item-edit-phone-light.webp)](./img/item-edit-phone-light.webp) | [![item edit, phone, dark](./img/item-edit-phone-dark.webp)](./img/item-edit-phone-dark.webp) |

## Ledgers

**Masters → Ledgers.** Every ledger with its group (Bank Accounts, Duties & Taxes, Indirect Expenses…). Ledgers the
system needs (Cash, Sales, Purchase, Output CGST / SGST / IGST, Round Off…) carry a **System** badge and can't be
renamed or deleted. Party ledgers follow their party and are edited there.

*Desktop · 1280 px · light*

[![ledgers, desktop, light](./img/ledgers-desktop-light.webp)](./img/ledgers-desktop-light.webp)

*Desktop · 1280 px · dark*

[![ledgers, desktop, dark](./img/ledgers-desktop-dark.webp)](./img/ledgers-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![ledgers, phone, light](./img/ledgers-phone-light.webp)](./img/ledgers-phone-light.webp) | [![ledgers, phone, dark](./img/ledgers-phone-dark.webp)](./img/ledgers-phone-dark.webp) |

### New / edit ledger

A small dialog: name and group. The group picker shows the chart of accounts as a tree, with a section per
primary group.

*Desktop · 1280 px · light*

[![ledger dialog, desktop, light](./img/ledger-dialog-desktop-light.webp)](./img/ledger-dialog-desktop-light.webp)

*Desktop · 1280 px · dark*

[![ledger dialog, desktop, dark](./img/ledger-dialog-desktop-dark.webp)](./img/ledger-dialog-desktop-dark.webp)

| Phone · 390 px · light | Phone · 390 px · dark |
|---|---|
| [![ledger dialog, phone, light](./img/ledger-dialog-phone-light.webp)](./img/ledger-dialog-phone-light.webp) | [![ledger dialog, phone, dark](./img/ledger-dialog-phone-dark.webp)](./img/ledger-dialog-phone-dark.webp) |
