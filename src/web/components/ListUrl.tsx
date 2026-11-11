// URL state for the master lists (parties, items, ledgers): ?q=&inactive=1&page= plus each list's
// own filters, so refresh, Back and shared links keep the view; and the pager under the table.
import { Button } from "@react-spectrum/s2/Button";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

export const PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 300;

export function useListUrl() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const inactive = params.get("inactive") === "1";
  const pageNo = Math.max(1, Number(params.get("page")) || 1);

  /** Changes some URL params; any filter change goes back to page 1. */
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: "q" in patch }, // typing shouldn't fill the Back history
    );

  // The box updates at once; the URL (and the fetch) after the user pauses typing.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => update({ q: text.trim() || null }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- only typing starts the timer

  return { params, q, inactive, pageNo, update, text, setText };
}

const pager = style({ display: "flex", alignItems: "center", justifyContent: "end", gap: 12, font: "body-sm" });

/** "51–100 of 230  [Previous] [Next]"; nothing when the list is empty. */
export function Pager({ total, shown, pageNo, update }: { total: number; shown: number; pageNo: number; update: ReturnType<typeof useListUrl>["update"] }) {
  if (!total) return null;
  const from = (pageNo - 1) * PAGE_SIZE + 1;
  return (
    <div className={pager}>
      <span>
        {from}–{from + shown - 1} of {total}
      </span>
      <Button variant="secondary" size="S" isDisabled={pageNo <= 1} onPress={() => update({ page: pageNo - 1 > 1 ? String(pageNo - 1) : null })}>
        Previous
      </Button>
      <Button variant="secondary" size="S" isDisabled={pageNo >= Math.ceil(total / PAGE_SIZE)} onPress={() => update({ page: String(pageNo + 1) })}>
        Next
      </Button>
    </div>
  );
}
