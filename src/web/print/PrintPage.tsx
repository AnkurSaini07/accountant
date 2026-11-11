// /print/<documents>/:id: one document on an A4 sheet (DocumentPrint), outside the app layout.
// Print or "Save as PDF" from the toolbar; the PDF's file name comes from the page title. Documents
// issued in copies (challans, invoices) pick which copy the sheet says it is.
import { Button } from "@react-spectrum/s2/Button";
import { LinkButton } from "@react-spectrum/s2/LinkButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useAtomValue } from "jotai";
import { type ComponentProps, useEffect, useState } from "react";
import { useParams } from "react-router";
import { companyAtom } from "../state.ts";
import { DocumentPrint, type PrintDocument } from "./DocumentPrint.tsx";

type Props = Omit<ComponentProps<typeof DocumentPrint>, "doc" | "company" | "toolbar" | "title" | "copy"> & {
  load: (id: string) => Promise<PrintDocument>;
  label: string; // "quotation": the page title and messages
  back: (id: string) => string; // the document's screen
  title: (doc: PrintDocument) => string; // on the sheet: "Quotation", "Job Work Challan"
  copies?: string[]; // "Original for Consignee"…; the first is the default
};

export function PrintPage({ load, label, back, title, copies, ...print }: Props) {
  const { id = "" } = useParams();
  const company = useAtomValue(companyAtom);
  const [doc, setDoc] = useState<PrintDocument | null | "missing">(null);
  const [copy, setCopy] = useState(copies?.[0]);
  useEffect(() => {
    load(id).then(setDoc, () => setDoc("missing")); // failures toast
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- load is fixed per page
  useEffect(() => {
    if (!doc || doc === "missing") return;
    const before = document.title;
    document.title = `${label[0]!.toUpperCase()}${label.slice(1)} ${doc.number ?? "draft"} – ${doc.party_name}`;
    return () => {
      document.title = before;
    };
  }, [doc, label]);

  const backLink = (
    <LinkButton href={back(id)} variant="secondary">
      Back to {label}
    </LinkButton>
  );
  if (doc === "missing") return <p>This {label} couldn't be loaded. {backLink}</p>;
  if (!doc || !company) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  return (
    <DocumentPrint
      {...print}
      doc={doc}
      company={company}
      title={title(doc)}
      copy={copy}
      toolbar={
        <>
          {copies && (
            <Picker label="Copy" labelPosition="side" selectedKey={copy} onSelectionChange={(k) => setCopy(String(k))} styles={style({ width: 280 })}>
              {copies.map((c) => (
                <PickerItem key={c} id={c}>
                  {c}
                </PickerItem>
              ))}
            </Picker>
          )}
          <Button variant="accent" onPress={() => window.print()}>
            Print or save as PDF
          </Button>
          {backLink}
        </>
      }
    />
  );
}
