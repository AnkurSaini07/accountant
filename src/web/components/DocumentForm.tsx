// One document's screen (new, or open by id): loads the document, or a draft made from source
// documents (?from=12,15: an order from quotations…), and the company, then hands them to
// DocumentEditor. Each type's page passes its API and labels.
import { Spinner } from "@primer/react";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { companyAtom } from "../state.ts";
import { type Body, type Doc, type DocConfig, type Draft, note } from "./documentForm.ts";
import { DocumentEditor } from "./DocumentEditor.tsx";

export type DocApi = {
  get: (id: string) => Promise<Doc>;
  create: (json: Body) => Promise<Doc>;
  update: (id: string, json: Body) => Promise<Doc>;
  move: (id: string, status: string) => Promise<Doc>;
  draftFrom?: (from: string) => Promise<Draft>;
  cancel?: (id: string, reason: string) => Promise<Doc>; // admins, with a reason (invoices…)
};

/** /<list>/new, /<list>/new?from=…, /<list>/:id */
export function DocumentForm(config: DocConfig) {
  const { id } = useParams();
  const from = useSearchParams()[0].get("from");
  const [doc, setDoc] = useState<Doc | Draft | null | "missing">(null);
  useEffect(() => {
    setDoc(null);
    const load = id ? config.api.get(id) : from && config.api.draftFrom ? config.api.draftFrom(from) : null;
    load?.then(setDoc, () => setDoc("missing")); // failures toast
  }, [id, from]); // eslint-disable-line react-hooks/exhaustive-deps -- the API is fixed per page
  const company = useAtomValue(companyAtom);

  if (doc === "missing") return <p className={note}>This {config.label} couldn't be loaded. Go back to the list and try again.</p>;
  const loading = id || (from && config.api.draftFrom);
  if (!company || (loading && !doc)) return <Spinner srText="Loading" />;
  const saved = doc && "id" in doc ? doc : null;
  const draft = doc && !("id" in doc) ? doc : null;
  // key: after a save or status change the editor starts again from what the server returned.
  return <DocumentEditor key={saved ? `${saved.id}:${saved.updated_at}` : `new:${from ?? ""}`} config={config} doc={saved} draft={draft} companyState={company.state_code} onSaved={setDoc} />;
}
