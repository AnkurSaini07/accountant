// The app's side nav (Primer NavList): every section, with a section's pages nested under it. The
// current page is marked and its section starts open. Links go through the router (useAppLinks).
import { NavList } from "@primer/react";
import { memo } from "react";
import { useLocation } from "react-router";
import { NAV, navRouteOf } from "../routes.ts";

/**
 * `onNavigate`: called after a link is chosen (the phone drawer closes itself). Memoized: Primer's
 * link items remount their <a> when re-rendered, which would drop a click landing mid-render (e.g.
 * while the page's data arrives); now only a route change re-renders the nav.
 */
export const SideNavigation = memo(function SideNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const current = navRouteOf(useLocation().pathname);
  return (
    <NavList aria-label="Sections">
      {NAV.map(({ path, label, icon: Icon, pages }) => {
        const visual = (
          <NavList.LeadingVisual>
            <Icon />
          </NavList.LeadingVisual>
        );
        if (!pages?.length)
          return (
            <NavList.Item key={path} href={path} onClick={onNavigate} aria-current={current === path ? "page" : undefined}>
              {visual}
              {label}
            </NavList.Item>
          );
        return (
          // Opens on its own when it holds the current page; a deep link to a page it doesn't list opens it too.
          <NavList.Item key={path} defaultOpen={current === path}>
            {visual}
            {label}
            <NavList.SubNav>
              {pages.map((p) => (
                <NavList.Item key={p.path} href={p.path} onClick={onNavigate} aria-current={current === p.path ? "page" : undefined}>
                  {p.label}
                </NavList.Item>
              ))}
            </NavList.SubNav>
          </NavList.Item>
        );
      })}
    </NavList>
  );
});
