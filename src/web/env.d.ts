// @react-spectrum/s2's package.json points "./page.css" at a .d.ts it doesn't ship.
declare module "@react-spectrum/s2/page.css";

// Side-effect CSS imports (bundled by Bun).
declare module "*.css";
