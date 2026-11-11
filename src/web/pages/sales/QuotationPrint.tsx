// /print/quotations/:id: the quotation on an A4 sheet (DocumentPrint), outside the app layout.
// Print or "Save as PDF" from the toolbar; the PDF's file name comes from the page title.
import { Button } from "@react-spectrum/s2/Button";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { call, client } from "../../api.ts";
import { DocumentPrint, type PrintDocument } from "../../print/DocumentPrint.tsx";
import { companyAtom } from "../../state.ts";

export function QuotationPrint() {
  const { id = "" } = useParams();
  const company = useAtomValue(companyAtom);
  const [doc, setDoc] = useState<PrintDocument | null | "missing">(null);
  useEffect(() => {
    call(client.api.quotations[":id"].$get({ param: { id } })).then(setDoc, () => setDoc("missing")); // failures toast
  }, [id]);
  useEffect(() => {
    if (!doc || doc === "missing") return;
    const before = document.title;
    document.title = `Quotation ${doc.number ?? "draft"} – ${doc.party_name}`;
    return () => {
      document.title = before;
    };
  }, [doc]);

  const back = <LinkButton href={`/sales/quotations/${id}`} variant="secondary">Back to quotation</LinkButton>;
  if (doc === "missing") return <p>This quotation couldn't be loaded. {back}</p>;
  if (!doc || !company) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  return (
    <DocumentPrint
      doc={doc}
      company={company}
      title="Quotation"
      dueLabel="Valid until"
      refLabel="Your enquiry"
      toolbar={
        <>
          <Button variant="accent" onPress={() => window.print()}>
            Print or save as PDF
          </Button>
          {back}
        </>
      }
    />
  );
}
