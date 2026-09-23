import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Table } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const ROWS = [
  { id: "RV-418", title: "Rename the billing tokens", author: "Ada", files: 12, status: "pending" },
  { id: "RV-417", title: "Dark theme for the report page", author: "Grace", files: 4, status: "approved" },
  { id: "RV-416", title: "Drop the legacy palette", author: "Linus", files: 31, status: "rejected" },
] as const;

const TONE = { pending: "primary", approved: "success", rejected: "danger" } as const;

const meta = {
  title: "Table",
  component: Table,
  tags: ["autodocs"],
  argTypes: argTypesFor("Table"),
  args: { density: "md", stickyHeader: false },
  parameters: { docs: { description: { component: `A data table with its scroll container. Parts: Head, Body, Foot, Row, Cell, HeadCell. Numeric columns align end and set numeric for tabular figures. ${classNameAllow("Table")}` } } },
  render: (args) => (
    <Table {...args} aria-label="Reviews">
      <Table.Head>
        <Table.Row>
          <Table.HeadCell>Id</Table.HeadCell>
          <Table.HeadCell>Title</Table.HeadCell>
          <Table.HeadCell>Author</Table.HeadCell>
          <Table.HeadCell align="end" numeric>
            Files
          </Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {ROWS.map((r) => (
          <Table.Row key={r.id} interactive selected={r.id === "RV-417"}>
            <Table.Cell>{r.id}</Table.Cell>
            <Table.Cell>{r.title}</Table.Cell>
            <Table.Cell>{r.author}</Table.Cell>
            <Table.Cell align="end" numeric>
              {r.files}
            </Table.Cell>
            <Table.Cell>
              <Badge tone={TONE[r.status]} size="sm">
                {r.status}
              </Badge>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
      <Table.Foot>
        <Table.Row>
          <Table.Cell colSpan={3}>3 reviews</Table.Cell>
          <Table.Cell align="end" numeric>
            47
          </Table.Cell>
          <Table.Cell />
        </Table.Row>
      </Table.Foot>
    </Table>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Densities: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-6)" }}>
      {values("Table", "density").map((density) => (
        <Table key={density} {...args} density={density as never} aria-label={`Density ${density}`}>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Density {density}</Table.HeadCell>
              <Table.HeadCell align="end" numeric>
                Files
              </Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {ROWS.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{r.title}</Table.Cell>
                <Table.Cell align="end" numeric>
                  {r.files}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ))}
    </div>
  ),
};

/** The header stays put while the body scrolls inside the container, which a max-height gives a height to. */
export const StickyHeader: Story = {
  args: { stickyHeader: true },
  render: (args) => (
    <Table {...args} aria-label="Sticky" style={{ maxHeight: "12rem" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Title</Table.HeadCell>
            <Table.HeadCell>Author</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {Array.from({ length: 12 }, (_, i) => (
            <Table.Row key={i}>
              <Table.Cell>Review {i + 1}</Table.Cell>
              <Table.Cell>{ROWS[i % 3]!.author}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
    </Table>
  ),
};
