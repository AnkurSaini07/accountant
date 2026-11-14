// Native drop-downs (SelectField) in component tests: find one by its label, choose an option.
import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

/** The first drop-down labelled `label` (in `scope`, default the page). */
export const picker = (label: string | RegExp, scope?: HTMLElement) =>
  (scope ? within(scope) : screen).getAllByRole("combobox", { name: label }).find((e) => e.tagName === "SELECT") as HTMLSelectElement;

/** Chooses the option named `option` in the drop-down labelled `label`. */
export async function pick(user: ReturnType<typeof userEvent.setup>, label: string | RegExp, option: string | RegExp, scope?: HTMLElement) {
  const select = picker(label, scope);
  await user.selectOptions(select, await within(select).findByRole("option", { name: option })); // options may still be loading
}
