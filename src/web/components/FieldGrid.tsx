import type { ReactNode } from "react";
import { grid } from "./formLayout.ts";

export const FieldGrid = ({ half, children }: { half?: boolean; children: ReactNode }) => <div className={grid({ isHalf: half })}>{children}</div>;
