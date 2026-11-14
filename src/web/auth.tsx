// Who's signed in, for the whole app. <AuthProvider> asks /api/auth/me once; RequireAuth sends
// signed-out users to sign in, and so does any later 401 (e.g. an expired session), via api.ts's
// unauthorized handler.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { call, client, setUnauthorizedHandler } from "./api.ts";

export type Role = "admin" | "accountant" | "operator" | "viewer";
export type User = { id: number; name: string; email: string | null; role: Role };

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User };
type AuthContextValue = { state: AuthState; signOut: () => Promise<void> };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: "signedOut" }));
    let live = true;
    call(client.api.auth.me.$get()).then(
      (user) => live && setState({ status: "signedIn", user }),
      () => live && setState({ status: "signedOut" }), // 401, or the server is down (a toast says so)
    );
    return () => {
      live = false;
      setUnauthorizedHandler(undefined);
    };
  }, []);

  const signOut = useCallback(async () => {
    const { endSessionUrl } = await call(client.api.auth.logout.$post());
    // Leave the app entirely: Pocket ID ends its session too, then sends the browser back to "/".
    window.location.assign(endSessionUrl ?? "/sign-in");
  }, []);

  const value = useMemo(() => ({ state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** The signed-in user. Only call below <RequireAuth>. */
export function useUser(): User {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useUser must be used below <RequireAuth>");
  return state.user;
}
