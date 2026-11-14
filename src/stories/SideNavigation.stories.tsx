// The app's side nav on its own. Each story opens it at a route (parameters.route); clicking links
// navigates inside the story, so the selection and the open section follow along.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SideNavigation } from "../web/components/SideNavigation.tsx";

const frame = { width: 240, height: "100vh", padding: 8, borderRight: "1px solid var(--borderColor-default)" } as const;

const meta = {
  title: "Layout/Side navigation",
  component: SideNavigation,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div style={frame}><Story /></div>],
} satisfies Meta<typeof SideNavigation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = { parameters: { route: "/" } };
/** A page in a section: Sales opens and Invoices is selected. */
export const SalesPage: Story = { parameters: { route: "/sales/invoices" } };
/** A record under a page (an invoice) still selects its page. */
export const DeepRoute: Story = { parameters: { route: "/sales/invoices/12" } };
export const Masters: Story = { parameters: { route: "/masters/parties" } };
export const Settings: Story = { parameters: { route: "/settings/numbering" } };
/** A section that isn't built yet (no pages under it). */
export const ComingSoon: Story = { parameters: { route: "/reports" } };
/** Phone width starts as the icon rail; the button at the bottom expands it. Reload the story after switching the viewport. */
export const Phone: Story = { parameters: { route: "/sales/invoices" }, globals: { viewport: { value: "mobile1" } } };
