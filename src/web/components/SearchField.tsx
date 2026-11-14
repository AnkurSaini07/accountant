// A list's search box: a search input with the magnifier, named by aria-label.
import { SearchIcon } from "@primer/octicons-react";
import { TextInput } from "@primer/react";

type Props = { "aria-label": string; placeholder?: string; value: string; onChange: (value: string) => void; className?: string };

export function SearchField({ value, onChange, ...props }: Props) {
  return <TextInput {...props} type="search" size="small" block leadingVisual={SearchIcon} value={value} onChange={(e) => onChange(e.target.value)} />;
}
