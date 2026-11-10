// Types for the @testing-library/jest-dom matchers registered in setup.ts (toBeInTheDocument, toHaveValue, …).
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "bun:test" {
  interface Matchers<T> extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  interface AsymmetricMatchers extends TestingLibraryMatchers<typeof expect.stringContaining, unknown> {}
}
