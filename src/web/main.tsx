import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

// Placeholder until #3 adds App.tsx with the UI library.
createRoot(root).render(
  <StrictMode>
    <h1>Accountant</h1>
  </StrictMode>,
);
