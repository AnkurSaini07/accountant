// Every story renders as the app does: inside Primer's theme (light or dark from the toolbar) and a
// router, with /api answered by the tests' fakeApi. A story adds routes with
// `parameters: { api: { "GET /items": {...} } }`; a signed-in admin and a company are always there.
// Whole pages render <Shell /> at `parameters.route`, so they get auth, the company and the layout.
import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import type { Decorator, Preview } from "@storybook/react-vite";
import { Provider as StateProvider } from "jotai";
import { MemoryRouter } from "react-router";
import { COMPANY, fakeApi, ME } from "../src/web/test/fake-api.ts";
import { useAppLinks } from "../src/web/useAppLinks.ts";

/** Same-app links route inside the story, as in the app. */
function AppLinks() {
  useAppLinks();
  return null;
}

const withApp: Decorator = (Story, { globals, parameters }) => {
  fakeApi({ "GET /auth/me": ME, "GET /company": COMPANY, ...parameters.api });
  const scheme = globals.scheme ?? "light";
  return (
    <MemoryRouter initialEntries={[parameters.route ?? "/"]}>
      <AppLinks />
      <StateProvider>
        <ThemeProvider colorMode={scheme === "dark" ? "night" : "day"}>
          {/* Primer's tokens switch on these attributes. */}
          <div data-color-mode={scheme} data-light-theme="light" data-dark-theme="dark" style={{ minHeight: "100vh", background: "var(--bgColor-default)", color: "var(--fgColor-default)" }}>
            <BaseStyles>
              <Story />
            </BaseStyles>
          </div>
        </ThemeProvider>
      </StateProvider>
    </MemoryRouter>
  );
};

const preview: Preview = {
  decorators: [withApp],
  parameters: { layout: "padded", controls: { expanded: true } },
  globalTypes: {
    scheme: {
      description: "Colour scheme",
      toolbar: { title: "Scheme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: "light" },
};
export default preview;
