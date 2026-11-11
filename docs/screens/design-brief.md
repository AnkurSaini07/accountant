# Design review brief

The owner doesn't like how the app looks and feels today, and wants an outside design review before more screens
are built on the same patterns. This page gives a reviewer what they need: what can change, what can't, what
we already see wrong, and the questions we want answered.

## What we want back

1. **A critique** of the current UI: what hurts the most for these users, worst first, naming the screenshots
   (e.g. `invoice-draft-desktop-light`).
2. **A direction**: layout, density, typography, colour and component choices, with the reasoning.
3. **Concrete redesigns** of the [shared patterns](./patterns.md) first (list, document form, line items, action
   buttons, read-only state), since every module reuses them; then any screen that needs its own treatment.
4. **Phone**: what the phone experience should be (full editing, or looking things up and approving?).

## The users and their context

- Office staff who used **Tally** for years: fast, keyboard-driven, dense, with almost no mouse. They judge a screen by
  how quickly they can enter a 20-line invoice.
- The owner: checks documents and numbers, often on a phone.
- Floor and stores staff: record challans and goods receipts, less comfortable with software.
- Office PCs are 1280–1920 px wide, sometimes older, sometimes with slow internet.
- Language is English, with Indian conventions: ₹ with lakh/crore grouping (₹1,33,576.00), dd/mm/yyyy dates, GST terms
  (GSTIN, HSN, CGST/SGST/IGST, e-way bill) that users know well.

## Constraints

| Area | Today | Can it change? |
|---|---|---|
| Component library | **React Spectrum S2** (Adobe's design system), styled only through its `style()` macro and tokens. See `docs/adr/0001-ui-library.md`. | Yes, with a reason. Theming within S2 (tokens, density, layout) is cheap; replacing it is a large job, so say if the problems really need that. |
| Fonts | Adobe Clean, loaded from Adobe Fonts | Yes |
| Colour schemes | Light and dark, following the OS | Yes |
| Accessibility | Every control has a label and works by keyboard; tests find elements by role and label | Must stay |
| Keyboard flow in line items | Enter moves to the next cell, as in Tally | Must stay; it can get better |
| Print sheets | Plain HTML, black on white, A4 | The layout can change; the GST fields on them can't be removed |
| Document structure | The fields and statuses come from GST law and the requirements (`docs/REQUIREMENTS.md`) | Labels, grouping and order can change; the data can't |

## Problems we already see

From the screenshots in these pages; a reviewer will find more.

1. **Phone tables are cut off.** Line items show only Item and the start of Description
   (`quotation-draft-phone-dark`); lists show Number and Date, with Party cut off (`invoices-phone-light`). Both scroll
   sideways inside the box, which is easy to miss.
2. **Desktop forms are one narrow column.** Every field is full-width in a ~720 px column on a 1280 px screen, so the
   right half stays empty and forms are very tall: the party form is about 2,300 px (`party-edit-desktop-light`),
   and the item form needs a scroll for nine fields.
3. **Low density for Tally users.** A three-line invoice already needs scrolling; on the phone the header alone takes
   three lines (company name, financial year, user) before any content.
4. **Action buttons all look alike.** On a finalized invoice, "Cancel invoice" (destructive, admin only), "Create
   credit note", "Print" and "Back to invoices" are identical grey pills (`invoice-finalized-desktop-light`).
   "Cancel" means both "discard my edits" (on a new document) and "cancel this document".
5. **Read-only documents look disabled.** A finalized invoice is the same form with greyed, locked inputs, instead
   of something that reads like a document.
6. **Repeated titles**: "GRN GRN/26-27/0001", "Quotation QTN/26-27/0001". On the phone the title wraps over two
   or three very large lines.
7. **Weak navigation hierarchy.** The section sub-navigation is a row of small blue text links that looks like body
   links rather than tabs; on the phone it wraps ("Credit / notes").
8. **Status colours are inconsistent.** Blue means Sent, Issued and Confirmed, while green means both Accepted and
   Finalized, so the same stage gets different colours on different documents.
9. **Filters take the first screen on a phone.** Search, status and two dates stack before the first row.
10. **The dashboard is empty** ("Coming soon"), so the first screen after sign-in says nothing.
11. **Numbering repeats its column labels** on every row (`numbering-desktop-light`).
12. **The sign-in page is bare**: no product name, logo or company.

## Questions

- What density and layout suit Tally-trained data-entry staff without looking dated?
- Should a document's header (party, dates, references) be a compact grid or panel instead of stacked fields?
- How should a read-only document look: a "paper" preview with actions, or the form with values as text?
- Where should the actions live (a sticky toolbar, a header row, a menu for secondary actions), and how should
  destructive ones be set apart?
- Should line items stay a table on the phone, become cards, or be view-only there?
- Is S2 the right base, or does the direction need a different library? What would we lose?

## Reading the screenshots

Every screen is shown at **desktop 1280 px** and **phone 390 px**, each in **light** and **dark**. Some states
(dialogs, errors, other roles) are shown on desktop only, and print sheets in light only. Full-page captures show the
whole scrolling page in one image. Files are in `docs/screens/img/`, named `<screen>-<device>-<scheme>.webp`.
