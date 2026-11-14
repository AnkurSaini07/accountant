import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FINANCIAL_YEARS } from "../web/state.ts";
import { PageHeader } from "../web/components/PageHeader.tsx";
import { Layout } from "../web/components/Layout.tsx";

const meta = {
  title: "Layout/Shell",
  component: Layout,
  parameters: { layout: "fullscreen", route: "/sales/invoices" },
  args: {
    companyName: "Northwind Fasteners",
    financialYears: FINANCIAL_YEARS,
    financialYear: FINANCIAL_YEARS[0]!,
    onFinancialYearChange: fn(),
    user: { name: "Asha Verma", email: "asha@example.com", role: "admin" },
    onSignOut: fn(),
    children: <PageHeader title="Tax invoices" />,
  },
} satisfies Meta<typeof Layout>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Sales is open because the route is under it. Click the avatar for the user popover. */
export const Default: Story = {};
export const Dashboard: Story = { parameters: { route: "/" } };
export const LongCompanyName: Story = { args: { companyName: "Shree Balaji Precision Engineering & Fasteners Private Limited" } };
