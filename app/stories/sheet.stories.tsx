import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button, Sheet, TextField } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Sheet",
  component: Sheet,
  tags: ["autodocs"],
  argTypes: argTypesFor("Sheet"),
  args: { side: "right", size: "md", modal: true },
  parameters: { docs: { description: { component: `A panel that slides in from an edge: navigation on small screens, a detail view beside a table, a filter drawer. Same parts as Dialog: Trigger, Content, Title, Description, Footer, Close. ${classNameAllow("Sheet")}` } } },
  render: (args) => (
    <Sheet {...args}>
      <Sheet.Trigger asChild>
        <Button variant="soft">Edit review</Button>
      </Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Title>Review #418</Sheet.Title>
        <Sheet.Description>Change the title or the reviewer. Changes save when you press Save.</Sheet.Description>
        <TextField label="Title" defaultValue="Rename the billing tokens" />
        <TextField label="Reviewer" defaultValue="Grace" />
        <Sheet.Footer>
          <Sheet.Close asChild>
            <Button variant="ghost">Cancel</Button>
          </Sheet.Close>
          <Sheet.Close asChild>
            <Button tone="primary">Save</Button>
          </Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  ),
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {};

export const Left: Story = { args: { side: "left" } };

export const Bottom: Story = { args: { side: "bottom", size: "sm" } };

export const Sides: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
      {values("Sheet", "side").map((side) =>
        values("Sheet", "size").map((size) => (
          <Sheet key={`${side}-${size}`} {...args} side={side as never} size={size as never}>
            <Sheet.Trigger asChild>
              <Button variant="soft" size="sm">
                {side} {size}
              </Button>
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>
                {side}, {size}
              </Sheet.Title>
              <Sheet.Description>Escape or the close button dismisses it.</Sheet.Description>
            </Sheet.Content>
          </Sheet>
        )),
      )}
    </div>
  ),
};

/** Opens from the trigger, closes from the footer. */
export const OpensAndCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit review" }));
    const body = within(document.body);
    await expect(body.getByRole("dialog", { name: "Review #418" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Cancel" }));
    await expect(body.queryByRole("dialog")).toBeNull();
  },
};
