// Settings → Numbering (FR-1.4): prefix, padding and next number per document type, for the FY
// chosen in the header. The preview uses the same formatNumber the server prints with.
import { Button } from "@react-spectrum/s2/Button";
import { Form } from "@react-spectrum/s2/Form";
import { NumberField } from "@react-spectrum/s2/NumberField";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TextField } from "@react-spectrum/s2/TextField";
import { ToastQueue } from "@react-spectrum/s2/Toast";
import { useEffect, useState } from "react";
import { fyLabel } from "../../../shared/fy.ts";
import { DOC_LABELS, type DocType, formatNumber, MAX_LENGTH } from "../../../shared/numbering.ts";
import { ApiError, api } from "../../api.ts";
import { useUser } from "../../auth.tsx";

export type Series = { doc_type: DocType; prefix: string; padding: number; next_number: number };
type SeriesResponse = { fy: number; series: Series[] };

const page = style({ display: "flex", flexDirection: "column", gap: 24, maxWidth: 960 });
const title = style({ font: "heading-xl", margin: 0 });
const note = style({ font: "body-sm", color: "gray-700", margin: 0 });
const list = style({ display: "flex", flexDirection: "column", gap: 16 });
const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "end",
  gap: 12,
  paddingBottom: 16,
  borderStyle: "solid",
  borderWidth: 0,
  borderBottomWidth: 1,
  borderColor: "gray-200",
});
const docName = style({ font: "title", margin: 0, width: 180, paddingBottom: 8 });
// S2 fields have no intrinsic width in a flex row (they'd shrink to nothing), so size each one.
const prefixField = style({ width: 200 });
const numberField = style({ width: 140 });
const preview = style({ font: "code-sm", color: "gray-800", margin: 0, paddingBottom: 8 });
const tooLong = style({ font: "body-sm", color: "negative", margin: 0, paddingBottom: 8 });

export function Numbering({ fy }: { fy: number }) {
  const [data, setData] = useState<SeriesResponse | null>(null);
  useEffect(() => {
    setData(null);
    api.get<SeriesResponse>(`/series?fy=${fy}`).then(setData, () => {});
  }, [fy]);
  if (!data) return <ProgressCircle aria-label="Loading" isIndeterminate />;
  return <NumberingForm key={`${fy}:${JSON.stringify(data)}`} data={data} onSaved={setData} />;
}

function NumberingForm({ data, onSaved }: { data: SeriesResponse; onSaved: (d: SeriesResponse) => void }) {
  const readOnly = useUser().role !== "admin";
  const [series, setSeries] = useState(data.series);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const saved = new Map(data.series.map((s) => [s.doc_type, s]));
  const set = (i: number, patch: Partial<Series>) => setSeries((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save() {
    setSaving(true);
    try {
      const result = await api.put<SeriesResponse>("/series", { fy: data.fy, series });
      setErrors({});
      ToastQueue.positive("Numbering saved.", { timeout: 5000 });
      onSaved(result);
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={page}>
      <h1 className={title}>Numbering</h1>
      <p className={note}>
        Financial year {fyLabel(data.fy)} (change it in the header). Use {"{FY}"} in a prefix for the year, e.g. INV/{"{FY}"}/ gives INV/
        {fyLabel(data.fy).slice(2)}/. Numbers start again each 1 April and can only move forward.
      </p>
      {readOnly && <p className={note}>Only an admin can change numbering.</p>}
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}>
        <div className={list}>
          {series.map((s, i) => {
            const next = formatNumber(s.prefix, data.fy, s.next_number || 1, s.padding || 1);
            const label = DOC_LABELS[s.doc_type];
            return (
              <section key={s.doc_type} className={row} aria-label={label}>
                <p className={docName}>{label}</p>
                <TextField styles={prefixField} label="Prefix" name={`series.${i}.prefix`} isReadOnly={readOnly} value={s.prefix} onChange={(v) => set(i, { prefix: v })} />
                <NumberField
                  styles={numberField}
                  label="Digits"
                  name={`series.${i}.padding`}
                  isReadOnly={readOnly}
                  minValue={1}
                  maxValue={8}
                  value={s.padding}
                  onChange={(v) => set(i, { padding: v })}
                />
                <NumberField
                  styles={numberField}
                  label="Next number"
                  name={`series.${i}.next_number`}
                  isReadOnly={readOnly}
                  minValue={saved.get(s.doc_type)?.next_number ?? 1}
                  value={s.next_number}
                  onChange={(v) => set(i, { next_number: v })}
                />
                {next.length > MAX_LENGTH ? (
                  <p className={tooLong}>
                    {next} is {next.length} characters; GST allows {MAX_LENGTH}.
                  </p>
                ) : (
                  <p className={preview} aria-label={`${label} next number`}>
                    {next}
                  </p>
                )}
              </section>
            );
          })}
        </div>
        {!readOnly && (
          <div>
            <Button type="submit" variant="accent" isPending={saving}>
              Save
            </Button>
          </div>
        )}
      </Form>
    </div>
  );
}
