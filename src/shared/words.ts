// Amount in words for invoices, in the Indian system:
//   12345650 paise → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only"
// Words come from ./to-words (copied from ukit's src/utils/to-words); this file only applies the
// invoice convention: "Rupees … and … Paise Only", Title Case, integer paise in.
import { ToWords } from "./to-words/to-words.ts";

const toWords = new ToWords({ locale: "en-IN" });
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** A non-negative integer in Indian-system words: 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six". */
export function numberInWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Not a non-negative integer: ${n}`);
  // ponytail: from 100 crore up this says "One Arab …" (to-words' Indian units), not "One Hundred Crore".
  // Fine for this business's invoice sizes; drop arab/kharab from to-words/system/indian.ts if it ever matters.
  return titleCase(toWords.numberToWords(n, { systemId: "en (Indian)" }));
}

/** Paise → invoice wording. Throws on negative or non-integer paise. */
export function amountInWords(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new RangeError(`Not a valid amount in paise: ${paise}`);
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const paiseText = `${numberInWords(p)} ${p === 1 ? "Paisa" : "Paise"}`;
  if (rupees === 0 && p > 0) return `${paiseText} Only`;
  return `Rupees ${numberInWords(rupees)}${p ? ` and ${paiseText}` : ""} Only`;
}
