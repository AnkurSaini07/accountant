// A4 print of any document (FR-6.1): letterhead with logo, bill-to and ship-to, document details,
// lines, totals with the amount in words, HSN/SAC tax summary, bank details, terms and signature.
// Plain HTML and print.css (black on white, no theme), so the browser's "Save as PDF" gives a
// clean PDF. Long documents run over several pages; the lines' header row repeats on each.
// Rendered on its own route, outside the app layout, so there is no app chrome to print.
import type { InferResponseType } from "hono/client";
import type { ReactNode } from "react";
import { formatRupees } from "../../shared/money.ts";
import { formatQty } from "../../shared/quantity.ts";
import { stateByCode } from "../../shared/states.ts";
import { amountInWords } from "../../shared/words.ts";
import type { client } from "../api.ts";
import type { Company } from "../pages/settings/Company.tsx";
import { HsnSummary } from "./HsnSummary.tsx";
import "./print.css";

/** What GET /api/<documents>/:id returns (documents/get.sql), for every document type. */
export type PrintDocument = InferResponseType<(typeof client.api.quotations)[":id"]["$get"], 200>;
type Address = NonNullable<PrintDocument["billing_address"]>;

type Props = {
  doc: PrintDocument;
  company: Company;
  title: string; // "Quotation", "Tax Invoice"…
  copy?: string; // "Original for Recipient"…
  dueLabel?: string; // what due_date means here: "Valid until", "Due date"…
  refLabel?: string; // what party_ref means here: "Your enquiry", "Supplier invoice no."…
  refDateLabel?: string; // its date on a row of its own ("Invoice date") instead of "… dt. <date>"
  partyLabel?: string; // "Bill to" (sales) / "Supplier" (purchases) / "Consignee" (challans)
  toolbar?: ReactNode; // Print / Back buttons on screen; never printed
};

const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const stateLine = (code: string) => `${stateByCode(code)?.name ?? ""} (${code})`;
const addressLines = (a: Address | null) => (a ? [a.address, [a.city, a.pincode].filter(Boolean).join(" – ")].filter(Boolean) : []);

