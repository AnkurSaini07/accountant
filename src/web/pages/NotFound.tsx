// Any path the app doesn't know.
import { Blankslate } from "@primer/react/experimental";

export function NotFound() {
  return (
    <Blankslate>
      <Blankslate.Heading as="h1">Page not found</Blankslate.Heading>
      <Blankslate.Description>Use the navigation to find what you were looking for.</Blankslate.Description>
    </Blankslate>
  );
}
