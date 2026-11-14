import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Label } from "@primer/react";
import { useState } from "react";
import { formPage, stack, twoUp } from "../web/components/formLayout.ts";
import { Panel } from "../web/components/Panel.tsx";
import { Cell } from "../web/components/Cell.tsx";
import { CheckboxField } from "../web/components/CheckboxField.tsx";
import { DateField } from "../web/components/DateField.tsx";
import { FieldGrid } from "../web/components/FieldGrid.tsx";
import { Form } from "../web/components/Form.tsx";
import { PageHeader } from "../web/components/PageHeader.tsx";
import { SelectField } from "../web/components/SelectField.tsx";
import { TextAreaField } from "../web/components/TextAreaField.tsx";
import { TextField } from "../web/components/TextField.tsx";

const meta = { title: "Layout/Form", component: PageHeader } satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
  args: {
    back: { href: "/sales/invoices", label: "Back to invoices" },
    eyebrow: "Invoice",
    title: "INV/26-27/0001",
    badge: <Label variant="success">Finalized</Label>,
    actions: (
      <>
        <Button size="small">Print</Button>
        <Button variant="primary" size="small">
          Create credit note
        </Button>
      </>
    ),
  },
};

const save = (
  <Button variant="primary" size="small">
    Save
  </Button>
);
export const HeaderNew: Story = { args: { back: { href: "/masters/parties", label: "Back to parties" }, eyebrow: "New", title: "party", actions: save } };

export const HeaderTopLevel: Story = { args: { title: "Company", actions: save } };

/** Uncontrolled-looking fields for the story: each keeps its own value. */
function Text(props: Omit<Parameters<typeof TextField>[0], "value" | "onChange"> & { initial?: string }) {
  const [v, setV] = useState(props.initial ?? "");
  return <TextField {...props} value={v} onChange={setV} />;
}

function EditScreen() {
  const [kind, setKind] = useState<string | null>("customer");
  const [since, setSince] = useState<string | null>(null);
  const [rc, setRc] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <div className={formPage}>
      <PageHeader back={{ href: "/masters/parties", label: "Back to parties" }} eyebrow="Party" title="Acme Castings Pvt Ltd" actions={save} />
      <Form className={stack} errors={{ email: ["Enter an email like name@example.com."] }} onSubmit={() => {}}>
        <Panel title="Party">
          <FieldGrid>
            <Cell wide>
              <Text label="Name" isRequired initial="Acme Castings Pvt Ltd" />
            </Cell>
            <Cell>
              <SelectField label="Type" value={kind} onChange={setKind} options={{ customer: "Customer", supplier: "Supplier" }} />
            </Cell>
            <Cell>
              <Text label="GSTIN" initial="06AAACA1234B1ZM" description="State and PAN come from the GSTIN." />
            </Cell>
            <Cell>
              <Text label="PAN" initial="AAACA1234B" isReadOnly />
            </Cell>
            <Cell>
              <DateField label="Since" value={since} onChange={setSince} />
            </Cell>
            <Cell check>
              <CheckboxField label="Reverse charge" isSelected={rc} onChange={setRc} />
            </Cell>
            <Cell full>
              <TextAreaField label="Notes" description="Internal: not printed." value={notes} onChange={setNotes} />
            </Cell>
          </FieldGrid>
        </Panel>
        <div className={twoUp}>
          <Panel title="Contact">
            <FieldGrid half>
              <Cell>
                <Text label="Contact person" initial="R. Mehta" />
              </Cell>
              <Cell>
                <Text label="Phone" initial="98110 00001" />
              </Cell>
              <Cell>
                <Text label="Email" name="email" initial="r.mehta@" />
              </Cell>
            </FieldGrid>
          </Panel>
          <Panel title="Credit" note="Blank limit: no limit." action={<Button size="small">Reset</Button>}>
            <FieldGrid half>
              <Cell>
                <Text label="Credit days" initial="30" />
              </Cell>
              <Cell>
                <Text label="Credit limit (₹)" />
              </Cell>
            </FieldGrid>
          </Panel>
        </div>
      </Form>
    </div>
  );
}

/** A whole edit screen built from the parts: header, panels, the field grid and its cells (one field shows a server error). */
export const Screen: StoryObj = { render: () => <EditScreen /> };
