import { Spinner } from "@primer/react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./auth.tsx";

const centered = { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" } as const;

/** Renders children for signed-in users; sends everyone else to sign in, remembering where they were. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") {
    return (
      <div style={centered}>
        <Spinner srText="Loading" />
      </div>
    );
  }
  if (state.status === "signedOut") {
    const returnTo = location.pathname + location.search + location.hash;
    return <Navigate replace to={returnTo === "/" ? "/sign-in" : `/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return children;
}
