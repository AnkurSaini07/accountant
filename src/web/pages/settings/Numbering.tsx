// Settings → Numbering (FR-1.4): prefix, padding and next number per document type, for the FY
// chosen in the header. The preview uses the same formatNumber the server prints with.
import { Spinner } from "@primer/react";
import { useEffect, useState } from "react";
import type { DocType } from "../../../shared/numbering.ts";
import { call, client } from "../../api.ts";
import { NumberingForm } from "./NumberingForm.tsx";

export type Series = { doc_type: DocType; prefix: string; padding: number; next_number: number };
export type SeriesResponse = { fy: number; series: Series[] };

export function Numbering({ fy }: { fy: number }) {
  const [data, setData] = useState<SeriesResponse | null>(null);
  useEffect(() => {
    setData(null);
    call(client.api.series.$get({ query: { fy: String(fy) } })).then(setData, () => {});
  }, [fy]);
  if (!data) return <Spinner srText="Loading" />;
  return <NumberingForm key={`${fy}:${JSON.stringify(data)}`} data={data} onSaved={setData} />;
}
