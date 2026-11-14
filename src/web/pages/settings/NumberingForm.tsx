import { Button } from "@primer/react";
import { Form } from "../../components/Form.tsx";
import { NumberField } from "../../components/NumberField.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { TextField } from "../../components/TextField.tsx";
import { formPage, note } from "../../components/formLayout.ts";
import { ToastQueue } from "../../toast.ts";
import { useState } from "react";
import { fyLabel } from "../../../shared/fy.ts";
import { DOC_LABELS, formatNumber, MAX_LENGTH } from "../../../shared/numbering.ts";
import { ApiError, call, client } from "../../api.ts";
import { useUser } from "../../auth.tsx";
import type { Series, SeriesResponse } from "./Numbering.tsx";
import c from "./NumberingForm.module.css";

export function NumberingForm({ data, onSaved }: { data: SeriesResponse; onSaved: (d: SeriesResponse) => void }) {
  const readOnly = useUser().role !== "admin";
  const [series, setSeries] = useState(data.series);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const saved = new Map(data.series.map((s) => [s.doc_type, s]));
  const set = (i: number, patch: Partial<Series>) => setSeries((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save() {
    setSaving(true);
    try {
      const result = await call(client.api.series.$put({ json: { fy: data.fy, series } }));
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
    <div className={formPage}>
      <PageHeader
        title="Numbering"
        actions={
          !readOnly && (
            <Button type="submit" form="numbering-form" variant="primary" size="small" loading={saving}>
              Save
            </Button>
          )
        }
      />
      <p className={note}>
        Financial year {fyLabel(data.fy)} (change it in the header). Use {"{FY}"} in a prefix for the year, e.g. INV/{"{FY}"}/ gives INV/
        {fyLabel(data.fy).slice(2)}/. Numbers start again each 1 April and can only move forward.
      </p>
      {readOnly && <p className={note}>Only an admin can change numbering.</p>}
      <Form id="numbering-form" errors={errors} onSubmit={() => void save()}>
        <div className={c.list}>
          {series.map((s, i) => {
            const next = formatNumber(s.prefix, data.fy, s.next_number || 1, s.padding || 1);
            const label = DOC_LABELS[s.doc_type];
            return (
              <section key={s.doc_type} className={c.row} aria-label={label}>
                <p className={c.docName}>{label}</p>
                <TextField className={c.prefix} label="Prefix" name={`series.${i}.prefix`} isReadOnly={readOnly} value={s.prefix} onChange={(v) => set(i, { prefix: v })} />
                <NumberField className={c.number} label="Digits" name={`series.${i}.padding`} isReadOnly={readOnly} minValue={1} maxValue={8} value={s.padding} onChange={(v) => set(i, { padding: v })} />
                <NumberField
                  className={c.number}
                  label="Next number"
                  name={`series.${i}.next_number`}
                  isReadOnly={readOnly}
                  minValue={saved.get(s.doc_type)?.next_number ?? 1}
                  value={s.next_number}
                  onChange={(v) => set(i, { next_number: v })}
                />
                {next.length > MAX_LENGTH ? (
                  <p className={c.tooLong}>
                    {next} is {next.length} characters; GST allows {MAX_LENGTH}.
                  </p>
                ) : (
                  <p className={c.preview} aria-label={`${label} next number`}>
                    {next}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </Form>
    </div>
  );
}
