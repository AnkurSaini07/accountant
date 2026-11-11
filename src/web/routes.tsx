import Archive from "@react-spectrum/s2/icons/Archive";
import Briefcase from "@react-spectrum/s2/icons/Briefcase";
import ChartBarVert from "@react-spectrum/s2/icons/ChartBarVert";
import FileText from "@react-spectrum/s2/icons/FileText";
import Home from "@react-spectrum/s2/icons/Home";
import Settings from "@react-spectrum/s2/icons/Settings";
import ShoppingCart from "@react-spectrum/s2/icons/ShoppingCart";
import UserGroup from "@react-spectrum/s2/icons/UserGroup";
import Wallet from "@react-spectrum/s2/icons/Wallet";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Link } from "@react-spectrum/s2/Link";
import { useAtomValue } from "jotai";
import type { ComponentType, ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { parseFyLabel } from "../shared/fy.ts";
import { CompanySettings } from "./pages/settings/Company.tsx";
import { Numbering } from "./pages/settings/Numbering.tsx";
import { ItemForm } from "./pages/items/ItemForm.tsx";
import { ItemList } from "./pages/items/ItemList.tsx";
import { LedgerList } from "./pages/ledgers/LedgerList.tsx";
import { PartyForm } from "./pages/parties/PartyForm.tsx";
import { PartyList } from "./pages/parties/PartyList.tsx";
import { financialYearAtom } from "./state.ts";

export type NavSection = { path: string; label: string; icon: ComponentType };

// One entry per top-level area. Feature tasks replace each placeholder with real pages under its path.
export const NAV: NavSection[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/sales", label: "Sales", icon: FileText },
  { path: "/purchase", label: "Purchase", icon: ShoppingCart },
  { path: "/accounts", label: "Accounts", icon: Wallet },
  { path: "/inventory", label: "Inventory", icon: Archive },
  { path: "/reports", label: "Reports", icon: ChartBarVert },
  { path: "/payroll", label: "Payroll", icon: Briefcase },
  { path: "/masters", label: "Masters", icon: UserGroup },
  { path: "/settings", label: "Settings", icon: Settings },
];

/** The nav section a path belongs to, e.g. "/sales/invoices/42" → "/sales". */
export function sectionOf(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return NAV.some((s) => s.path === `/${first}`) ? `/${first}` : "/";
}

const pageTitle = style({ font: "heading-lg", margin: 0 });
const pageBody = style({ font: "body", color: "gray-700" });

function Placeholder({ label }: { label: string }) {
  return (
    <>
      <h1 className={pageTitle}>{label}</h1>
      <p className={pageBody}>Coming soon.</p>
    </>
  );
}

function NotFound() {
  return (
    <>
      <h1 className={pageTitle}>Page not found</h1>
      <p className={pageBody}>Use the navigation to find what you were looking for.</p>
    </>
  );
}

const settingsNav = style({ display: "flex", gap: 16, marginBottom: 16, font: "ui" });
type SubLink = { path: string; label: string };
const SETTINGS: SubLink[] = [
  { path: "/settings/company", label: "Company" },
  { path: "/settings/numbering", label: "Numbering" },
];
const MASTERS: SubLink[] = [
  { path: "/masters/parties", label: "Parties" },
  { path: "/masters/items", label: "Items" },
  { path: "/masters/ledgers", label: "Ledgers" },
];

/** A section's pages share a small tab-like nav; a link stays current on its sub-pages (/masters/items/42). */
function SubNav({ label, links, children }: { label: string; links: SubLink[]; children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <>
      <nav aria-label={label} className={settingsNav}>
        {links.map(({ path, label }) => {
          const current = pathname === path || pathname.startsWith(`${path}/`);
          return (
            <Link key={path} href={path} isStandalone isQuiet={!current} aria-current={current ? "page" : undefined}>
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}

export function AppRoutes() {
  const financialYear = useAtomValue(financialYearAtom); // the header's FY label, e.g. "2026-27"
  return (
    <Routes>
      <Route path="/masters" element={<Navigate replace to="/masters/parties" />} />
      <Route path="/masters/parties" element={<SubNav label="Masters" links={MASTERS}><PartyList /></SubNav>} />
      <Route path="/masters/parties/new" element={<SubNav label="Masters" links={MASTERS}><PartyForm /></SubNav>} />
      <Route path="/masters/parties/:id" element={<SubNav label="Masters" links={MASTERS}><PartyForm /></SubNav>} />
      <Route path="/masters/items" element={<SubNav label="Masters" links={MASTERS}><ItemList /></SubNav>} />
      <Route path="/masters/items/new" element={<SubNav label="Masters" links={MASTERS}><ItemForm /></SubNav>} />
      <Route path="/masters/items/:id" element={<SubNav label="Masters" links={MASTERS}><ItemForm /></SubNav>} />
      <Route path="/masters/ledgers" element={<SubNav label="Masters" links={MASTERS}><LedgerList /></SubNav>} />
      <Route path="/settings" element={<Navigate replace to="/settings/company" />} />
      <Route path="/settings/company" element={<SubNav label="Settings" links={SETTINGS}><CompanySettings /></SubNav>} />
      <Route path="/settings/numbering" element={<SubNav label="Settings" links={SETTINGS}><Numbering fy={parseFyLabel(financialYear)} /></SubNav>} />
      {NAV.filter(({ path }) => path !== "/settings").map(({ path, label }) => (
        <Route key={path} path={path === "/" ? "/" : `${path}/*`} element={<Placeholder label={label} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
