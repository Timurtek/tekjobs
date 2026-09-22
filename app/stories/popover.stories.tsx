import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button, Checkbox, Popover } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Popover",
  component: Popover,
  tags: ["autodocs"],
  argTypes: argTypesFor("Popover"),
  args: { size: "md", modal: false },
  parameters: { docs: { description: { component: `A small panel anchored to its trigger: a filter form, a date picker, a confirmation. For a menu of actions use Menu; for a hint use Tooltip. Parts: Trigger, Anchor, Content, Close. ${classNameAllow("Popover")}` } } },
  render: (args) => (
    <Popover {...args}>
      <Popover.Trigger asChild>
        <Button variant="soft">Filter</Button>
      </Popover.Trigger>
      <Popover.Content align="start">
        <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
          <strong>Show</strong>
          <Checkbox label="Pending" defaultChecked size="sm" />
          <Checkbox label="Approved" defaultChecked size="sm" />
          <Checkbox label="Rejected" size="sm" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-2)" }}>
            <Popover.Close asChild>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </Popover.Close>
            <Popover.Close asChild>
              <Button size="sm" tone="primary">
                Apply
              </Button>
            </Popover.Close>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  ),
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
      {values("Popover", "size").map((size) => (
        <Popover key={size} {...args} size={size as never}>
          <Popover.Trigger asChild>
            <Button variant="soft" size="sm">
              {size}
            </Button>
          </Popover.Trigger>
          <Popover.Content>Size {size}: width and padding scale together.</Popover.Content>
        </Popover>
      ))}
    </div>
  ),
};

/** Opens from the trigger and closes from a Close inside. */
export const OpensAndCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Filter" }));
    const body = within(document.body);
    await expect(body.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Apply" }));
    await expect(body.queryByRole("dialog")).toBeNull();
  },
};
