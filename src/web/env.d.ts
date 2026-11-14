// CSS modules: class names by key (Bun and Vite both bundle them).
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
// Side-effect CSS imports (bundled by Bun).
declare module "*.css";
