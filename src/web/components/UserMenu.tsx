// The avatar at the end of the top bar. It opens a small popover: who's signed in (name, role,
// email) and Sign out.
import { SignOutIcon } from "@primer/octicons-react";
import { AnchoredOverlay, Button } from "@primer/react";
import { useState } from "react";
import classes from "./UserMenu.module.css";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", accountant: "Accountant", operator: "Operator", viewer: "Viewer" };

/** "Asha Verma" → "AV", "admin" → "A". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words.length > 1 ? words.at(-1)![0] : "")).toUpperCase();
}

type Props = { user: { name: string; email: string | null; role: string }; onSignOut: () => void };

export function UserMenu({ user, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <AnchoredOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      align="end"
      overlayProps={{ role: "dialog", "aria-label": "Account" }}
      renderAnchor={(props) => (
        <button {...props} type="button" className={classes.avatar} aria-label={`Account: ${user.name}`}>
          {initialsOf(user.name)}
        </button>
      )}>
      <div className={classes.card}>
        <div className={classes.who}>
          <span className={`${classes.avatar} ${classes.large}`} aria-hidden>
            {initialsOf(user.name)}
          </span>
          <div className={classes.text}>
            <span className={classes.name}>{user.name}</span>
            <span className={classes.meta}>{ROLE_LABELS[user.role] ?? user.role}</span>
            {user.email && <span className={classes.meta}>{user.email}</span>}
          </div>
        </div>
        <Button size="small" leadingVisual={SignOutIcon} onClick={onSignOut} block>
          Sign out
        </Button>
      </div>
    </AnchoredOverlay>
  );
}
