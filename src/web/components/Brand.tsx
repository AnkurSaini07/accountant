// The app's mark and name, at the start of the top bar.
import classes from "./Brand.module.css";

export function Brand() {
  return (
    <span className={classes.brand}>
      <span className={classes.mark} aria-hidden>
        ₹
      </span>
      <span className={classes.name}>Accountant</span>
    </span>
  );
}
