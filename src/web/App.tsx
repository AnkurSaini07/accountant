// The app in the browser: Primer's theme (light or dark, following the system) and the browser's
// router. Shell is everything below them (tests mount it in a MemoryRouter).
import { BaseStyles, ThemeProvider } from "@primer/react";
import { BrowserRouter } from "react-router";
import { Shell } from "./Shell.tsx";

export function App() {
  return (
    <ThemeProvider colorMode="auto">
      <BaseStyles>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </BaseStyles>
    </ThemeProvider>
  );
}
