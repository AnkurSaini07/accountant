// The app shell, GitHub-style: a full-width top bar (the app, the company, the financial year and
// the user's avatar) over the side nav and the page. On a phone the side nav moves into a drawer
// opened from the top bar. Depth is borders and the inset top bar, not shadows. Print sheets and
// sign-in render outside it.
import { ThreeBarsIcon } from "@primer/octicons-react";
import { Dialog, IconButton, Select } from "@primer/react";
import { type ReactNode, useCallback, useState } from "react";
import { Brand } from "./Brand.tsx";
import { SideNavigation } from "./SideNavigation.tsx";
import { UserMenu } from "./UserMenu.tsx";
import classes from "./Layout.module.css";

export type LayoutProps = {
  companyName: string;
  financialYears: string[];
  financialYear: string;
  onFinancialYearChange: (fy: string) => void;
  user: { name: string; email: string | null; role: string };
  onSignOut: () => void;
  children: ReactNode;
};

export function Layout({ companyName, financialYears, financialYear, onFinancialYearChange, user, onSignOut, children }: LayoutProps) {
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  return (
    <div className={classes.shell}>
      <header className={classes.top}>
        <IconButton icon={ThreeBarsIcon} aria-label="Open navigation" variant="invisible" className={classes.menu} onClick={() => setDrawer(true)} />
        <Brand />
        <span className={classes.slash} aria-hidden>
          /
        </span>
        <span className={classes.company}>{companyName}</span>
        <Select size="small" aria-label="Financial year" value={financialYear} onChange={(e) => onFinancialYearChange(e.target.value)} className={classes.fy}>
          {financialYears.map((fy) => (
            <Select.Option key={fy} value={fy}>
              {fy}
            </Select.Option>
          ))}
        </Select>
        <UserMenu user={user} onSignOut={onSignOut} />
      </header>
      <div className={classes.side}>
        <SideNavigation />
      </div>
      <main className={classes.main}>{children}</main>
      {drawer && (
        <Dialog title="Accountant" position={{ narrow: "left", regular: "left" }} width="small" onClose={closeDrawer}>
          <SideNavigation onNavigate={closeDrawer} />
        </Dialog>
      )}
    </div>
  );
}
