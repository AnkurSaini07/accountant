// "Cancel invoice INV/…?" with the reason the law wants kept.
import { Dialog } from "@primer/react";
import { useState } from "react";
import { note, stack } from "./formLayout.ts";
import { TextAreaField } from "./TextAreaField.tsx";

export function CancelDialog({ title, onCancel, onClose }: { title: string; onCancel: (reason: string) => Promise<boolean>; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footerButtons={[
        { buttonType: "default", content: "Keep it", onClick: onClose },
        {
          buttonType: "danger",
          content: "Cancel it",
          loading: busy,
          disabled: !reason.trim(),
          onClick: async () => {
            setBusy(true);
            const done = await onCancel(reason.trim());
            setBusy(false);
            if (done) onClose();
          },
        },
      ]}>
      <div className={stack}>
        <p className={note}>This can't be undone. The number stays used, and what it took from challans or orders goes back to them.</p>
        <TextAreaField label="Reason" isRequired value={reason} onChange={setReason} autoFocus />
      </div>
    </Dialog>
  );
}
