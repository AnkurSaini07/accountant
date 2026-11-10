// Import S2 components from their own entry points, not "@react-spectrum/s2": the main index pulls in
// every component's CSS (783 KB vs 145 KB minified for this page).
import { Button } from "@react-spectrum/s2/Button";
import { Provider } from "@react-spectrum/s2/Provider";
import { TextField } from "@react-spectrum/s2/TextField";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useState } from "react";

// Placeholder screen proving S2 components + the style macro work with Bun (#3). #14 replaces it with the app layout.
const layout = style({ display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 400 });
const title = style({ font: "heading-xl", margin: 0 });
const body = style({ font: "body" });

export function App() {
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");
  return (
    <Provider background="base">
      <main className={layout}>
        <h1 className={title}>Accountant</h1>
        <TextField label="Party name" value={name} onChange={setName} />
        <Button variant="accent" onPress={() => setGreeting(`Hello, ${name || "world"}`)}>
          Greet
        </Button>
        {greeting && (
          <p role="status" className={body}>
            {greeting}
          </p>
        )}
      </main>
    </Provider>
  );
}
