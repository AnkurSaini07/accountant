// A full-page screen outside the app layout (sign in, no access): the app's mark, a heading and a
// short message, centred on a bordered box.
import type { ReactNode } from "react";
import { Brand } from "../components/Brand.tsx";
import classes from "./AuthScreen.module.css";

export function AuthScreen({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className={classes.page}>
      <Brand />
      <div className={classes.card}>
        <h1 className={classes.title}>{heading}</h1>
        {children}
      </div>
    </main>
  );
}
