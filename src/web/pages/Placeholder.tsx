// A section that isn't built yet.
import { Blankslate } from "@primer/react/experimental";

export function Placeholder({ label }: { label: string }) {
  return (
    <Blankslate>
      <Blankslate.Heading as="h1">{label}</Blankslate.Heading>
      <Blankslate.Description>Coming soon.</Blankslate.Description>
    </Blankslate>
  );
}
