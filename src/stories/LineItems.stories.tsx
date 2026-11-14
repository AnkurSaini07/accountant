import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form } from "../web/components/Form.tsx";
import { useState } from "react";
import type { PickedItem } from "../web/components/ItemPicker.tsx";
import { type LineDraft, emptyLine, LineItems, type TotalsContext } from "../web/components/LineItems.tsx";

const item = (id: number, code: string, name: string, extra: Partial<PickedItem> = {}): PickedItem => ({
  id, code, name, type: "finished", hsn: "73181500", unit: "NOS", unit_decimals: 0, gst_rate: 18, sale_price: 12_50, purchase_price: 9_00, active: true, ...extra,
});
const BOLT = item(1, "FG-101", "Hex Bolt M10 x 50");
const ROD = item(2, "RM-12", "MS Rod 12mm", { hsn: "72142090", unit: "KGS", unit_decimals: 3, sale_price: 62_40, purchase_price: 58_00 });
const NUT = item(3, "FG-102", "Hex Nut M10", { sale_price: 3_20 });
const ITEMS = [BOLT, ROD, NUT];

const filled = (): LineDraft[] => [
  { ...emptyLine(), item: BOLT, description: "Zinc plated", qty: "5000", rate: "12.50", discount: "" },
  { ...emptyLine(), item: ROD, description: "", qty: "1250.500", rate: "62.40", discount: "2" },
  { ...emptyLine(), item: NUT, description: "", qty: "5000", rate: "3.20", discount: "" },
];
const LOCAL: TotalsContext = { type: "invoice", companyState: "06", partyState: "06", placeOfSupply: "06" };
const INTERSTATE: TotalsContext = { ...LOCAL, partyState: "07", placeOfSupply: "07" };

type Props = { start?: "empty" | "filled"; totals?: TotalsContext; isReadOnly?: boolean; rejected?: boolean; side?: "sale" | "purchase" };
function Harness({ start = "filled", totals = LOCAL, isReadOnly, rejected, side = "sale" }: Props) {
  const [lines, setLines] = useState(() => (start === "empty" ? [emptyLine()] : filled().map((l) => (rejected ? { ...l, rejected: "0" } : l))));
  return (
    <Form onSubmit={() => {}}>
      <LineItems lines={lines} onChange={setLines} side={side} totals={totals} isReadOnly={isReadOnly} rejected={rejected} />
    </Form>
  );
}

const meta = {
  title: "Components/Line items",
  component: Harness,
  parameters: {
    api: {
      "GET /items": (req: Request) => {
        const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
        const items = ITEMS.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(q));
        return { total: items.length, items, page: 1, page_size: 20 };
      },
    },
  },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Same state: CGST + SGST. Type "bolt" in an item cell to pick. */
export const Editing: Story = {};
export const Empty: Story = { args: { start: "empty" } };
export const Interstate: Story = { args: { totals: INTERSTATE } };
export const ReadOnly: Story = { args: { isReadOnly: true } };
/** A goods receipt: accepted and rejected qty. */
export const GoodsReceipt: Story = { args: { rejected: true, side: "purchase", totals: { ...LOCAL, type: "grn" } } };
