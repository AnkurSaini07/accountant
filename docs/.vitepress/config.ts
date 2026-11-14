// The docs site (VitePress): `bun run docs:dev` to browse, `bun run docs:build` to check it builds.
// The pages are the Markdown files in docs/; this only adds navigation.
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Accountant",
  description: "GST-ready accounting for a fasteners factory: screens, operations and requirements.",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Screens", link: "/screens/" },
      { text: "Requirements", link: "/REQUIREMENTS" },
      { text: "Operations", link: "/OPERATIONS" },
    ],
    sidebar: [
      {
        text: "Screens",
        items: [
          { text: "Overview", link: "/screens/" },
          { text: "Design review brief", link: "/screens/design-brief" },
          { text: "Screen catalogue", link: "/screens/screen-catalogue" },
          { text: "Shared patterns", link: "/screens/patterns" },
          { text: "App shell", link: "/screens/shell" },
          { text: "Masters", link: "/screens/masters" },
          { text: "Settings", link: "/screens/settings" },
          { text: "Sales", link: "/screens/sales" },
          { text: "Purchase", link: "/screens/purchase" },
          { text: "Print sheets", link: "/screens/print" },
        ],
      },
      {
        text: "Project",
        items: [
          { text: "Requirements", link: "/REQUIREMENTS" },
          { text: "Operations", link: "/OPERATIONS" },
          { text: "Sign-in (Pocket ID)", link: "/AUTH" },
          { text: "ADR 0001: UI library (superseded)", link: "/adr/0001-ui-library" },
          { text: "ADR 0002: Primer", link: "/adr/0002-primer" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: [2, 3],
  },
});
