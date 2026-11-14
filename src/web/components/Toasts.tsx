// Shows the toast queue (toast.ts) at the bottom of the screen: failures as alerts, successes as
// status messages; each one can be dismissed, and most close on their own.
import { CheckCircleIcon, StopIcon, XIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";
import { useSyncExternalStore } from "react";
import { currentToasts, dismiss, subscribe } from "../toast.ts";
import classes from "./Toasts.module.css";

export function Toasts() {
  const toasts = useSyncExternalStore(subscribe, currentToasts);
  return (
    <div className={classes.stack} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === "negative" ? "alert" : "status"} className={`${classes.toast} ${t.tone === "negative" ? classes.negative : classes.positive}`}>
          {t.tone === "negative" ? <StopIcon /> : <CheckCircleIcon />}
          <span className={classes.message}>{t.message}</span>
          <IconButton icon={XIcon} variant="invisible" size="small" aria-label="Dismiss" onClick={() => dismiss(t.id)} className={classes.close} />
        </div>
      ))}
    </div>
  );
}
