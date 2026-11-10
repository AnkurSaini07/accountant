import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { SideNav, SideNavItem, SideNavItemContent, SideNavItemLink, Text } from "@react-spectrum/s2/SideNav";
import { SideNavPanel } from "@react-spectrum/s2/SideNavPanel";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { NAV, sectionOf } from "../routes.tsx";

const shell = style({ display: "flex", height: "screen", backgroundColor: "base" });
const column = style({ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 });
const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  paddingX: 24,
  paddingY: 12,
  borderStyle: "solid",
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderColor: "gray-200",
});
const company = style({ font: "title", margin: 0 });
const content = style({ padding: 24, overflow: "auto", flexGrow: 1 });

export type LayoutProps = {
  companyName: string;
  financialYears: string[];
  financialYear: string;
  onFinancialYearChange: (fy: string) => void;
  children: ReactNode;
};

export function Layout({ companyName, financialYears, financialYear, onFinancialYearChange, children }: LayoutProps) {
  const { pathname } = useLocation();
  // Collapse to the icon rail on phones; users can still expand it with the panel's toggle.
  const narrow = typeof window !== "undefined" && window.matchMedia?.("(max-width: 700px)").matches;

  return (
    <div className={shell}>
      <SideNavPanel aria-label="Main navigation" defaultCollapsed={narrow}>
        <SideNav aria-label="Sections" selectedRoute={sectionOf(pathname)}>
          {NAV.map(({ path, label, icon: Icon }) => (
            <SideNavItem key={path} id={path} href={path} textValue={label}>
              <SideNavItemContent>
                <SideNavItemLink>
                  <Icon />
                  <Text>{label}</Text>
                </SideNavItemLink>
              </SideNavItemContent>
            </SideNavItem>
          ))}
        </SideNav>
      </SideNavPanel>
      <div className={column}>
        <header className={header}>
          <p className={company}>{companyName}</p>
          <Picker
            label="Financial year"
            labelPosition="side"
            size="S"
            selectedKey={financialYear}
            onSelectionChange={(key) => key != null && onFinancialYearChange(String(key))}>
            {financialYears.map((fy) => (
              <PickerItem key={fy} id={fy}>
                {fy}
              </PickerItem>
            ))}
          </Picker>
        </header>
        <main className={content}>{children}</main>
      </div>
    </div>
  );
}
