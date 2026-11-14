import { Button } from "@primer/react";
import { useRef, useState } from "react";
import { error, note, section } from "./company.ts";
import c from "./ImageField.module.css";

const MAX_IMAGE_BYTES = 290_000; // the API takes ≈ 300 KB as a data URL

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The file as a data: URL. Chunked, so a few hundred KB doesn't overflow String.fromCharCode's arguments. */
async function readImage(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${file.type};base64,${btoa(binary)}`;
}

export function ImageField({ label, value, onChange, readOnly }: { label: string; value: string | null; onChange: (v: string | null) => void; readOnly: boolean }) {
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setProblem("Use a PNG, JPEG or WebP image.");
    if (file.size > MAX_IMAGE_BYTES) return setProblem("That image is over 300 KB. Use a smaller one.");
    setProblem(null);
    onChange(await readImage(file));
  }
  return (
    <div className={section}>
      <p className={c.title}>{label}</p>
      <div className={c.box}>
        {value ? <img src={value} alt={label} className={c.preview} /> : <p className={note}>None</p>}
        {!readOnly && (
          <>
            <input ref={input} type="file" hidden accept={IMAGE_TYPES.join(",")} onChange={(e) => void pick(e.target.files)} />
            <Button size="small" onClick={() => input.current?.click()}>
              {value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            </Button>
            {value && (
              <Button size="small" variant="invisible" onClick={() => onChange(null)}>
                Remove {label.toLowerCase()}
              </Button>
            )}
          </>
        )}
      </div>
      {problem && <p className={error}>{problem}</p>}
    </div>
  );
}
