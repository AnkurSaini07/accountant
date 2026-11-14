// Storybook for the web components (stories live in src/stories/): `bun run storybook` (http://localhost:6006).
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/stories/*.stories.tsx"],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({ ...vite, build: { ...vite.build, target: ["es2022"] } }),
};
export default config;
