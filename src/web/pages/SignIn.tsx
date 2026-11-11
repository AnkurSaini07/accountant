// Full-page screens outside the app layout: sign-in, and "no access" for people Pocket ID knows
// but who aren't in any accountant-* group.
import { Link } from "@react-spectrum/s2/Link";
import { Button } from "@react-spectrum/s2/Button";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../auth.tsx";

const page = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "screen",
  padding: 24,
  boxSizing: "border-box",
});
const card = style({ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400, textAlign: "center", alignItems: "center" });
const title = style({ font: "heading-xl", margin: 0 });
const body = style({ font: "body", color: "gray-700", margin: 0 });

function Screen({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className={page}>
      <div className={card}>
        <h1 className={title}>{heading}</h1>
        {children}
      </div>
    </main>
  );
}

/** Same-site paths only, mirroring the server's check (no "//evil.com"). */
const safeReturnTo = (value: string | null) => (value && /^\/(?![/\\])/.test(value) ? value : "/");
export const loginUrl = (returnTo: string) => `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

export function SignIn() {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  if (state.status === "signedIn") return <Navigate replace to={returnTo} />;

  return (
    <Screen heading="Sign in">
      <p className={body}>Use your Pocket ID account (passkey) to continue.</p>
      {/* A real page load, not a client-side route (S2 links would route in-app): the server redirects to Pocket ID. */}
      <Button variant="accent" size="L" onPress={() => window.location.assign(loginUrl(returnTo))}>
        Sign in with Pocket ID
      </Button>
    </Screen>
  );
}

export function NoAccess() {
  return (
    <Screen heading="No access yet">
      <p className={body}>
        You signed in to Pocket ID, but your account hasn't been given a role in this app. Ask the owner to add you to one of
        the accountant groups in Pocket ID, then sign in again.
      </p>
      <p className={body}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </Screen>
  );
}
