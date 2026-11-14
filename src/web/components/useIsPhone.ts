// True on a phone-width screen (below the style macro's md breakpoint): lists switch to cards there.
import { useEffect, useState } from "react";

const PHONE = "(max-width: 767px)"; // below the style macro's md breakpoint

/** True on a phone-width screen; follows rotation and resizing. */
export function useIsPhone(): boolean {
  const query = () => typeof window !== "undefined" && !!window.matchMedia?.(PHONE).matches;
  const [phone, setPhone] = useState(query);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
