// Sign in: a full-page screen outside the app layout that starts the Pocket ID login and comes back
// to where the user was going (?returnTo=).
import { Button } from "@primer/react";
import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../auth.tsx";
import { AuthScreen } from "./AuthScreen.tsx";
import classes from "./AuthScreen.module.css";

/** Same-site paths only, mirroring the server's check (no "//evil.com"). */
const safeReturnTo = (value: string | null) => (value && /^\/(?![/\\])/.test(value) ? value : "/");
export const loginUrl = (returnTo: string) => `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

export function SignIn() {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  if (state.status === "signedIn") return <Navigate replace to={returnTo} />;

  return (
    <AuthScreen heading="Sign in">
      <p className={classes.body}>Use your Pocket ID account (passkey) to continue.</p>
      {/* A real page load, not a client-side route: the server redirects to Pocket ID. */}
      <Button variant="primary" size="large" onClick={() => window.location.assign(loginUrl(returnTo))}>
        Sign in with Pocket ID
      </Button>
    </AuthScreen>
  );
}
