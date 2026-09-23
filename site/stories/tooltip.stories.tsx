import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Tooltip } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: argTypesFor("Tooltip"),
  args: { content: "Delete item", side: "top", delay: 300, children: <Button variant="soft">Trigger</Button> },
  decorators: [
    (Story) => (
      <Tooltip.Provider>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--spacing-12)" }}>
          <Story />
        </div>
      </Tooltip.Provider>
    ),
  ],
  parameters: { docs: { description: { component: `A short hint on one trigger. Wrap the app in Tooltip.Provider once so nearby tooltips skip the delay when the pointer moves between them. Content is a phrase, not a paragraph. ${classNameAllow("Tooltip")}` } } },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="soft" aria-label="Delete item">Delete</Button>
    </Tooltip>
  ),
};

/** Opened for the docs page. Hover or focus the trigger in the canvas. */
export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="soft">Hover me</Button>
    </Tooltip>
  ),
};

export const Sides: Story = {
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "var(--spacing-8)" }}>
      {values("Tooltip", "side").map((side) => (
        <Tooltip key={side} {...args} side={side as never} content={`Side: ${side}`} defaultOpen>
          <Button variant="soft">{side}</Button>
        </Tooltip>
      ))}
    </div>
  ),
};
