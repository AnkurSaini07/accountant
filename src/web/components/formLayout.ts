// Layout classes every edit screen shares: the page body, panels side by side, and the field grid
// (FieldGrid, Cell, Panel and PageHeader are the components that go with them).
import classes from "./layout.module.css";

/** Fields on a grid: 1 column on a phone, up to 6 on a wide screen; `isHalf` (a panel beside another) stops at 3. */
export const grid = ({ isHalf }: { isHalf?: boolean } = {}) => (isHalf ? `${classes.grid} ${classes.half}` : classes.grid);
export const fieldGrid = grid();
/** Panels side by side on a wide screen, stacked below it. */
export const twoUp = classes.twoUp;
/** The page body under the header. */
export const formPage = classes.page;
/** A column of blocks 16px apart (a dialog's body…). */
export const stack = classes.stack;
/** Small muted text: notes under a form, captions. */
export const note = classes.note;
/** A fact's label on a read-only document ("Date"). */
export const factLabel = classes.label;
/** Small red text: an error that has no field to sit under. */
export const errorText = classes.error;
