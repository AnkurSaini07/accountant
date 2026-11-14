import { ArchiveIcon, BriefcaseIcon, CreditCardIcon, FileIcon, GearIcon, GraphIcon, HomeIcon, type Icon, PackageIcon, PeopleIcon } from "@primer/octicons-react";


export type NavPage = { path: string; label: string };
export type NavSection = NavPage & { icon: Icon; pages?: NavPage[] };

// One entry per top-level area, with its pages (the side nav shows them under it). Feature tasks
// replace each placeholder with real pages under its path.
export const NAV: NavSection[] = [
  { path: "/", label: "Dashboard", icon: HomeIcon },
  {
    path: "/sales",
    label: "Sales",
    icon: FileIcon,
    pages: [
      { path: "/sales/quotations", label: "Quotations" },
      { path: "/sales/orders", label: "Orders" },
      { path: "/sales/challans", label: "Challans" },
      { path: "/sales/invoices", label: "Invoices" },
      { path: "/sales/credit-notes", label: "Credit notes" },
    ],
  },
  {
    path: "/purchase",
    label: "Purchase",
    icon: PackageIcon,
    pages: [
      { path: "/purchase/orders", label: "Orders" },
      { path: "/purchase/grns", label: "GRNs" },
    ],
  },
  { path: "/accounts", label: "Accounts", icon: CreditCardIcon },
  { path: "/inventory", label: "Inventory", icon: ArchiveIcon },
  { path: "/reports", label: "Reports", icon: GraphIcon },
  { path: "/payroll", label: "Payroll", icon: BriefcaseIcon },
  {
    path: "/masters",
    label: "Masters",
    icon: PeopleIcon,
    pages: [
      { path: "/masters/parties", label: "Parties" },
      { path: "/masters/items", label: "Items" },
      { path: "/masters/ledgers", label: "Ledgers" },
    ],
  },
  {
    path: "/settings",
    label: "Settings",
    icon: GearIcon,
    pages: [
      { path: "/settings/company", label: "Company" },
      { path: "/settings/numbering", label: "Numbering" },
    ],
  },
];

/** The nav section a path belongs to, e.g. "/sales/invoices/42" → "/sales". */
export function sectionOf(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return NAV.some((s) => s.path === `/${first}`) ? `/${first}` : "/";
}

/** The nav entry to highlight: the page a path is on or under ("/sales/invoices/42" → "/sales/invoices"), else its section. */
export function navRouteOf(pathname: string): string {
  const section = NAV.find((s) => s.path === sectionOf(pathname))!;
  return section.pages?.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`))?.path ?? section.path;
}

