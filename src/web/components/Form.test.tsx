import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "bun:test";
import { useState } from "react";
import { Form } from "./Form.tsx";
import { TextField } from "./TextField.tsx";

function Harness({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("");
  return (
    <Form onSubmit={onSave}>
      <TextField label="Name" isRequired value={name} onChange={setName} />
      <button type="submit">Save</button>
    </Form>
  );
}

test("an empty required field stops the save, says why and takes focus; filled, it saves", async () => {
  let saves = 0;
  render(<Harness onSave={() => saves++} />);
  const user = userEvent.setup();
  const name = screen.getByRole("textbox", { name: "Name" }); // the "*" isn't part of the name
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(saves).toBe(0);
  expect(name).toHaveAttribute("aria-invalid", "true");
  expect(name).toHaveFocus();
  expect(screen.getByText("Fill in this field.")).toBeInTheDocument();
  await user.type(name, "Acme");
  expect(name).not.toHaveAttribute("aria-invalid");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(saves).toBe(1);
});
