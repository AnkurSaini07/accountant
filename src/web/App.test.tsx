// Component test pattern for every screen: render, find elements by role/label (never CSS classes,
// which React Spectrum generates), interact with userEvent, assert on what the user sees.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { App } from "./App.tsx";

describe("App", () => {
  test("greets the typed party name", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Party name" }), "Sharma Steels");
    await user.click(screen.getByRole("button", { name: "Greet" }));

    expect(screen.getByRole("status")).toHaveTextContent("Hello, Sharma Steels");
  });

  test("falls back to 'world' when no name is typed", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Greet" }));
    expect(screen.getByRole("status")).toHaveTextContent("Hello, world");
  });
});
