import { Link } from "@primer/react";
import { AuthScreen } from "./AuthScreen.tsx";
import classes from "./AuthScreen.module.css";

export function NoAccess() {
  return (
    <AuthScreen heading="No access yet">
      <p className={classes.body}>
        You signed in to Pocket ID, but your account hasn't been given a role in this app. Ask the owner to add you to one of
        the accountant groups in Pocket ID, then sign in again.
      </p>
      <p className={classes.body}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </AuthScreen>
  );
}