export function DocumentPrint({ doc, company, title, copy, dueLabel = "Due date", refLabel = "Reference", refDateLabel, partyLabel = "Bill to", toolbar }: Props) {
  const office = company.addresses.find((a) => a.is_primary) ?? company.addresses[0];
  const bank = company.bank_accounts.find((b) => b.is_default) ?? company.bank_accounts[0];
  const inter = doc.igst_total > 0;
  const sgstLabel = !inter && stateByCode(doc.place_of_supply)?.utgst ? "UTGST" : "SGST";
  const shipTo = doc.shipping_address ?? doc.billing_address;
  const details: [string, string][] = [
    [`${title} no.`, doc.number ?? "Draft"],
    ["Date", date(doc.date)],
    ...(doc.due_date ? [[dueLabel, date(doc.due_date)] as [string, string]] : []),
    ...(doc.party_ref ? [[refLabel, doc.party_ref + (doc.party_ref_date && !refDateLabel ? ` dt. ${date(doc.party_ref_date)}` : "")] as [string, string]] : []),
    ...(doc.party_ref_date && refDateLabel ? [[refDateLabel, date(doc.party_ref_date)] as [string, string]] : []),
    ["Place of supply", stateLine(doc.place_of_supply)],
    ...(doc.vehicle_no ? [["Vehicle no.", doc.vehicle_no] as [string, string]] : []),
    ...(doc.transporter ? [["Transporter", doc.transporter] as [string, string]] : []),
    ...(doc.eway_bill_no ? [["E-way bill no.", doc.eway_bill_no] as [string, string]] : []),
    // Rule 46(p): an invoice always says whether reverse charge applies; others only when it does.
    ...(doc.reverse_charge || doc.type === "invoice" ? [["Reverse charge", doc.reverse_charge ? "Yes" : "No"] as [string, string]] : []),
  ];

  return (
    <div className="dp-page">
      {toolbar && <div className="dp-toolbar">{toolbar}</div>}
      <article className="dp-sheet" aria-label={`${title} ${doc.number ?? "draft"}`}>
        <header className="dp-letterhead">
          {company.logo && <img className="dp-logo" src={company.logo} alt={`${company.legal_name} logo`} />}
          <div className="dp-company">
            <h1>{company.trade_name || company.legal_name}</h1>
            {company.trade_name && <p>{company.legal_name}</p>}
            {office && <p>{[office.address, office.city, office.pincode].filter(Boolean).join(", ")}</p>}
            <p>{stateLine(company.state_code)}</p>
            <p>{[company.gstin && `GSTIN ${company.gstin}`, company.pan && `PAN ${company.pan}`].filter(Boolean).join(" · ")}</p>
            <p>{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="dp-title">
            <h2>{title}</h2>
            {copy && <p>{copy}</p>}
            {doc.status === "draft" && <p className="dp-draft">Draft – not issued</p>}
            {doc.status === "cancelled" && <p className="dp-draft">Cancelled – not valid</p>}
          </div>
        </header>

        <section className="dp-parties">
          <div aria-label={partyLabel}>
            <h3>{partyLabel}</h3>
            <p className="dp-strong">{doc.party_name}</p>
            {addressLines(doc.billing_address).map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p>{stateLine(doc.party_state_code)}</p>
            <p>{doc.party_gstin ? `GSTIN ${doc.party_gstin}` : "Unregistered"}</p>
          </div>
          <div aria-label="Ship to">
            <h3>Ship to</h3>
            <p className="dp-strong">{doc.party_name}</p>
            {addressLines(shipTo).map((l) => (
              <p key={l}>{l}</p>
            ))}
            {shipTo?.state_code && <p>{stateLine(shipTo.state_code)}</p>}
          </div>
          <dl className="dp-details" aria-label="Details">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <table className="dp-table dp-lines" aria-label="Lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>HSN/SAC</th>
              <th className="dp-num">Qty</th>
              <th>Unit</th>
              <th className="dp-num">Rate</th>
              <th className="dp-num">Disc %</th>
              <th className="dp-num">GST %</th>
              <th className="dp-num">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.position}</td>
                <td>
                  {l.item_name}
                  {l.description && <div className="dp-muted">{l.description}</div>}
                </td>
                <td>{l.hsn ?? ""}</td>
                <td className="dp-num">{formatQty(l.qty, l.unit_decimals)}</td>
                <td>{l.unit}</td>
                <td className="dp-num">{formatRupees(l.rate)}</td>
                <td className="dp-num">{l.discount_bp ? l.discount_bp / 100 : ""}</td>
                <td className="dp-num">{Number(l.gst_rate)}</td>
                <td className="dp-num">{formatRupees(l.taxable)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="dp-sums">
          <div className="dp-words">
            <h3>Amount in words</h3>
            <p>{amountInWords(doc.grand_total)}</p>
          </div>
          <dl className="dp-totals" aria-label="Totals">
            <dt>Taxable value</dt>
            <dd>{formatRupees(doc.taxable_total)}</dd>
            {inter ? (
              <>
                <dt>IGST</dt>
                <dd>{formatRupees(doc.igst_total)}</dd>
              </>
            ) : (
              <>
                <dt>CGST</dt>
                <dd>{formatRupees(doc.cgst_total)}</dd>
                <dt>{sgstLabel}</dt>
                <dd>{formatRupees(doc.sgst_total)}</dd>
              </>
            )}
            {doc.round_off !== 0 && (
              <>
                <dt>Round off</dt>
                <dd>{formatRupees(doc.round_off)}</dd>
              </>
            )}
            <dt className="dp-grand">Total</dt>
            <dd className="dp-grand">{formatRupees(doc.grand_total, { symbol: true })}</dd>
          </dl>
        </section>

        <HsnSummary lines={doc.lines} sgstLabel={sgstLabel} />

        <footer className="dp-footer">
          <div>
            {bank && (
              <section aria-label="Bank details">
                <h3>Bank details</h3>
                <p>{bank.account_name || company.legal_name}</p>
                <p>
                  {bank.bank_name}
                  {bank.branch ? `, ${bank.branch}` : ""}
                </p>
                <p>A/c {bank.account_number} · IFSC {bank.ifsc}</p>
              </section>
            )}
            {(doc.terms || company.terms) && (
              <section aria-label="Terms">
                <h3>Terms</h3>
                <p className="dp-pre">{doc.terms || company.terms}</p>
              </section>
            )}
            {doc.notes && (
              <section aria-label="Notes">
                <h3>Notes</h3>
                <p className="dp-pre">{doc.notes}</p>
              </section>
            )}
          </div>
          <div className="dp-sign">
            <p>For {company.legal_name}</p>
            {company.signature ? <img src={company.signature} alt="Signature" /> : <div className="dp-sign-space" />}
            <p>Authorised Signatory</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
