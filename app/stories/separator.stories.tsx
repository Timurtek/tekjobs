import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Separator } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: argTypesFor("Separator"),
  args: { orientation: "horizontal", decorative: true },
  parameters: { docs: { description: { component: `A rule between groups. Decorative by default; pass decorative={false} when it separates landmarks. A label sets text into a horizontal line. ${classNameAllow("Separator")}` } } },
  render: (args) => (
    <div style={{ width: "20rem" }}>
      <p style={{ margin: "0 0 var(--spacing-3)" }}>Above the rule.</p>
      <Separator {...args} />
      <p style={{ margin: "var(--spacing-3) 0 0" }}>Below the rule.</p>
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

export const Labelled: Story = { args: { label: "or" } };

export const Orientations: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-6)", width: "20rem" }}>
      {values("Separator", "orientation").map((orientation) =>
        orientation === "vertical" ? (
          <div key={orientation} style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)", height: "2.5rem" }}>
            <Button variant="ghost" size="sm">
              Edit
            </Button>
            <Separator {...args} orientation="vertical" />
            <Button variant="ghost" size="sm">
              Share
            </Button>
          </div>
        ) : (
          <Separator key={orientation} {...args} orientation="horizontal" />
        ),
      )}
    </div>
  ),
};
