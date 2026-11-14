// One headline number on the dashboard: label, value (a skeleton while loading) and a note. A
// coloured top edge tells the four tiles apart at a glance; the label carries the meaning.
import { SkeletonText } from "@primer/react/experimental";
import c from "./Kpi.module.css";

type Tone = "accent" | "positive" | "notice" | "neutral";

export function Kpi({ label, value, note, tone }: { label: string; value: string | null; note?: string; tone: Tone }) {
  return (
    <section className={c.tile} data-tone={tone} aria-label={label}>
      <p className={c.label}>{label}</p>
      {value === null ? <SkeletonText size="titleMedium" maxWidth="120px" /> : <p className={c.value}>{value}</p>}
      {note && <p className={c.note}>{note}</p>}
    </section>
  );
}
