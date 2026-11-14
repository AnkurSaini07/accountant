// Primer's links and buttons-as-links are plain <a href>. This sends clicks on same-origin links through
// the router instead of reloading the page (new-tab clicks, downloads and target=_blank still work).
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function useAppLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download") || a.dataset.reload !== undefined) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);
}
