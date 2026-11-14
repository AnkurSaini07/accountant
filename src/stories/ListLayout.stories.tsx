import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkButton } from "@primer/react";
import { RecordTable } from "../web/components/RecordTable.tsx";
import { SearchField } from "../web/components/SearchField.tsx";
import { SelectField } from "../web/components/SelectField.tsx";
import { StatusBadge } from "../web/components/StatusBadge.tsx";
import { type CardRow, CardList } from "../web/components/CardList.tsx";
import { ListPage } from "../web/components/ListPage.tsx";
import { INVOICE_STATUS } from "../web/pages/sales/InvoiceList.tsx";

const ROWS = [
  { id: 3, number: "INV/26-27/0003", date: "11 Nov 2026", party: "Acme Castings Pvt Ltd", status: "cancelled", total: "9,971.00" },
  { id: 2, number: "INV/26-27/0002", date: "11 Nov 2026", party: "Delta Auto Components", status: "draft", total: "1,44,550.00" },
  { id: 1, number: "INV/26-27/0001", date: "10 Nov 2026", party: "Acme Castings Pvt Ltd", status: "finalized", total: "1,33,576.00" },
];
const CARDS: CardRow[] = ROWS.map((r) => ({
  id: r.id,
  title: r.number,
  href: `/sales/invoices/${r.id}`,
  amount: `₹${r.total}`,
  meta: `${r.party} · ${r.date}`,
  badge: { label: INVOICE_STATUS[r.status]!.label, variant: INVOICE_STATUS[r.status]!.badge },
}));

function Page({ phone = false }: { phone?: boolean }) {
  return (
    <ListPage
      title="Tax invoices"
      actions={
        <LinkButton href="/sales/invoices/new" variant="primary" size="small">
          New invoice
        </LinkButton>
      }
      search={<SearchField aria-label="Search" placeholder="Number or party" value="" onChange={() => {}} />}
      activeFilters={1}
      filters={<SelectField label="Status" hideLabel value="draft" onChange={() => {}} options={[["all", "All statuses"], ...Object.entries(INVOICE_STATUS).map(([id, s]) => [id, s.label] as const)]} />}>
      {phone ? (
        <CardList label="Tax invoices" rows={CARDS} empty="No invoices." />
      ) : (
        <RecordTable
          label="Tax invoices"
          rows={ROWS}
          rowKey={(r) => r.id}
          href={(r) => `/sales/invoices/${r.id}`}
          empty="No invoices."
          columns={[
            { label: "Number", rowHeader: true, width: "minmax(140px, 1fr)", cell: (r) => r.number },
            { label: "Date", width: "minmax(110px, auto)", cell: (r) => r.date },
            { label: "Party", width: "minmax(200px, 2fr)", cell: (r) => r.party },
            { label: "Status", width: "minmax(110px, auto)", cell: (r) => <StatusBadge statuses={INVOICE_STATUS} status={r.status} /> },
            { label: "Total", align: "end", width: "minmax(120px, auto)", cell: (r) => r.total },
          ]}
        />
      )}
    </ListPage>
  );
}

const meta = { title: "Layout/List", component: Page } satisfies Meta<typeof Page>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
/** Phone width: rows as cards, filters behind the Filters button. Use the viewport toolbar too. */
export const Phone: Story = { args: { phone: true }, globals: { viewport: { value: "mobile2" } } };

export const Cards: StoryObj<typeof CardList> = { render: () => <CardList label="Recent" rows={CARDS} empty="Nothing yet." /> };
export const CardsEmpty: StoryObj<typeof CardList> = { render: () => <CardList label="Recent" rows={[]} empty="No documents in this financial year yet." /> };
export const CardsLoading: StoryObj<typeof CardList> = { render: () => <CardList label="Recent" rows={null} empty="" /> };
export const TableLoading: StoryObj = { render: () => <RecordTable label="Tax invoices" rows={null} rowKey={() => 0} href={() => "/"} empty="" columns={[{ label: "Number", rowHeader: true, cell: () => "" }]} /> };
